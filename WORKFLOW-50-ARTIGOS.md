# Workflow MPMV — 50 artigos em lote

## Objetivo
Transformar uma lista de temas em artigos publicáveis com SEO, legibilidade, schema, links internos, CTA e arquivos técnicos do blog.

## Pipeline
1. Criar a lista completa de temas.
2. Definir uma intenção de busca única por artigo.
3. Criar ficha SEO: título editorial, SEO title, meta description, focus keyphrase, secundárias, slug e canonical.
4. Agrupar temas por cluster.
5. Gerar artigos usando um template visual fixo e conteúdo original.
6. Inserir FAQ, BlogPosting e Breadcrumb em JSON-LD.
7. Inserir links internos e CTA contextual.
8. Rodar auditoria objetiva de SEO e legibilidade.
9. Gerar lista de falhas por critério.
10. Corrigir apenas os artigos que falharam.
11. Atualizar blog.html.
12. Atualizar sitemap.xml.
13. Atualizar vercel.json.
14. Atualizar data/blog-posts.json.
15. Validar URLs e metadados.
16. Empacotar em ZIP.
17. Se o upload ficar pesado, dividir em pacotes menores (ex.: 5 ZIPs de 10 artigos).
18. Publicar, verificar deploy e acompanhar indexação.

## Regra de ouro
Não peça “50 artigos”. Peça um sistema capaz de gerar, auditar e publicar 50 artigos.

## O que automatizar
- configuração SEO;
- geração de HTML;
- schema;
- contagem de palavras;
- checagem de keyphrase;
- média de palavras por frase;
- tamanho médio de parágrafo;
- criação de cards;
- sitemap;
- rotas;
- arquivo de dados;
- compactação.

## O que revisar com mais cuidado
- fatos e estatísticas;
- fontes;
- promessa editorial;
- duplicação de intenção;
- exemplos;
- claims absolutos;
- coerência do CTA;
- links quebrados;
- canonical e slug.

## Aprendizado do nosso lote
O pacote único com 50 artigos ficou grande para o fluxo de upload. A solução foi dividir em 5 ZIPs com 10 artigos. Essa regra agora faz parte do workflow.
