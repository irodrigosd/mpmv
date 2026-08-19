export function requireBridgeAuth(request: Request): Response | null {
  const expected = process.env.MPMV_API_TOKEN;
  if (!expected) {
    return Response.json({ ok: false, error: "MPMV_API_TOKEN não configurado." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${expected}`) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  return null;
}
