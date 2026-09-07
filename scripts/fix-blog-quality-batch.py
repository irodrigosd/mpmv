from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SLUGS = [
    "como-vender-pelo-instagram",
    "como-aumentar-alcance-no-instagram",
    "como-aumentar-engajamento-no-instagram",
    "como-fazer-carrossel-no-instagram",
    "como-criar-uma-oferta-irresistivel-sem-dar-desconto-nem-encher-de-bonus",
    "como-usar-ia-para-escrever-anuncios-que-vendem-sem-parecer-texto-de-ia",
    "por-que-o-cliente-adia-a-compra",
    "blocos-de-persuasao-e-frameworks",
    "prestacao-de-servico-produto-fisico-ou-infoproduto",
    "tijolo-da-supreme",
    "lado-sexy-da-persuasao",
    "quem-tenta-parecer-inteligente",
    "pagina-de-obrigado-que-vende",
    "por-que-clientes-escolhem-oferta-mais-cara",
    "efeito-dotacao-marketing",
    "reels-que-vendem",
    "aversao-ambiguidade-vendas",
    "assuntos-de-email-que-dao-vontade-de-abrir",
    "como-aumentar-a-conversao-da-landing-page-sem-gastar-mais-com-anuncios",
    "efeito-halo-vendas",
    "maneiras-antieticas-de-ganhar-dinheiro-com-persuasao",
    "desfile-7-de-setembro-razao-persuasiva",
    "com-licenca-obrigado-persuasao-vendas",
    "robert-cialdini-persuasao-sem-pressionar",
    "roteiros-cinematograficos-o-segredo-por-tras",
    "eugene-schwartz-copy-nao-cria-desejo",
    "russell-brunson-perfect-webinar-funnel",
    "clayton-makepeace-emocao-dominante",
    "rafael-albertoni-copywriting-negocio-brasil",
    "efeito-padrao-escolhas",
    "ganchos-para-reels",
]

DETAILS = {
    "como-vender-pelo-instagram": ("transformar atenção em conversa e oportunidade comercial", ["oferta clara na bio e no conteúdo", "prova compatível com a promessa", "CTA específico para cada peça", "continuidade entre post, Direct e página"]),
    "como-aumentar-alcance-no-instagram": ("aumentar a chance de distribuição sem depender de truques", ["assunto que já importa ao público", "gancho que entrega rápido a promessa", "razões reais para salvar e compartilhar", "análise de padrões em vários posts"]),
    "como-aumentar-engajamento-no-instagram": ("gerar respostas que indiquem interesse real, não apenas vaidade", ["pergunta fácil de responder", "opinião ou contraste que convida participação", "conteúdo útil para salvar", "CTA coerente com o estágio do público"]),
    "como-fazer-carrossel-no-instagram": ("conduzir a leitura slide por slide até uma ação clara", ["capa com promessa específica", "uma ideia principal por slide", "progressão sem repetir o mesmo argumento", "último slide com CTA coerente"]),
    "como-criar-uma-oferta-irresistivel-sem-dar-desconto-nem-encher-de-bonus": ("aumentar valor percebido sem transformar preço em muleta", ["resultado principal bem definido", "mecanismo fácil de entender", "redução de risco com prova e garantia responsável", "urgência apenas quando for verdadeira"]),
    "como-usar-ia-para-escrever-anuncios-que-vendem-sem-parecer-texto-de-ia": ("usar IA como apoio sem apagar a voz da marca", ["contexto real sobre público e oferta", "exemplos específicos em vez de clichês", "edição humana de ritmo e vocabulário", "provas e números somente quando confirmados"]),
    "por-que-o-cliente-adia-a-compra": ("reduzir incerteza antes de tentar aumentar pressão", ["clareza sobre o que acontece depois da compra", "prova para a objeção principal", "comparação simples entre agir e adiar", "próximo passo de baixo atrito"]),
    "blocos-de-persuasao-e-frameworks": ("montar mensagens por função, em vez de decorar fórmulas", ["bloco de atenção", "bloco de problema e consequência", "bloco de prova e mecanismo", "bloco de oferta e próxima ação"]),
    "prestacao-de-servico-produto-fisico-ou-infoproduto": ("adaptar a persuasão ao tipo de entrega que o cliente compra", ["serviço exige confiança na execução", "produto físico precisa tornar uso e resultado visíveis", "infoproduto precisa reduzir dúvida sobre aplicação", "a prova deve combinar com a natureza da oferta"]),
    "tijolo-da-supreme": ("entender como contexto e marca alteram valor percebido", ["significado cultural do produto", "escassez sem inventar disponibilidade", "coerência com a identidade da marca", "história que transforma objeto em símbolo"]),
    "lado-sexy-da-persuasao": ("usar desejo e estética sem esconder a substância da oferta", ["imagem que reforça a promessa", "benefício concreto por trás do apelo", "linguagem sensorial sem exagero", "prova que sustenta a atração inicial"]),
    "quem-tenta-parecer-inteligente": ("trocar complexidade performática por clareza que convence", ["frases curtas quando a ideia permitir", "exemplos antes de abstrações", "termos técnicos apenas quando necessários", "uma conclusão acionável por seção"]),
    "pagina-de-obrigado-que-vende": ("aproveitar o pós-cadastro sem quebrar confiança", ["confirmar o que acabou de acontecer", "entregar ou explicar o próximo passo", "apresentar uma oferta complementar coerente", "medir cliques e avanço no funil"]),
    "por-que-clientes-escolhem-oferta-mais-cara": ("mostrar por que preço não é o único critério de decisão", ["diferença percebida entre opções", "redução de risco", "sinais de qualidade e autoridade", "benefício que justifica o investimento"]),
    "efeito-dotacao-marketing": ("usar sensação de posse de forma ética para aumentar envolvimento", ["teste ou demonstração quando fizer sentido", "personalização que ajude a visualizar uso", "prova de valor antes da compra", "liberdade real para recusar"]),
    "reels-que-vendem": ("ligar retenção à intenção comercial", ["gancho conectado ao problema", "desenvolvimento sem enrolação", "prova ou demonstração curta", "CTA que continua a conversa"]),
    "aversao-ambiguidade-vendas": ("reduzir dúvida quando o cliente não consegue prever o resultado", ["explicar processo em etapas", "deixar limites e condições visíveis", "usar prova relevante", "responder a principal incerteza antes do CTA"]),
    "assuntos-de-email-que-dao-vontade-de-abrir": ("criar curiosidade sem enganar sobre o conteúdo do e-mail", ["benefício específico", "lacuna de curiosidade honesta", "linguagem compatível com o remetente", "teste de assuntos por padrão, não por um envio isolado"]),
    "como-aumentar-a-conversao-da-landing-page-sem-gastar-mais-com-anuncios": ("melhorar a página antes de comprar mais tráfego", ["promessa alinhada ao anúncio", "prova próxima da objeção", "CTA visível e específico", "menos fricção no formulário e na leitura"]),
    "efeito-halo-vendas": ("entender como uma impressão positiva contamina a percepção do restante", ["primeiro contato visual coerente", "prova de qualidade logo no início", "consistência entre marca e entrega", "evitar usar aparência para encobrir produto fraco"]),
    "maneiras-antieticas-de-ganhar-dinheiro-com-persuasao": ("reconhecer práticas manipulativas antes que elas virem estratégia", ["não fabricar prova social", "não inventar escassez", "não esconder condições importantes", "não explorar vulnerabilidade do público"]),
    "desfile-7-de-setembro-razao-persuasiva": ("ler símbolos, ritual e autoridade visual como arquitetura de atenção", ["símbolos que condensam significado", "ritual que cria reconhecimento", "ordem e escala que comunicam importância", "emoção coletiva que amplia percepção"]),
    "com-licenca-obrigado-persuasao-vendas": ("usar civilidade como sinal de respeito, não como técnica vazia", ["pedido claro em vez de imposição", "agradecimento específico", "tom compatível com a relação", "respeito pela possibilidade de recusa"]),
    "robert-cialdini-persuasao-sem-pressionar": ("aplicar princípios de influência com contexto e transparência", ["reciprocidade sem dívida artificial", "prova social verdadeira", "autoridade demonstrada", "escassez apenas quando existir"]),
    "roteiros-cinematograficos-o-segredo-por-tras": ("usar linguagem visual para manter atenção sem esconder a mensagem", ["abertura com tensão ou pergunta", "mudança visual a serviço da ideia", "progressão de cena e argumento", "fechamento que resolve a promessa"]),
    "eugene-schwartz-copy-nao-cria-desejo": ("canalizar desejo existente em vez de tentar fabricá-lo do zero", ["identificar desejo já presente", "entender nível de consciência", "escolher promessa compatível", "mostrar mecanismo que aproxima o resultado"]),
    "russell-brunson-perfect-webinar-funnel": ("organizar uma apresentação que move crenças antes da oferta", ["promessa central", "histórias que quebram objeções", "mecanismo da solução", "oferta apresentada como continuação lógica"]),
    "clayton-makepeace-emocao-dominante": ("encontrar a emoção que já move o mercado e dar direção a ela", ["nomear a tensão principal", "conectar emoção a consequência concreta", "usar prova para sustentar a promessa", "evitar dramatização que ultrapasse os fatos"]),
    "rafael-albertoni-copywriting-negocio-brasil": ("ligar copywriting a oferta, operação e resultado de negócio", ["entender mercado antes de escrever", "trabalhar promessa e mecanismo", "usar prova adequada", "medir resposta comercial da mensagem"]),
    "efeito-padrao-escolhas": ("entender como a opção predefinida influencia decisões", ["deixar a escolha padrão visível", "facilitar mudança de opção", "não esconder custos", "usar padrão para reduzir esforço, não para enganar"]),
    "ganchos-para-reels": ("fazer a primeira frase abrir uma pergunta que vale continuar ouvindo", ["benefício específico", "contraste que cria tensão", "curiosidade ligada ao tema", "entrega rápida depois do gancho"]),
}

FAVICON_BLOCK = (
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'
    '<link rel="alternate icon" type="image/png" href="/favicon.png">\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
)

ICON_RE = re.compile(r'<link\b[^>]*\brel=["\'][^"\']*(?:icon|apple-touch-icon)[^"\']*["\'][^>]*>\s*', re.I)
FOCUS_RE = re.compile(r'<meta\b[^>]*name=["\']mpmv:focus-keyphrase["\'][^>]*content=["\']([^"\']*)["\'][^>]*>', re.I)
TITLE_RE = re.compile(r'<title>(.*?)</title>', re.I | re.S)
DESC_RE = re.compile(r'<meta\b[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>', re.I)
TAG_RE = re.compile(r'<[^>]+>')
IMG_RE = re.compile(r'<img\b(?![^>]*\balt=)([^>]*)>', re.I)

def textify(s: str) -> str:
    return html.unescape(TAG_RE.sub(" ", s)).replace("\xa0", " ").strip()

def get_focus(source: str, slug: str) -> str:
    m = FOCUS_RE.search(source)
    if m and m.group(1).strip():
        return html.unescape(m.group(1).strip())
    title = TITLE_RE.search(source)
    if title:
        return textify(title.group(1)).split("|")[0].strip()
    return slug.replace("-", " ")

def quality_block(slug: str, focus: str) -> str:
    purpose, checks = DETAILS[slug]
    f = html.escape(focus)
    items = "".join(f"<li>{html.escape(item)}</li>" for item in checks)
    return (
        '\n<section class="mpmv-quality-boost">\n'
        f"<h2>{f}: como aplicar a ideia na prática</h2>\n"
        f"<p>Primeiro, use <strong>{f}</strong> com um objetivo claro: {html.escape(purpose)}. A técnica fica mais útil quando você sabe qual percepção ou comportamento deseja melhorar.</p>\n"
        "<p>Além disso, observe o contexto antes de escolher a frase, o formato ou o argumento. A mesma ideia pode funcionar de maneiras diferentes conforme o público, a oferta e o estágio da decisão.</p>\n"
        "<ul>\n" + items + "\n</ul>\n"
        "<p>Por exemplo, compare uma versão da mensagem com outra e mude apenas um elemento importante. Assim, fica mais fácil entender se o ganho veio do assunto, do gancho, da prova, da oferta ou do CTA.</p>\n"
        f"<p>Depois, revise se <strong>{f}</strong> está sendo usado para esclarecer a decisão. Se a técnica depende de esconder informação, criar pressão falsa ou prometer algo que a entrega não sustenta, ela precisa ser corrigida.</p>\n"
        "<p>Assim, a persuasão deixa de ser um enfeite no texto e passa a organizar a experiência. O leitor entende melhor o valor, encontra menos ruído e sabe qual é o próximo passo.</p>\n"
        "<p>Por fim, acompanhe o resultado em uma sequência de conteúdos ou páginas. Uma única publicação pode variar por horário, distribuição e contexto. Padrões repetidos são mais úteis para decidir o que manter.</p>\n"
        f"<p>Para aprofundar, veja também <a href=\"/blog/como-usar-persuasao-para-vender-mais/\">como usar persuasão para vender mais</a> e <a href=\"/blog/como-criar-posts-que-vendem-com-chatgpt/\">como criar posts que vendem com ChatGPT</a>. Esses dois guias ajudam a conectar <strong>{f}</strong> à mensagem e à próxima ação.</p>\n"
        "</section>\n"
    )

def add_alt(source: str, focus: str) -> str:
    alt = html.escape(focus, quote=True)
    return IMG_RE.sub(lambda m: f'<img alt="{alt}"{m.group(1)}>', source)

def insert_quality_block(source: str, slug: str, focus: str) -> str:
    if "mpmv-quality-boost" in source:
        return source
    block = quality_block(slug, focus)
    markers = [
        r'(<div\b[^>]*class=["\'][^"\']*\bcourse\b[^"\']*["\'][^>]*>)',
        r'(<section\b[^>]*class=["\'][^"\']*\bcta\b[^"\']*["\'][^>]*>)',
        r'(<h2\b[^>]*>\s*Perguntas frequentes)',
        r'(</article>)',
    ]
    for pattern in markers:
        if re.search(pattern, source, re.I):
            return re.sub(pattern, block + r"\1", source, count=1, flags=re.I)
    return source.replace("</body>", block + "</body>", 1)

def fix_meta_description(source: str, focus: str) -> str:
    m = DESC_RE.search(source)
    if not m:
        desc = f"Aprenda {focus} com um passo a passo prático, exemplos e princípios de persuasão para melhorar clareza, atenção e conversão."
        return source.replace("</title>", f'</title>\n<meta name="description" content="{html.escape(desc, quote=True)}">', 1)
    desc = html.unescape(m.group(1)).strip()
    if 115 <= len(desc) <= 160:
        return source
    candidate = f"Aprenda {focus} com um passo a passo prático, exemplos e princípios de persuasão para melhorar clareza, atenção e conversão sem exagerar promessas."
    if len(candidate) > 160:
        candidate = candidate[:157].rsplit(" ", 1)[0] + "..."
    if len(candidate) < 115:
        candidate += " Veja como aplicar a ideia de forma simples e responsável."
    candidate = candidate[:160]
    escaped = html.escape(candidate, quote=True)
    old = m.group(0)
    new = re.sub(r'content=["\'][^"\']*["\']', f'content="{escaped}"', old, count=1, flags=re.I)
    source = source[:m.start()] + new + source[m.end():]
    source = re.sub(
        r'(<meta\b[^>]*name=["\']mpmv:meta-description["\'][^>]*content=)["\'][^"\']*["\']',
        lambda mm: mm.group(1) + f'"{escaped}"',
        source,
        count=1,
        flags=re.I,
    )
    return source

def fix_one(slug: str) -> bool:
    path = ROOT / "blog" / slug / "index.html"
    if not path.exists():
        print(f"AVISO: arquivo não encontrado: {path.relative_to(ROOT)}")
        return False
    source = path.read_text(encoding="utf-8")
    original = source
    focus = get_focus(source, slug)
    source = ICON_RE.sub("", source)
    source = source.replace("</head>", FAVICON_BLOCK + "</head>", 1)
    source = fix_meta_description(source, focus)
    source = add_alt(source, focus)
    source = insert_quality_block(source, slug, focus)
    if source != original:
        path.write_text(source, encoding="utf-8")
        print(f"OK: {slug}")
        return True
    print(f"SEM ALTERAÇÃO: {slug}")
    return False

def main() -> None:
    changed = sum(1 for slug in SLUGS if fix_one(slug))
    print(f"Concluído: {changed}/{len(SLUGS)} artigo(s) alterado(s).")

if __name__ == "__main__":
    main()
