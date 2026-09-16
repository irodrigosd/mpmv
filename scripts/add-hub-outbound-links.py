from pathlib import Path

HUB = Path("blog/marketing-para-infoprodutores/index.html")
MARKER = 'data-mpmv-hub-outbound="1"'
STYLE = 'color:#2f6fff;font-weight:800;text-decoration:underline;text-underline-offset:3px'

LINKS = {
    "/blog/posicionamento-unico-de-vendas/": "posicionamento para infoprodutores",
    "/blog/como-criar-promessa-de-vendas/": "promessa de vendas",
    "/blog/valor-percebido-cursos-online/": "percepção de valor em infoprodutos",
    "/blog/como-criar-uma-pagina-de-vendas/": "página de vendas para infoprodutos",
    "/blog/como-aumentar-a-conversao-da-landing-page-sem-gastar-mais-com-anuncios/": "conversão da landing page",
    "/blog/como-criar-uma-isca-digital/": "isca digital para gerar leads",
    "/blog/nutricao-de-leads/": "nutrição de leads",
    "/blog/qualificacao-de-leads/": "qualificação de leads",
    "/blog/funil-de-vendas-previsivel/": "funil de vendas previsível",
    "/blog/remarketing-inteligente-distribuicao-verba/": "remarketing e distribuição de verba",
}


def link(path, text):
    return f'<a class="internal" href="{path}" style="{STYLE}">{text}</a>'


def main():
    html = HUB.read_text(encoding="utf-8")
    if MARKER in html:
        print("Hub já possui os links de saída da auditoria.")
        return

    replacements = [
        (
            '<p>Se essa base estiver clara, o conteúdo deixa de ser uma coleção de assuntos e começa a reforçar uma posição.</p>',
            '<p>Se essa base estiver clara, o conteúdo deixa de ser uma coleção de assuntos e começa a reforçar uma posição. Para aprofundar essa parte, veja <span data-mpmv-hub-outbound="1">'+link('/blog/posicionamento-unico-de-vendas/', 'posicionamento para infoprodutores')+'</span>.</p>'
        ),
        (
            '<p>Por isso, uma boa oferta organiza pelo menos:</p>',
            '<p>Por isso, uma boa oferta organiza pelo menos estes pontos. Antes de detalhar a entrega, vale aprofundar <span data-mpmv-hub-outbound="1">'+link('/blog/como-criar-promessa-de-vendas/', 'a promessa de vendas')+'</span> e <span data-mpmv-hub-outbound="1">'+link('/blog/valor-percebido-cursos-online/', 'a percepção de valor em infoprodutos')+'</span>.</p>'
        ),
        (
            '<p>Por isso, quando o <a class="internal" href="/blog/roas-baixo/">ROAS está baixo</a>, a pergunta não deveria ser apenas “como melhorar o anúncio?”. O diagnóstico precisa percorrer o caminho inteiro.</p>',
            '<p>Por isso, quando o <a class="internal" href="/blog/roas-baixo/">ROAS está baixo</a>, a pergunta não deveria ser apenas “como melhorar o anúncio?”. O diagnóstico precisa percorrer o caminho inteiro. Se o problema aparece depois do clique, aprofunde <span data-mpmv-hub-outbound="1">'+link('/blog/como-criar-uma-pagina-de-vendas/', 'a estrutura da página de vendas')+'</span> e <span data-mpmv-hub-outbound="1">'+link('/blog/como-aumentar-a-conversao-da-landing-page-sem-gastar-mais-com-anuncios/', 'a conversão da landing page')+'</span>.</p>'
        ),
        (
            '<p>Uma estratégia de leads precisa responder:</p>',
            '<p>Uma estratégia de leads precisa responder: se você ainda não tem uma porta de entrada clara, veja como criar uma <span data-mpmv-hub-outbound="1">'+link('/blog/como-criar-uma-isca-digital/', 'isca digital para gerar leads')+'</span>.</p>'
        ),
        (
            '<p>O erro comum é transformar a captura em objetivo final. O cadastro é uma etapa. O que acontece depois é parte do marketing.</p>',
            '<p>O erro comum é transformar a captura em objetivo final. O cadastro é uma etapa. O que acontece depois é parte do marketing: <span data-mpmv-hub-outbound="1">'+link('/blog/nutricao-de-leads/', 'nutrição de leads')+'</span> e <span data-mpmv-hub-outbound="1">'+link('/blog/qualificacao-de-leads/', 'qualificação de leads')+'</span> ajudam a organizar essa passagem.</p>'
        ),
        (
            '<p>Veja também o artigo <a class="internal" href="/blog/funil-de-vendas-onde-a-venda-trava/">Funil de vendas: como identificar onde a venda está travando</a>. Ele aprofunda o diagnóstico sem substituir este guia de estratégia.</p>',
            '<p>Veja também o artigo <a class="internal" href="/blog/funil-de-vendas-onde-a-venda-trava/">Funil de vendas: como identificar onde a venda está travando</a>. Para quem quer sair do diagnóstico pontual e organizar o processo, veja também o <span data-mpmv-hub-outbound="1">'+link('/blog/funil-de-vendas-previsivel/', 'funil de vendas previsível')+'</span>. Ele aprofunda o diagnóstico sem substituir este guia de estratégia.</p>'
        ),
        (
            '<p>Também vale separar problemas de volume de problemas de conversão. Se quase ninguém chega, talvez a prioridade esteja na aquisição. Se muita gente chega e ninguém avança, talvez o gargalo esteja depois do clique.</p>',
            '<p>Também vale separar problemas de volume de problemas de conversão. Se quase ninguém chega, talvez a prioridade esteja na aquisição. Se muita gente chega e ninguém avança, talvez o gargalo esteja depois do clique. Quando parte da audiência já demonstrou interesse, o <span data-mpmv-hub-outbound="1">'+link('/blog/remarketing-inteligente-distribuicao-verba/', 'remarketing e a distribuição de verba')+'</span> entra como uma etapa específica da estratégia.</p>'
        ),
    ]

    changed = 0
    for old, new in replacements:
        if old in html:
            html = html.replace(old, new, 1)
            changed += 1

    if changed != len(replacements):
        raise SystemExit(f"Esperado {len(replacements)} pontos de inserção, encontrados {changed}. Nenhuma alteração foi gravada.")

    HUB.write_text(html, encoding="utf-8")
    print(f"Hub outbound: {len(LINKS)} destinos estratégicos preparados em {changed} pontos contextuais.")


if __name__ == "__main__":
    main()
