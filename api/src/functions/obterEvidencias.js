const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.http('obterEvidencias', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const tokenEnviado = request.headers.get('x-access-token');
            const painelToken = process.env.PAINEL_ACCESS_TOKEN;

            if (!painelToken) {
                return { 
                    status: 500, 
                    jsonBody: { error: 'A variável PAINEL_ACCESS_TOKEN não foi configurada nas configurações do Azure.' } 
                };
            }

            if (tokenEnviado !== painelToken) {
                return { 
                    status: 401, 
                    jsonBody: { error: 'Token inválido. Acesso ao painel gerencial recusado.' } 
                };
            }

            if (!connectionString) {
                return { 
                    status: 500, 
                    jsonBody: { error: 'A variável AZURE_STORAGE_CONNECTION_STRING não foi configurada.' } 
                };
            }

            const tableClient = TableClient.fromConnectionString(connectionString, 'EvidenciasTable');
            await tableClient.createTable(); 

            const evidencias = [];
            const listResults = tableClient.listEntities();

            for await (const entity of listResults) {
                evidencias.push({
                    contrato: entity.contrato,
                    cidade: entity.cidade,
                    tecnico: entity.tecnico,
                    empresa: entity.empresa,
                    servico: entity.servico || 'N/A', 
                    janela: entity.janela || 'N/A',   
                    observacao: entity.observacao || '', // Recupera o campo observação do Azure
                    caId: entity.caId || '',             // Recupera o campo caId do Azure
                    latitude: entity.latitude,
                    longitude: entity.longitude,
                    endereco: entity.endereco,
                    urlsFotos: entity.urlsFotos ? JSON.parse(entity.urlsFotos) : [],
                    dataHora: entity.dataHora || entity.timestamp
                });
            }

            evidencias.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

            return { status: 200, jsonBody: evidencias };

        } catch (error) {
            context.error('Erro ao listar evidencias:', error);
            return { 
                status: 500, 
                jsonBody: { error: `Erro ao recuperar dados: ${error.message}` } 
            };
        }
    }
});
