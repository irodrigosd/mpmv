import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { requireBridgeAuth } from "@/lib/auth";
import {
  createLead,
  githubStatus,
  listBlogPosts,
  listLeads,
  publishBlogPost,
  siteStatus,
  vercelStatus,
} from "@/lib/mpmv";

export const runtime = "nodejs";
export const maxDuration = 60;

function result(value: unknown) {
  const structuredContent = typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : { value };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent,
  };
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    "site_status",
    {
      title: "Status do site MPMV",
      description: "Verifica se uma rota do site Mais Persuasão, Mais Vendas está respondendo.",
      inputSchema: z.object({ path: z.string().max(200).default("/") }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path }) => result(await siteStatus(path)),
  );

  server.registerTool(
    "list_blog_posts",
    {
      title: "Listar artigos do blog",
      description: "Lista artigos registrados no manifesto do blog MPMV.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(20) }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ limit }) => result(await listBlogPosts(limit)),
  );

  server.registerTool(
    "list_leads",
    {
      title: "Listar leads",
      description: "Lista leads do MPMV pela API administrativa já ligada ao Brevo.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ limit, offset }) => result(await listLeads(limit, offset)),
  );

  server.registerTool(
    "create_lead",
    {
      title: "Criar ou atualizar lead",
      description: "Adiciona ou atualiza um contato na lista do Brevo usada pelo MPMV.",
      inputSchema: z.object({
        name: z.string().min(2).max(80),
        email: z.string().email().max(160),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ name, email }) => result(await createLead(name, email)),
  );

  server.registerTool(
    "github_status",
    {
      title: "Status do GitHub MPMV",
      description: "Consulta o estado público do repositório GitHub do MPMV.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => result(await githubStatus()),
  );

  server.registerTool(
    "vercel_status",
    {
      title: "Status dos deployments Vercel",
      description: "Lista os deployments de produção recentes do projeto MPMV na Vercel quando VERCEL_TOKEN estiver configurado.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => result(await vercelStatus()),
  );

  server.registerTool(
    "publish_blog_post",
    {
      title: "Publicar artigo no blog",
      description: "Publica ou atualiza um artigo sem ZIP. A API do site grava no GitHub e a integração GitHub→Vercel faz o deploy.",
      inputSchema: z.object({
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        html: z.string().min(100),
        seoTitle: z.string().max(90).optional(),
        metaDescription: z.string().max(220).optional(),
        focusKeyphrase: z.string().max(120).optional(),
        secondaryKeyphrases: z.array(z.string().max(120)).max(20).optional(),
        category: z.string().max(80).optional(),
        author: z.string().max(80).optional(),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (input) => result(await publishBlogPost(input)),
  );
});

async function authenticated(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;
  return handler(request);
}

export { authenticated as GET, authenticated as POST };
