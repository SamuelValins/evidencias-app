const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

app.http('salvarEvidencia', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            if (!connectionString) {
                return { 
                    status: 500, 
                    jsonBody: { error: 'Erro: A variável AZURE_STORAGE_CONNECTION_STRING não foi encontrada no ambiente do Azure.' } 
                };
            }

            const body = await request.json();
            
            // Extraindo "codigoBaixa" e o novo campo "observacao" do pacote recebido
            const { contrato, codigoBaixa, cidade, tecnico, empresa, servico, janela, localizacao, endereco, imagens, observacao } = body;

            // Validação de dados essenciais (observacao não entra no IF de erro pois é opcional)
            if (!contrato || !codigoBaixa || !cidade || !tecnico || !empresa || !servico || !janela || !imagens || imagens.length === 0) {
                return { status: 400, jsonBody: { error: 'Dados incompletos fornecidos no formulário.' } };
            }

            // --- SALVAR FOTOS NO BLOB STORAGE ---
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient('fotos-evidencias');
            await containerClient.createIfNotExists({ access: 'blob' });

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

            // --- SALVAR METADADOS NO TABLE STORAGE ---
            const tableClient = TableClient.fromConnectionString(connectionString, 'EvidenciasTable');
            await tableClient.createTable();

            const partitionKey = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const rowKey = `${contrato}-${Date.now()}`;

            // Objeto de persistência com todos os dados tratados
            const registroEvidencia = {
                partitionKey: partitionKey,
                rowKey: rowKey,
                contrato: contrato,
                codigoBaixa: codigoBaixa,
                cidade: cidade,
                tecnico: tecnico,
                empresa: empresa,
                servico: servico,  
                janela: janela,    
                observacao: observacao || '', // Salvando o campo observação (vazio se não fornecido)
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
            return { 
                status: 500, 
                jsonBody: { error: `Erro no servidor: ${error.message || error.toString()}` } 
            };
        }
    }
});
