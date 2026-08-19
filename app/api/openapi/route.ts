export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "MPMV Bridge API",
      version: "0.1.0",
      description: "API privada do Mais Persuasão, Mais Vendas para uso em GPT Actions e automações.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        PublishPost: {
          type: "object",
          required: ["slug", "html"],
          properties: {
            slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
            html: { type: "string", description: "HTML completo do artigo" },
            seoTitle: { type: "string" },
            metaDescription: { type: "string" },
            focusKeyphrase: { type: "string" },
            secondaryKeyphrases: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            author: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/actions/site-status": {
        get: {
          operationId: "getSiteStatus",
          summary: "Verificar uma rota do site MPMV",
          parameters: [{ name: "path", in: "query", schema: { type: "string", default: "/" } }],
          responses: { "200": { description: "Status da rota" } },
        },
      },
      "/api/actions/blog-posts": {
        get: {
          operationId: "listBlogPosts",
          summary: "Listar artigos do blog MPMV",
          parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }],
          responses: { "200": { description: "Lista de artigos" } },
        },
      },
      "/api/actions/leads": {
        get: {
          operationId: "listLeads",
          summary: "Listar leads do MPMV no Brevo",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: { "200": { description: "Lista de leads" } },
        },
        post: {
          operationId: "createLead",
          summary: "Criar ou atualizar lead no Brevo",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email"],
                  properties: { name: { type: "string" }, email: { type: "string", format: "email" } },
                },
              },
            },
          },
          responses: { "200": { description: "Lead criado ou atualizado" } },
        },
      },
      "/api/actions/github-status": {
        get: {
          operationId: "getGithubStatus",
          summary: "Consultar estado do repositório GitHub MPMV",
          responses: { "200": { description: "Estado do repositório" } },
        },
      },
      "/api/actions/vercel-status": {
        get: {
          operationId: "getVercelStatus",
          summary: "Consultar deployments recentes do MPMV",
          responses: { "200": { description: "Deployments recentes" } },
        },
      },
      "/api/actions/blog-publish": {
        post: {
          operationId: "publishBlogPost",
          summary: "Publicar ou atualizar artigo no blog MPMV sem ZIP",
          description: "Grava o artigo no GitHub pela API administrativa existente. A integração GitHub-Vercel executa o deploy.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { "$ref": "#/components/schemas/PublishPost" } } },
          },
          responses: { "200": { description: "Resultado da publicação" } },
        },
      },
    },
  });
}
