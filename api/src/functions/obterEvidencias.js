const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.http('obterEvidencias', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!connectionString) {
                return { 
                    status: 500, 
                    jsonBody: { error: 'A variável AZURE_STORAGE_CONNECTION_STRING não foi configurada no portal do Azure.' } 
                };
            }

            const tableClient = TableClient.fromConnectionString(connectionString, 'EvidenciasTable');
            await tableClient.createTable(); // Garante que a tabela exista antes da leitura

            const evidencias = [];
            const listResults = tableClient.listEntities();

            // Percorre todos os registros do Azure Table Storage
            for await (const entity of listResults) {
                evidencias.push({
                    contrato: entity.contrato,
                    cidade: entity.cidade,
                    tecnico: entity.tecnico,
                    empresa: entity.empresa,
                    latitude: entity.latitude,
                    longitude: entity.longitude,
                    endereco: entity.endereco,
                    urlsFotos: entity.urlsFotos ? JSON.parse(entity.urlsFotos) : [],
                    dataHora: entity.dataHora || entity.timestamp
                });
            }

            // Ordena as evidências inicialmente por data decrescente (da mais recente para a mais antiga)
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
