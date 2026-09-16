from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUB = "/blog/marketing-para-infoprodutores/"
MARKER = "data-mpmv-wave2-hub"

LINKS = {
    "como-criar-uma-pagina-de-vendas": ("estrutura de marketing para infoprodutores", ["página de vendas", "pagina de vendas"]),
    "como-aumentar-a-conversao-da-landing-page-sem-gastar-mais-com-anuncios": ("conversão no marketing para infoprodutos", ["conversão", "landing page"]),
    "como-criar-uma-campanha-de-vendas-sem-falar-do-produto": ("estratégia de vendas para infoprodutores", ["campanha", "vendas"]),
    "como-quebrar-objecoes-de-vendas": ("marketing e conversão para infoprodutores", ["objeção", "objecções", "objeções"]),
    "prova-social-no-marketing": ("estratégia de marketing para infoprodutos", ["prova social", "marketing"]),
    "prova-social-nas-vendas": ("prova e conversão em infoprodutos", ["prova social", "vendas"]),
    "como-usar-prova-social-sem-parecer-forcado": ("marketing para quem vende produtos digitais", ["prova social", "forçado", "forcado"]),
    "por-que-clientes-escolhem-oferta-mais-cara": ("estratégia de oferta para infoprodutores", ["oferta", "clientes"]),
    "psicologia-de-precos-para-infoprodutos": ("marketing de produtos digitais", ["preço", "preços", "precificação"]),
    "tripwire-oferta-de-entrada": ("estratégia de produtos digitais", ["tripwire", "oferta de entrada", "oferta"]),
    "order-bump-aumentar-ticket-medio-checkout": ("estratégia de vendas de infoprodutos", ["order bump", "ticket médio", "checkout"]),
    "remarketing-para-vendas": ("aquisição e conversão de clientes", ["remarketing", "vendas"]),
    "remarketing-inteligente-distribuicao-verba": ("estratégia de aquisição para infoprodutores", ["remarketing", "verba", "aquisição"]),
    "ryan-deiss-tecnica-anuncios": ("marketing para infoprodutores", ["Ryan Deiss", "anúncios", "anuncios"]),
    "dan-kennedy-marketing-antes-do-algoritmo": ("marketing direto para infoprodutores", ["Dan Kennedy", "marketing direto", "algoritmo"]),
}


def build_link(anchor: str) -> str:
    return (
        f'<p {MARKER}="1">Este tema faz parte de uma estratégia maior. Veja também '
        f'<a href="{HUB}" style="color:#2f6fff;font-weight:800;text-decoration:underline;text-underline-offset:3px">'
        f'{anchor}</a> para entender como ele se conecta ao marketing para infoprodutores.</p>'
    )


def insert_link(source: str, slug: str, anchor: str, terms: list[str]) -> str:
    if MARKER in source:
        return source

    start = source.find('<div class="reading">')
    if start == -1:
        start = source.find('<article')
    if start == -1:
        start = source.find('<main')
    if start == -1:
        raise RuntimeError(f"Não encontrei área de conteúdo em {slug}")

    lower = source.lower()
    for term in terms:
        pos = lower.find(term.lower(), start)
        if pos == -1:
            continue
        paragraph_start = source.rfind('<p', start, pos)
        paragraph_end = source.find('</p>', pos)
        if paragraph_start != -1 and paragraph_end != -1:
            at = paragraph_end + 4
            block = build_link(anchor)
            return source[:at] + "\n" + block + source[at:]

    first_p = source.find('<p', start)
    if first_p != -1:
        end = source.find('</p>', first_p)
        if end != -1:
            at = end + 4
            block = build_link(anchor)
            return source[:at] + "\n" + block + source[at:]

    raise RuntimeError(f"Não encontrei parágrafo para inserir link em {slug}")


changed = []
for slug, (anchor, terms) in LINKS.items():
    path = ROOT / "blog" / slug / "index.html"
    if not path.exists():
        raise FileNotFoundError(path)
    source = path.read_text(encoding="utf-8")
    updated = insert_link(source, slug, anchor, terms)
    if updated != source:
        path.write_text(updated, encoding="utf-8")
        changed.append(slug)

print(f"Onda 2: {len(changed)} artigos atualizados.")
for slug in changed:
    print(f"- {slug}")
