export async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let data: any = text;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Mantém texto bruto quando a resposta não é JSON.
  }

  if (!response.ok) {
    const detail = typeof data === "string" ? data.slice(0, 400) : JSON.stringify(data).slice(0, 400);
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return data;
}
