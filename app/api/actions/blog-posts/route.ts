import { requireBridgeAuth } from "@/lib/auth";
import { listBlogPosts } from "@/lib/mpmv";

export async function GET(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
  return Response.json(await listBlogPosts(limit));
}
