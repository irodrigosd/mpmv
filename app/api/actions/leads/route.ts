import { requireBridgeAuth } from "@/lib/auth";
import { createLead, listLeads } from "@/lib/mpmv";

export async function GET(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  return Response.json(await listLeads(limit, offset));
}

export async function POST(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;

  const body = await request.json();
  return Response.json(await createLead(String(body.name || ""), String(body.email || "")));
}
