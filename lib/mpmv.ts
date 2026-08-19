import { fetchJson } from "./http";

const DEFAULT_BASE_URL = "https://www.maispersuasaomaisvendas.com.br";
const DEFAULT_REPO = "irodrigosd/mpmv";

export function baseUrl() {
  return String(process.env.MPMV_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

export async function siteStatus(path = "/") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl()}${cleanPath}`;
  const response = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store" });
  return {
    ok: response.ok,
    status: response.status,
    requestedPath: cleanPath,
    finalUrl: response.url,
  };
}

export async function listBlogPosts(limit = 20) {
  const data = await fetchJson(`${baseUrl()}/data/blog-posts.json`);
  const posts = Array.isArray(data) ? data.slice(0, Math.min(Math.max(limit, 1), 100)) : [];
  return { count: posts.length, posts };
}

export async function listLeads(limit = 50, offset = 0) {
  const token = process.env.LEADS_ADMIN_TOKEN;
  if (!token) throw new Error("LEADS_ADMIN_TOKEN não configurado no gateway.");

  return fetchJson(`${baseUrl()}/api/leads?limit=${limit}&offset=${offset}`, {
    headers: { "x-admin-token": token },
  });
}

export async function createLead(name: string, email: string) {
  return fetchJson(`${baseUrl()}/api/leads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
}

type PublishInput = {
  slug: string;
  html: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyphrase?: string;
  secondaryKeyphrases?: string[];
  category?: string;
  author?: string;
};

function makeSeoText(input: PublishInput) {
  const lines = [
    "SLUG",
    input.slug,
    "",
    "TÍTULO SEO",
    input.seoTitle || "",
    "",
    "META DESCRIPTION",
    input.metaDescription || "",
    "",
    "PALAVRA-CHAVE PRINCIPAL",
    input.focusKeyphrase || input.slug.replace(/-/g, " "),
    "",
    "PALAVRAS-CHAVE SECUNDÁRIAS",
    ...(input.secondaryKeyphrases || []),
    "",
    "CATEGORIA",
    input.category || "Conteúdo",
    "",
    "AUTOR",
    input.author || "Rodrigo Castro",
  ];
  return `${lines.join("\n").trim()}\n`;
}

export async function publishBlogPost(input: PublishInput) {
  const token = process.env.ADMIN_BLOG_TOKEN;
  if (!token) throw new Error("ADMIN_BLOG_TOKEN não configurado no gateway.");

  const seoText = makeSeoText(input);
  const files = [
    { path: "index.html", content: Buffer.from(input.html, "utf8").toString("base64") },
    { path: "seo.txt", content: Buffer.from(seoText, "utf8").toString("base64") },
  ];

  return fetchJson(`${baseUrl()}/api/admin-blog-upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": token,
    },
    body: JSON.stringify({ zipName: `mcp-${input.slug}`, files }),
  });
}

export async function githubStatus() {
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MPMV-MCP",
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);

  return {
    repository: data.full_name,
    defaultBranch: data.default_branch,
    private: data.private,
    archived: data.archived,
    pushedAt: data.pushed_at,
    updatedAt: data.updated_at,
    openIssues: data.open_issues_count,
  };
}

export async function vercelStatus() {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return {
      configured: false,
      message: "Configure VERCEL_TOKEN e VERCEL_PROJECT_ID para consultar deployments pelo gateway.",
    };
  }

  const params = new URLSearchParams({ projectId, limit: "5", target: "production" });
  if (teamId) params.set("teamId", teamId);

  const data = await fetchJson(`https://api.vercel.com/v7/deployments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const deployments = Array.isArray(data.deployments)
    ? data.deployments.map((item: any) => ({
        id: item.uid || item.id,
        name: item.name,
        state: item.state,
        url: item.url ? `https://${item.url}` : "",
        createdAt: item.createdAt || item.created,
        target: item.target,
      }))
    : [];

  return { configured: true, count: deployments.length, deployments };
}
