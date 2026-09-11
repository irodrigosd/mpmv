from pathlib import Path

path = Path('blog/erro-chatgpt-conteudo-de-vendas/index.html')
s = path.read_text(encoding='utf-8')

replacements = [
    ('<title>ChatGPT para Escrever Copy: o Erro que Custa Vendas | MPMV</title>', '<title>ChatGPT para Escrever Copy: Como Evitar Textos Genéricos | MPMV</title>'),
    ('<meta name="description" content="Usar ChatGPT para escrever copy sem estratégia pode deixar sua comunicação genérica. Veja como usar IA para acelerar a produção sem perder persuasão e conversão.">', '<meta name="description" content="Aprenda como usar ChatGPT para escrever copy com estratégia, contexto e revisão humana, evitando textos genéricos e criando mensagens que ajudam a vender.">'),
    ('<meta name="mpmv:seo-title" content="ChatGPT para Escrever Copy: o Erro que Custa Vendas | MPMV">', '<meta name="mpmv:seo-title" content="ChatGPT para Escrever Copy: Como Evitar Textos Genéricos | MPMV">'),
    ('<meta name="mpmv:meta-description" content="Usar ChatGPT para escrever copy sem estratégia pode deixar sua comunicação genérica. Veja como usar IA para acelerar a produção sem perder persuasão e conversão.">', '<meta name="mpmv:meta-description" content="Aprenda como usar ChatGPT para escrever copy com estratégia, contexto e revisão humana, evitando textos genéricos e criando mensagens que ajudam a vender.">'),
    ('<meta property="og:title" content="O problema de usar o ChatGPT para escrever suas copies sem uma estratégia">', '<meta property="og:title" content="ChatGPT para escrever copy: como evitar textos genéricos">'),
    ('<meta property="og:description" content="ChatGPT acelera a escrita. Mas, sem estratégia, ele também pode acelerar a produção de uma comunicação que não convence ninguém.">', '<meta property="og:description" content="Entenda como usar ChatGPT para escrever copy sem deixar sua comunicação genérica ou perder a estratégia por trás da oferta.">'),
    ('<meta name="twitter:title" content="O problema de usar o ChatGPT para escrever suas copies sem uma estratégia">', '<meta name="twitter:title" content="ChatGPT para escrever copy: como evitar textos genéricos">'),
    ('<meta name="twitter:description" content="Como usar IA para acelerar sua copy sem transformar sua comunicação em mais um texto genérico da internet.">', '<meta name="twitter:description" content="Como usar ChatGPT para escrever copy com estratégia, contexto e revisão humana, sem transformar sua comunicação em texto genérico.">'),
    ('"headline":"O problema de usar o ChatGPT para escrever suas copies sem uma estratégia"', '"headline":"ChatGPT para escrever copy: como evitar textos genéricos"'),
    ('"description":"Usar ChatGPT para escrever copy sem estratégia pode deixar sua comunicação genérica. Veja como usar IA para acelerar a produção sem perder persuasão e conversão."', '"description":"Aprenda como usar ChatGPT para escrever copy com estratégia, contexto e revisão humana, evitando textos genéricos e criando mensagens que ajudam a vender."'),
    ('"image":"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=85"', '"image":["https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=85","https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=85","https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=85"]'),
    ('<h1>O problema de usar o <span class="accent">ChatGPT para escrever suas copies</span> sem uma estratégia</h1>', '<h1><span class="accent">ChatGPT para escrever copy:</span> o problema não é a IA, é a falta de estratégia</h1>'),
    ('<p class="intro"><strong>Se você abre o ChatGPT, escreve “crie uma copy persuasiva para meu produto” e publica o resultado quase do jeito que veio, o problema não é o ChatGPT.</strong></p>', '<p class="intro"><strong>Se você usa ChatGPT para escrever copy, mas publica a primeira resposta quase do jeito que veio, o problema não é a ferramenta.</strong></p>\n<p>O problema é começar pelo texto antes de definir <strong>quem precisa ser convencido, o que essa pessoa precisa acreditar e qual ação você quer que ela tome</strong>.</p>'),
    ('<h2 id="estrategia">O que precisa ser decidido antes da copy</h2>', '<h2 id="estrategia">Como usar ChatGPT para escrever copy com estratégia</h2>'),
    ('<h2 id="prompt">Por que um prompt maior não resolve tudo</h2>', '<h2 id="prompt">Prompt para ChatGPT escrever copy: por que tamanho não resolve</h2>'),
    ('alt="Notebook aberto durante planejamento de conteúdo e escrita"', 'alt="Planejamento de conteúdo antes de usar ChatGPT para escrever copy"'),
    ('alt="Equipe analisando estratégia e dados em uma mesa"', 'alt="Equipe analisando estratégia, dados e copy antes da escrita"'),
    ('alt="Capa do Guia Prático Persuasão pra Vender Todo Santo Dia"', 'alt="Guia Prático Persuasão pra Vender Todo Santo Dia sobre persuasão e vendas"'),
    ('"keywords":["ChatGPT para escrever copy","ChatGPT para copywriting","copywriting com IA","IA para escrever copy","copy persuasiva"]', '"keywords":["ChatGPT para escrever copy","como usar ChatGPT para escrever copy","ChatGPT para copywriting","copywriting com IA","copy persuasiva","IA para escrever copy"]'),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Trecho esperado não encontrado: {old[:120]}')
    s = s.replace(old, new, 1)

path.write_text(s, encoding='utf-8')
print('SEO do artigo otimizado com sucesso.')
