from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HUB = "/blog/marketing-para-infoprodutores/"
MARKER = "data-mpmv-wave1-hub"

LINKS = {
    "persuasao-para-infoprodutores": ("persuasão para infoprodutores", "persuasão ajuda a transformar argumento em mensagem, prova e ação"),
    "bullet-points-de-vendas-infoprodutos": ("marketing para vender infoprodutos", "bullet points funcionam melhor quando fazem parte de uma estratégia maior de comunicação"),
    "funil-de-vendas-onde-a-venda-trava": ("estratégia de marketing para infoprodutores", "identificar onde a venda trava é parte do diagnóstico do sistema de marketing"),
    "funil-de-vendas-previsivel": ("marketing para infoprodutores", "um funil previsível depende de mensagem, oferta, aquisição e conversão trabalhando juntos"),
    "conteudo-para-cada-etapa-do-funil-de-vendas": ("marketing de conteúdo para infoprodutores", "conteúdo precisa cumprir uma função diferente conforme a etapa da jornada"),
    "roas-baixo": ("estratégia de marketing para infoprodutos", "ROAS baixo pode ser consequência de problemas que vão além do anúncio"),
    "como-criar-uma-isca-digital": ("geração de leads para infoprodutores", "uma isca digital faz parte de uma estratégia de aquisição e relacionamento"),
    "nutricao-de-leads": ("marketing para infoprodutores", "nutrição de leads conecta conteúdo, contexto e decisão de compra"),
    "qualificacao-de-leads": ("atração e conversão de leads", "qualificar leads ajuda a separar atenção de oportunidade comercial"),
    "lead-quente-lead-frio": ("estratégia de aquisição de clientes", "a temperatura do lead muda a abordagem de aquisição e conversão"),
    "como-criar-uma-oferta-irresistivel-sem-dar-desconto-nem-encher-de-bonus": ("estratégia de marketing para infoprodutos", "uma oferta forte precisa estar conectada ao restante da estratégia de marketing"),
    "como-criar-promessa-de-vendas": ("posicionamento e oferta para infoprodutores", "a promessa precisa conversar com posicionamento, oferta e percepção de valor"),
    "posicionamento-unico-de-vendas": ("posicionamento para infoprodutores", "posicionamento define como a oferta entra na cabeça do mercado antes mesmo da venda"),
    "valor-percebido-cursos-online": ("percepção de valor em infoprodutos", "valor percebido é uma peça importante da decisão, mas não existe isolado da oferta e da comunicação"),
    "garantia-para-infoproduto": ("oferta de um infoproduto", "garantia é uma parte da arquitetura da oferta e da redução de risco"),
}


def build_link(anchor: str, context: str) -> str:
    return (
        f'<p {MARKER}="1">'
        f'{context.capitalize()}. Veja também <a href="{HUB}" '
        f'style="color:#2f6fff;font-weight:800;text-decoration:underline;text-underline-offset:3px">'
        f'{anchor}</a> para conectar este tema ao quadro mais amplo de marketing para infoprodutores.</p>'
    )


def insert_link(source: str, slug: str, anchor: str, context: str) -> str:
    if MARKER in source or f'href="{HUB}"' in source:
        return source

    block = build_link(anchor, context)
    reading_start = source.find('<div class="reading">')
    if reading_start == -1:
        reading_start = source.find('<article')
    if reading_start == -1:
        reading_start = source.find('<main')
    if reading_start == -1:
        raise RuntimeError(f"Não encontrei área de conteúdo em {slug}")

    preferred_terms = {
        "persuasao-para-infoprodutores": ["Persuasão para infoprodutores", "persuasão"],
        "bullet-points-de-vendas-infoprodutos": ["bullet", "benefício", "venda"],
        "funil-de-vendas-onde-a-venda-trava": ["funil", "venda trava", "vendas"],
        "funil-de-vendas-previsivel": ["funil", "previsível", "previsivel"],
        "conteudo-para-cada-etapa-do-funil-de-vendas": ["conteúdo", "funil", "etapa"],
        "roas-baixo": ["ROAS", "tráfego", "anúncio"],
        "como-criar-uma-isca-digital": ["isca", "lead", "leads"],
        "nutricao-de-leads": ["nutrição", "lead", "leads"],
        "qualificacao-de-leads": ["qualificação", "lead", "leads"],
        "lead-quente-lead-frio": ["lead quente", "lead frio", "lead"],
        "como-criar-uma-oferta-irresistivel-sem-dar-desconto-nem-encher-de-bonus": ["oferta", "bônus", "desconto"],
        "como-criar-promessa-de-vendas": ["promessa", "vendas", "oferta"],
        "posicionamento-unico-de-vendas": ["posicionamento", "mercado", "oferta"],
        "valor-percebido-cursos-online": ["valor percebido", "valor", "curso"],
        "garantia-para-infoproduto": ["garantia", "risco", "oferta"],
    }[slug]

    lower = source.lower()
    search_from = reading_start
    for term in preferred_terms:
        pos = lower.find(term.lower(), search_from)
        if pos == -1:
            continue
        paragraph_start = source.rfind('<p', search_from, pos)
        paragraph_end = source.find('</p>', pos)
        if paragraph_start != -1 and paragraph_end != -1:
            insert_at = paragraph_end + 4
            return source[:insert_at] + "\n" + block + source[insert_at:]

    first_p = source.find('<p', reading_start)
    if first_p != -1:
        end = source.find('</p>', first_p)
        if end != -1:
            insert_at = end + 4
            return source[:insert_at] + "\n" + block + source[insert_at:]

    raise RuntimeError(f"Não encontrei parágrafo para inserir link em {slug}")


changed = []
for slug, (anchor, context) in LINKS.items():
    path = ROOT / "blog" / slug / "index.html"
    if not path.exists():
        raise FileNotFoundError(path)
    source = path.read_text(encoding="utf-8")
    updated = insert_link(source, slug, anchor, context)
    if updated != source:
        path.write_text(updated, encoding="utf-8")
        changed.append(slug)

print(f"Onda 1: {len(changed)} artigos atualizados.")
for slug in changed:
    print(f"- {slug}")
