from pathlib import Path
import re

HUB = "/blog/marketing-para-infoprodutores/"
MARKER = 'data-mpmv-wave4-hub="1"'
STYLE = 'color:#2f6fff;font-weight:800;text-decoration:underline;text-underline-offset:3px'

TARGETS = {
    "o-que-e-copywriting": ("copywriting aplicado ao marketing de infoprodutos", "Copywriting bem aplicado começa antes da escrita: ele conecta pesquisa, mensagem e oferta. Para entender esse processo dentro de uma estratégia maior, veja também <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>copywriting aplicado ao marketing de infoprodutos</a>."),
    "metodo-aida-copywriting": ("copywriting para vender produtos digitais", "AIDA é uma estrutura de copy, mas funciona melhor quando está integrada ao restante da estratégia. Veja como ela se encaixa em <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>copywriting para vender produtos digitais</a>."),
    "formula-pas-copywriting": ("estrutura de copy para infoprodutos", "A fórmula PAS ajuda a organizar uma mensagem persuasiva, mas o contexto da oferta continua sendo decisivo. Entenda essa <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>estrutura de copy para infoprodutos</a>."),
    "como-fazer-research-copywriting": ("pesquisa para criar marketing mais relevante", "Antes de escrever, vale entender profundamente o público, suas dores e sua linguagem. Isso faz parte de uma <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>pesquisa para criar marketing mais relevante</a>."),
    "como-usar-persuasao-para-vender-mais": ("persuasão no marketing de infoprodutos", "Persuasão não é apenas escolher palavras fortes: ela precisa estar conectada à estratégia da oferta e da comunicação. Veja como aplicar <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>persuasão no marketing de infoprodutos</a>."),
    "gatilhos-mentais": ("gatilhos mentais aplicados ao marketing", "Gatilhos mentais funcionam melhor quando reforçam uma mensagem que já faz sentido para o público. Veja o papel dos <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>gatilhos mentais aplicados ao marketing</a>."),
    "gatilho-da-escassez": ("escassez em ofertas digitais", "Escassez pode influenciar a decisão, mas precisa ser verdadeira e coerente com a oferta. Entenda como trabalhar <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>escassez em ofertas digitais</a>."),
    "gatilho-da-reciprocidade": ("reciprocidade no marketing", "Entregar valor antes da venda pode fortalecer a relação com o público quando isso faz parte de uma estratégia consistente. Veja como usar <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>reciprocidade no marketing</a>."),
    "robert-cialdini-persuasao-sem-pressionar": ("persuasão aplicada ao marketing", "Os princípios de persuasão ganham força quando são usados dentro de uma estratégia clara de comunicação e oferta. Veja como aplicar <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>persuasão aplicada ao marketing</a>."),
    "eugene-schwartz-copy-nao-cria-desejo": ("copywriting e desejo no marketing", "A copy não cria do nada um desejo: ela encontra e organiza uma motivação que já existe no mercado. Isso ajuda a entender <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>copywriting e desejo no marketing</a>."),
    "clayton-makepeace-emocao-dominante": ("copywriting para vendas", "Uma mensagem de vendas precisa transformar compreensão em decisão sem perder a conexão com o público. Veja como isso se relaciona com <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>copywriting para vendas</a>."),
    "rafael-albertoni-copywriting-negocio-brasil": ("copywriting para negócios digitais", "Copywriting aplicado a negócios digitais precisa conversar com aquisição, oferta e conversão. Entenda esse contexto em <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>copywriting para negócios digitais</a>."),
    "leandro-ladeira-venda-todo-santo-dia": ("vendas recorrentes para infoprodutores", "Vender com frequência depende de mais do que uma boa copy: exige uma estrutura de aquisição, oferta e conversão. Veja como pensar em <a href=\"/blog/marketing-para-infoprodutores/\" style=\"%s\" %s>vendas recorrentes para infoprodutores</a>."),
}

def body_bounds(source):
    for tag in ("reading", "article", "main"):
        m = re.search(rf'<(?:div|article|main)[^>]*class=[\"\'][^\"\']*{tag}[^\"\']*[\"\'][^>]*>', source, re.I)
        if m:
            return m.start(), m.end()
    m = re.search(r'<main\b[^>]*>', source, re.I)
    if m:
        return m.start(), m.end()
    return None

def insert_link(source, slug, anchor, sentence):
    if MARKER in source:
        return source, False
    bounds = body_bounds(source)
    if not bounds:
        return source, False
    start, body_start = bounds
    body = source[body_start:]
    # Insert after the first real paragraph in the article body.
    p = re.search(r'</p>', body, re.I)
    if not p:
        return source, False
    paragraph = '<p %s>%s</p>' % (MARKER, sentence % (STYLE, MARKER))
    pos = body_start + p.end()
    return source[:pos] + '\n' + paragraph + source[pos:], True

def main():
    updated = 0
    found = 0
    for path in Path("blog").rglob("*.html"):
        source = path.read_text(encoding="utf-8")
        for slug, (anchor, sentence) in TARGETS.items():
            if slug not in str(path):
                continue
            found += 1
            new_source, changed = insert_link(source, slug, anchor, sentence)
            if changed:
                path.write_text(new_source, encoding="utf-8")
                updated += 1
            break
    print(f"Onda 4: {updated} artigos atualizados; {found} alvos encontrados.")
    if found < len(TARGETS):
        missing = [s for s in TARGETS if not any(s in str(p) for p in Path('blog').rglob('*.html'))]
        print("Alvos não encontrados:", ", ".join(missing))

if __name__ == "__main__":
    main()
