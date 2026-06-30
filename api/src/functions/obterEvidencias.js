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
                    codigoBaixa: entity.codigoBaixa || 'N/A',
                    cidade: entity.cidade,
                    tecnico: entity.tecnico,
                    empresa: entity.empresa,
                    servico: entity.servico || 'N/A', 
                    janela: entity.janela || 'N/A',   
                    observacao: entity.observacao || '', 
                    caId: entity.caId || '',             
                    latitude: typeof entity.latitude === 'number' ? entity.latitude : 0,
                    longitude: typeof entity.longitude === 'number' ? entity.longitude : 0,
                    endereco: entity.endereco || 'Não disponível',
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
