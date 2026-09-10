(() => {
  if (window.__MPMV_IMAGE_PACKAGE__) return;
  window.__MPMV_IMAGE_PACKAGE__ = true;

  const doc = document;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));

  function adminToken() {
    let token = sessionStorage.getItem('mpmv_admin_token');
    if (!token) {
      token = prompt('Token de administração:');
      if (token) sessionStorage.setItem('mpmv_admin_token', token);
    }
    return token;
  }

  function currentContext() {
    const modal = doc.getElementById('editModal');
    const slug = doc.getElementById('editSlug')?.value?.trim();
    const title = doc.getElementById('editVisibleTitle')?.textContent?.replace(/\s+/g, ' ').trim();
    const keyphrase = doc.getElementById('editKeyphrase')?.value?.trim();
    const meta = doc.getElementById('editMeta')?.value?.trim();
    const alt = doc.getElementById('editCoverAlt')?.value?.trim();
    return { modal, slug, title, keyphrase, meta, alt };
  }

  function addStyles() {
    if (doc.getElementById('mpmv-image-package-style')) return;
    const style = doc.createElement('style');
    style.id = 'mpmv-image-package-style';
    style.textContent = `
      #mpmv-image-package-box{display:grid;gap:12px;border:1px solid #3a3323;background:linear-gradient(135deg,#17140d,#111);padding:16px;border-radius:14px}
      #mpmv-image-package-box h4{margin:0;font-size:15px;color:#f0e5cf}
      #mpmv-image-package-box p{margin:0;color:#9d958a;font-size:12px;line-height:1.5}
      #mpmv-image-package-actions{display:flex;gap:8px;flex-wrap:wrap}
      #mpmv-generate-package{background:#d1a447;color:#15110a}
      #mpmv-publish-package{background:#3d9b70;color:#fff}
      #mpmv-download-package{background:#2968c8;color:#fff}
      #mpmv-image-package-status{font-size:12px;color:#bdb5aa;min-height:18px}
      #mpmv-image-package-preview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .mpmv-img-card{background:#0a0a0a;border:1px solid #2b2b2b;border-radius:10px;overflow:hidden}
      .mpmv-img-card img{display:block;width:100%;height:auto}
      .mpmv-img-card span{display:block;padding:8px 10px;color:#8f887f;font-size:11px}
      @media(max-width:720px){#mpmv-image-package-preview{grid-template-columns:1fr}}
    `;
    doc.head.appendChild(style);
  }

  function addUI() {
    const panel = doc.querySelector('[data-edit-panel="cover"]');
    if (!panel || doc.getElementById('mpmv-image-package-box')) return;
    addStyles();

    const box = doc.createElement('div');
    box.id = 'mpmv-image-package-box';
    box.innerHTML = `
      <div>
        <h4>Gerar pacote de imagens MPMV</h4>
        <p>Usa o título, a frase-chave e o contexto do artigo para gerar uma imagem-mestre e três formatos prontos para capa, card e social. Os nomes dos arquivos e o ALT seguem o padrão SEO.</p>
      </div>
      <div id="mpmv-image-package-actions">
        <button id="mpmv-generate-package" class="btn" type="button">Gerar pacote</button>
        <button id="mpmv-publish-package" class="btn" type="button" disabled>Aplicar e publicar</button>
        <button id="mpmv-download-package" class="btn" type="button" disabled>Baixar ZIP</button>
      </div>
      <div id="mpmv-image-package-status"></div>
      <div id="mpmv-image-package-preview"></div>
    `;
    panel.querySelector('.section-box')?.appendChild(box);

    let generated = null;

    const status = (text, kind='') => {
      const el = doc.getElementById('mpmv-image-package-status');
      if (!el) return;
      el.textContent = text;
      el.style.color = kind === 'error' ? '#f08b8f' : kind === 'ok' ? '#73c89c' : '#bdb5aa';
    };

    const bytesToBlob = (b64, mime='image/png') => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      return new Blob([arr], {type:mime});
    };

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

    const crop = (source, targetW, targetH, quality=.84) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = targetW / targetH;
        const sourceRatio = img.width / img.height;
        let sx=0, sy=0, sw=img.width, sh=img.height;
        if (sourceRatio > targetRatio) {
          sw = Math.round(img.height * targetRatio);
          sx = Math.round((img.width - sw) / 2);
        } else {
          sh = Math.round(img.width / targetRatio);
          sy = Math.round((img.height - sh) / 2);
        }
        const canvas = doc.createElement('canvas');
        canvas.width = targetW; canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao criar WebP.')), 'image/webp', quality);
      };
      img.onerror = () => reject(new Error('Falha ao ler a imagem gerada.'));
      img.src = URL.createObjectURL(source);
    });

    const blobToB64 = async (blob) => {
      const dataUrl = await blobToDataUrl(blob);
      return String(dataUrl).split(',')[1];
    };

    const showPreview = (items) => {
      const wrap = doc.getElementById('mpmv-image-package-preview');
      wrap.innerHTML = items.map(item => `
        <div class="mpmv-img-card">
          <img src="${item.dataUrl}" alt="${esc(item.label)}">
          <span>${esc(item.label)} · ${esc(item.name)}</span>
        </div>
      `).join('');
    };

    const makeZip = async () => {
      if (!generated || !window.JSZip) throw new Error('Gerador de ZIP indisponível.');
      const zip = new JSZip();
      for (const item of generated.items) zip.file(item.name, item.blob);
      zip.file('seo.json', JSON.stringify(generated.seo, null, 2));
      zip.file('README.txt',
        'PACOTE DE IMAGENS MPMV\\n\\n' +
        'Os arquivos já usam a nomenclatura do slug e os dados SEO estão em seo.json.\\n' +
        'A capa principal é a versão -capa.webp.\\n'
      );
      const out = await zip.generateAsync({type:'blob', compression:'DEFLATE'});
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = generated.zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    };

    doc.getElementById('mpmv-generate-package').addEventListener('click', async () => {
      const ctx = currentContext();
      if (!ctx.slug || !ctx.title) return status('Abra um artigo e preencha o título antes de gerar.', 'error');
      const token = adminToken();
      if (!token) return;
      const btn = doc.getElementById('mpmv-generate-package');
      btn.disabled = true;
      doc.getElementById('mpmv-publish-package').disabled = true;
      doc.getElementById('mpmv-download-package').disabled = true;
      status('Gerando a imagem-mestre… isso pode levar alguns segundos.');
      try {
        const r = await fetch('/api/admin-blog-image-package', {
          method:'POST',
          headers:{'Content-Type':'application/json','x-admin-token':token},
          body:JSON.stringify({
            action:'generate',
            slug:ctx.slug,
            title:ctx.title,
            keyphrase:ctx.keyphrase,
            metaDescription:ctx.meta,
            alt:ctx.alt
          })
        });
        const data = await r.json().catch(()=>({}));
        if (r.status===401) { sessionStorage.removeItem('mpmv_admin_token'); throw new Error('Token inválido.'); }
        if (!r.ok) throw new Error(data.error || data.detail || 'Falha na geração.');
        const masterBlob = bytesToBlob(data.imageBase64, data.mimeType || 'image/png');
        const [coverBlob, cardBlob, socialBlob] = await Promise.all([
          crop(masterBlob, 1536, 864, .86),
          crop(masterBlob, 1200, 1200, .84),
          crop(masterBlob, 1080, 1350, .84)
        ]);
        const base = ctx.slug;
        const alt = data.seo.alt;
        const items = [
          {name:`${base}-capa.webp`, label:'Capa 16:9', blob:coverBlob},
          {name:`${base}-card.webp`, label:'Card 1:1', blob:cardBlob},
          {name:`${base}-social.webp`, label:'Social 4:5', blob:socialBlob}
        ];
        for (const item of items) item.dataUrl = await blobToDataUrl(item.blob);
        generated = {
          slug:base,
          zipName:`pacote-imagens-${base}.zip`,
          seo:data.seo,
          items,
          masterBase64:data.imageBase64
        };
        showPreview(items);
        doc.getElementById('mpmv-publish-package').disabled = false;
        doc.getElementById('mpmv-download-package').disabled = false;
        status('Pacote gerado. Confira a prévia e publique quando estiver satisfeito.', 'ok');
      } catch(e) {
        status('Erro: '+e.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    doc.getElementById('mpmv-download-package').addEventListener('click', async () => {
      try { await makeZip(); } catch(e) { status('Erro ao montar o ZIP: '+e.message, 'error'); }
    });

    doc.getElementById('mpmv-publish-package').addEventListener('click', async () => {
      const ctx = currentContext();
      if (!generated || !ctx.slug) return;
      const token = adminToken();
      if (!token) return;
      const btn = doc.getElementById('mpmv-publish-package');
      btn.disabled = true;
      status('Publicando as imagens e atualizando o SEO do artigo…');
      try {
        const variants = {};
        for (const item of generated.items) variants[item.name] = await blobToB64(item.blob);
        const r = await fetch('/api/admin-blog-image-package', {
          method:'POST',
          headers:{'Content-Type':'application/json','x-admin-token':token},
          body:JSON.stringify({
            action:'publish',
            slug:ctx.slug,
            title:ctx.title,
            alt:generated.seo.alt,
            variants
          })
        });
        const data = await r.json().catch(()=>({}));
        if (r.status===401) { sessionStorage.removeItem('mpmv_admin_token'); throw new Error('Token inválido.'); }
        if (!r.ok) throw new Error(data.error || data.detail || 'Falha na publicação.');
        const coverUrl = data.coverUrl;
        const coverInput = doc.getElementById('editCoverUrl');
        const altInput = doc.getElementById('editCoverAlt');
        if (coverInput) { coverInput.value = coverUrl; coverInput.dispatchEvent(new Event('input', {bubbles:true})); }
        if (altInput) { altInput.value = generated.seo.alt; altInput.dispatchEvent(new Event('input', {bubbles:true})); }
        const preview = doc.getElementById('coverPreview');
        if (preview) {
          preview.innerHTML = `<img src="${esc(coverUrl)}" alt="Prévia da capa do artigo">`;
        }
        status('Publicado. A capa e os dados SEO já foram gravados no artigo.', 'ok');
      } catch(e) {
        status('Erro: '+e.message, 'error');
        btn.disabled = false;
      }
    });
  }

  const observer = new MutationObserver(() => addUI());
  observer.observe(doc.documentElement, {childList:true, subtree:true});
  addUI();
})();
