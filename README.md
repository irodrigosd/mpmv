# MPMV — Landing Page para Vercel

Projeto pronto para GitHub + Vercel, convertido da versão WordPress.

## Deploy

1. Crie um repositório no GitHub e envie todo o conteúdo desta pasta para a raiz do repositório.
2. Na Vercel, clique em **Add New > Project** e importe o repositório.
3. Não é necessário escolher framework nem comando de build.
4. Em **Settings > Environment Variables**, crie:
   - `BREVO_API_KEY`: sua chave API v3 da Brevo.
   - `BREVO_LIST_ID`: `5` (ou o ID da lista que desejar).
5. Faça o deploy.

## O que já está funcionando

- Landing page responsiva.
- Modal de captura de nome e e-mail.
- Envio do lead para a Brevo por uma função serverless, sem expor a chave no navegador.
- Lista Brevo padrão: ID 5.
- Download automático do PDF após cadastro aceito pela Brevo.
- Política de Privacidade em `/politica-de-privacidade`.
- Banner de cookies.
- Favicon e imagem de compartilhamento.

## Importante

A chave da Brevo não está incluída no projeto. Isso é proposital: nunca publique a chave no GitHub. Cadastre-a apenas nas Environment Variables da Vercel.

A antiga área `/leads` do WordPress não existe nesta versão. Os contatos ficam na Brevo, que passa a ser a fonte principal dos leads e do workflow de e-mails.
