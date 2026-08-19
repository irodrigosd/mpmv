import { requireBridgeAuth } from "@/lib/auth";
import { publishBlogPost } from "@/lib/mpmv";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = requireBridgeAuth(request);
  if (denied) return denied;

  const body = await request.json();
  const slug = String(body.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return Response.json({ ok: false, error: "slug_invalid" }, { status: 400 });
  }
  if (typeof body.html !== "string" || body.html.length < 100) {
    return Response.json({ ok: false, error: "html_invalid" }, { status: 400 });
  }

  const result = await publishBlogPost({
    slug,
    html: body.html,
    seoTitle: body.seoTitle,
    metaDescription: body.metaDescription,
    focusKeyphrase: body.focusKeyphrase,
    secondaryKeyphrases: Array.isArray(body.secondaryKeyphrases) ? body.secondaryKeyphrases : undefined,
    category: body.category,
    author: body.author,
  });

  return Response.json(result);
}
