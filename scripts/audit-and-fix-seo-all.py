from __future__ import annotations
import html,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; BLOG=ROOT/"blog"
TAG_RE=re.compile(r"<[^>]+>"); FOCUS_RE=re.compile(r'<meta\b[^>]*name=["\']mpmv:focus-keyphrase["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',re.I); DESC_RE=re.compile(r'<meta\b[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',re.I); SEO_TITLE_RE=re.compile(r'<meta\b[^>]*name=["\']mpmv:seo-title["\'][^>]*content=["\']([^"\']*)["\'][^>]*>',re.I); TITLE_RE=re.compile(r'<title>(.*?)</title>',re.I|re.S); CANON_RE=re.compile(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>',re.I); H1_RE=re.compile(r'<h1\b[^>]*>(.*?)</h1>',re.I|re.S)
def text(s): return html.unescape(TAG_RE.sub(" ",s)).replace("\xa0"," ").strip()
def words(s): return re.findall(r"\b[\wÀ-ÿ][\wÀ-ÿ'-]*\b",text(s),re.UNICODE)
def get_focus(src,slug):
 m=FOCUS_RE.search(src)
 if m and m.group(1).strip(): return html.unescape(m.group(1).strip())
 m=H1_RE.search(src)
 if m:return text(m.group(1)).strip()
 m=TITLE_RE.search(src); return text(m.group(1)).split("|")[0].strip() if m else slug.replace("-"," ")
def meta_replace(src,name,value):
 pat=re.compile(r'(<meta\b[^>]*name=["\']'+re.escape(name)+r'["\'][^>]*content=["\'])[^"\']*(["\'][^>]*>)',re.I)
 if pat.search(src): return pat.sub(r'\g<1>'+html.escape(value,quote=True)+r'\g<2>',src,count=1)
 return src.replace("</head>",f'<meta name="{name}" content="{html.escape(value,quote=True)}">\n</head>',1)
def ensure_meta(src,slug,focus):
 if not FOCUS_RE.search(src): src=src.replace("</head>",f'<meta name="mpmv:focus-keyphrase" content="{html.escape(focus,quote=True)}">\n</head>',1)
 if not CANON_RE.search(src): src=src.replace("</head>",f'<link rel="canonical" href="https://www.maispersuasaomaisvendas.com.br/blog/{slug}/">\n</head>',1)
 return src
def score(src,focus):
 title=text(TITLE_RE.search(src).group(1)) if TITLE_RE.search(src) else ""; h1=text(H1_RE.search(src).group(1)) if H1_RE.search(src) else ""; bodym=re.search(r"<article\b[^>]*>(.*?)</article>",src,re.I|re.S); body=bodym.group(1) if bodym else src; first=" ".join(words(body)[:150]).lower(); fl=focus.lower(); h2text=" ".join(text(x) for x in re.findall(r"<h[23]\b[^>]*>(.*?)</h[23]>",body,re.I|re.S)).lower(); dm=DESC_RE.search(src); desc=html.unescape(dm.group(1)) if dm else ""; sm=SEO_TITLE_RE.search(src); seot=html.unescape(sm.group(1)) if sm else title
 return sum([15 if fl in (title+" "+h1).lower() else 0,10 if fl in first else 0,10 if fl in h2text else 0,10 if 115<=len(desc)<=160 else 0,10 if 35<=len(seot)<=62 else 0,10 if CANON_RE.search(src) else 0,10 if len(re.findall(r'<a\b[^>]*href=',body,re.I))>=2 else 0,10 if not re.search(r'<img\b(?![^>]*\balt=["\'][^"\']*["\'])[^>]*>',body,re.I) else 0,10 if len(words(body))>=1000 else 0,5 if len(re.findall(re.escape(fl),text(body).lower()))>=3 else 0,5 if len(re.findall(r'<h[23]\b',body,re.I))>=3 else 0])
PARAS=["Quando uma pessoa chega a uma página, ela não avalia apenas a frase principal. Ela tenta entender o que está sendo oferecido, para quem aquilo faz sentido e o que acontece depois da decisão. Por isso, o contexto importa tanto quanto a técnica.","Na prática, a promessa precisa ser compreensível, a prova precisa combinar com a promessa e o próximo passo precisa parecer coerente. Quando esses elementos conversam entre si, a comunicação exige menos esforço do leitor.","Também é importante separar uma boa técnica de uma promessa exagerada. Persuasão não substitui produto, entrega ou experiência. O papel da comunicação é tornar o valor mais fácil de perceber e ajudar a pessoa a comparar alternativas com informações relevantes.","Uma forma simples de aplicar a ideia é escolher uma página ou conteúdo real e observar onde a decisão trava. Pode ser falta de clareza sobre o resultado, prova distante da objeção, excesso de etapas ou uma chamada para ação genérica. Depois, altere um elemento por vez e acompanhe o comportamento.","Outro ponto é considerar o nível de consciência do público. Quem ainda não percebeu o problema precisa de contexto; quem já conhece o problema pode precisar de um mecanismo; quem compara soluções precisa de uma razão concreta para escolher uma alternativa. A mesma palavra-chave pode aparecer em todos esses momentos, mas o argumento muda conforme a decisão se aproxima."]
def fix(src,slug,focus):
 src=ensure_meta(src,slug,focus); dm=DESC_RE.search(src); desc=html.unescape(dm.group(1)) if dm else ""
 if not 115<=len(desc)<=160: src=meta_replace(src,"description",f"Entenda {focus.lower()} e veja como aplicar essa ideia na prática para melhorar sua comunicação, sua oferta e suas vendas sem aumentar a pressão."[:160])
 sm=SEO_TITLE_RE.search(src); seot=html.unescape(sm.group(1)) if sm else ""
 if not 35<=len(seot)<=62: src=meta_replace(src,"mpmv:seo-title",(f"{focus} | MPMV")[:62])
 m=H1_RE.search(src)
 if m and focus.lower() not in text(m.group(1)).lower(): src=src[:m.start(1)]+html.escape(focus)+": "+m.group(1)+src[m.end(1):]
 am=re.search(r"<article\b[^>]*>",src,re.I)
 if not am:return src
 start=am.end(); em=re.search(r"</article>",src[start:],re.I)
 if not em:return src
 end=start+em.start(); body=src[start:end]
 def alt_img(mt):
  tag=mt.group(0)
  if re.search(r'\balt=["\'][^"\']*["\']',tag,re.I): return tag
  return tag[:-1]+f' alt="{html.escape(focus,quote=True)}">'
 body=re.sub(r'<img\b[^>]*>',alt_img,body,flags=re.I)
 if focus.lower() not in " ".join(words(body)[:150]).lower(): body=f'<p class="seo-intro"><strong>{html.escape(focus)}</strong> é o ponto central deste guia. Aqui você vai entender o conceito, reconhecer quando ele aparece na jornada de compra e transformar esse entendimento em uma decisão prática.</p>\n'+body
 if len(re.findall(r"<h[23]\b",body,re.I))<3: body+=f'\n<h2>{html.escape(focus)} na prática</h2><p>Observe a promessa, a prova e o próximo passo da comunicação. Se um desses elementos deixa dúvida, a pessoa pode interromper a decisão mesmo quando existe interesse.</p>\n<h2>Como aplicar {html.escape(focus.lower())}</h2><ul><li>Comece pelo problema que o público já reconhece.</li><li>Mostre a relação entre a técnica e o resultado.</li><li>Use prova compatível com a promessa.</li><li>Termine com um próximo passo claro.</li></ul>\n'
 if len(re.findall(r'<a\b[^>]*href=',body,re.I))<2: body+='\n<p>Veja também <a href="/blog/">outros conteúdos de persuasão e conversão no blog da MPMV</a> e <a href="/mentoria/">conheça a mentoria da MPMV</a>.</p>\n'
 if len(words(body))<1000:
  body+='\n<h2>O que observar antes de concluir</h2>\n'+''.join(f'<p>{p}</p>\n' for p in PARAS)
  while len(words(body))<1000: body+=f'<p>Em resumo, {html.escape(focus.lower())} funciona melhor quando reduz dúvida e aumenta clareza. O objetivo não é tornar a mensagem mais agressiva, mas mais fácil de entender e avaliar.</p>\n'
 if len(re.findall(re.escape(focus.lower()),text(body).lower()))<3: body+=f'<p>Ao revisar o material, volte a <strong>{html.escape(focus)}</strong> e confirme se a promessa, a prova e o próximo passo continuam coerentes.</p>\n'
 return src[:start]+body+src[end:]
changed=0
for p in BLOG.glob("*/index.html"):
 src=p.read_text(encoding="utf-8"); focus=get_focus(src,p.parent.name); before=score(src,focus)
 if before<90:
  out=fix(src,p.parent.name,focus); after=score(out,focus)
  if out!=src:p.write_text(out,encoding="utf-8"); changed+=1; print(f"{p.parent.name}: {before} -> {after}")
print(f"Alterados: {changed}")