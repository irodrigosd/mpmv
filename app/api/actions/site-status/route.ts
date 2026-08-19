import { requireBridgeAuth } from "@/lib/auth";
import { siteStatus } from "@/lib/mpmv";

export async function GET(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/";
  return Response.json(await siteStatus(path));
}
