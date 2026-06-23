const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.http('salvarEvidencia', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { contrato, cidade, localizacao, endereco, imagens } = body;

            if (!contrato || !cidade || !imagens || imagens.length === 0) {
                return { status: 400, jsonBody: { error: 'Dados incompletos fornecidos.' } };
            }

            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient('fotos-evidencias');
            await containerClient.createIfNotExists({ publicAccess: 'blob' });

            const urlsImagens = [];

            for (let i = 0; i < imagens.length; i++) {
                const base64Data = imagens[i];
                const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches || matches.length !== 3) continue;

                const buffer = Buffer.from(matches[2], 'base64');
                const tipoImagem = matches[1];
                
                const nomeBlob = `${contrato}-${Date.now()}-${i}.jpg`;
                const blockBlobClient = containerClient.getBlockBlobClient(nomeBlob);

                await blockBlobClient.upload(buffer, buffer.length, {
                    blobHTTPHeaders: { blobContentType: tipoImagem }
                });

                urlsImagens.push(blockBlobClient.url);
            }

            const tableClient = TableClient.fromConnectionString(connectionString, 'EvidenciasTable');
            await tableClient.createTableIfNotExists();

            const partitionKey = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const rowKey = `${contrato}-${Date.now()}`;

            const registroEvidencia = {
                partitionKey: partitionKey,
                rowKey: rowKey,
                contrato: contrato,
                cidade: cidade,
                latitude: localizacao ? parseFloat(localizacao.latitude) : 0,
                longitude: localizacao ? parseFloat(localizacao.longitude) : 0,
                endereco: endereco || 'Não disponível',
                urlsFotos: JSON.stringify(urlsImagens),
                dataHora: new Date().toISOString()
            };

            await tableClient.createEntity(registroEvidencia);

            return { 
                status: 200, 
                jsonBody: { 
                    message: 'Evidência salva com sucesso no Azure!',
                    urls: urlsImagens 
                } 
            };

        } catch (error) {
            context.error('Erro ao processar salvamento:', error);
            return { status: 500, jsonBody: { error: 'Erro interno do servidor.' } };
        }
    }
});
