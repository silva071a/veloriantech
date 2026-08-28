# VelorianTech

## Instalação
1. Instale Node.js.
2. Abra o terminal nesta pasta.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Coloque o Access Token do Mercado Pago em `MP_ACCESS_TOKEN`.
6. Execute `npm start`.
7. Abra `http://localhost:3000`.

## Segurança
Nunca coloque o Access Token no arquivo HTML ou envie o arquivo `.env` para GitHub.

## Antes de produção
- Teste os pagamentos com as credenciais de teste.
- Configure `BASE_URL` com o endereço HTTPS real da loja.
- Configure notificações/webhooks e um banco de dados para registrar pedidos aprovados.
