import { requireBridgeAuth } from "@/lib/auth";
import { vercelStatus } from "@/lib/mpmv";

export async function GET(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;
  return Response.json(await vercelStatus());
}
