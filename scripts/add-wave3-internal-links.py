from pathlib import Path
import re

HUB = "/blog/marketing-para-infoprodutores/"
STYLE = 'style="color:#2f6fff;font-weight:800;text-decoration:underline;text-underline-offset:3px"'
MARKER = 'data-mpmv-wave3-hub="1"'

MAPPINGS = {
    "stories-que-vendem": "conteúdo que vende para infoprodutores",
    "reels-que-vendem": "conteúdo para vender produtos digitais",
    "roteiro-para-reels": "estratégia de conteúdo para infoprodutores",
    "como-vender-pelo-instagram": "marketing para vender pelo Instagram",
    "como-vender-pelo-direct-do-instagram": "vendas e relacionamento com clientes",
    "como-fazer-carrossel-no-instagram": "conteúdo estratégico para infoprodutores",
    "copy-para-instagram": "copy para marketing de infoprodutos",
    "copy-para-whatsapp": "comunicação de vendas para infoprodutores",
    "storytelling-para-vender-sem-inventar-historias": "conteúdo e storytelling para vender",
    "como-criar-posts-que-vendem-com-chatgpt": "produção de conteúdo para infoprodutores",
    "erro-chatgpt-conteudo-de-vendas": "conteúdo de vendas para infoprodutores",
    "calendario-de-conteudo-com-chatgpt": "planejamento de conteúdo para infoprodutores",
}


def insert_link(source: str, anchor: str) -> tuple[str, bool]:
    if MARKER in source:
        return source, False

    paragraph = (
        f'<p {MARKER}>Este tema faz parte de uma estratégia maior. Veja também '
        f'<a href="{HUB}" {STYLE}>{anchor}</a> para entender como ele se conecta ao '
        'marketing para infoprodutores.</p>\n'
    )

    # Only alter the article body, never navigation/footer/templates.
    article_match = re.search(r'(<article(?:\s[^>]*)?>)(.*?)(</article>)', source, flags=re.I | re.S)
    if not article_match:
        return source, False

    body = article_match.group(2)
    # Insert after the first substantive paragraph in the article.
    p_match = re.search(r'</p>', body, flags=re.I)
    if not p_match:
        return source, False

    pos = p_match.end()
    new_body = body[:pos] + '\n' + paragraph + body[pos:]
    return source[:article_match.start(2)] + new_body + source[article_match.end(2):], True


changed = []
for slug, anchor in MAPPINGS.items():
    path = Path("blog") / slug / "index.html"
    if not path.exists():
        print(f"[ERRO] arquivo não encontrado: {path}")
        continue
    source = path.read_text(encoding="utf-8")
    updated, did_change = insert_link(source, anchor)
    if did_change:
        path.write_text(updated, encoding="utf-8")
        changed.append(slug)
        print(f"[OK] {slug} -> {anchor}")
    else:
        print(f"[SKIP] {slug}")

print(f"Onda 3: {len(changed)}/{len(MAPPINGS)} artigos atualizados.")
if len(changed) not in (0, len(MAPPINGS)):
    raise SystemExit("Execução parcial: interrompendo para evitar onda incompleta.")
