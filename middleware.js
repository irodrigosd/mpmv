import primary from './data/blog-posts.json';

const SOURCES = [
  '/data/blog-posts-2026-09-12.json',
  '/data/blog-posts-2026-09-09.json',
  '/data/blog-posts-2026-09-08.json',
  '/data/blog-posts-extra.json',
  '/data/blog-posts-2026-09-11.json',
  '/data/blog-posts-2026-09-14.json'
];

const ADMIN_PATHS = ['/admin'];

function isAdminPath(pathname) {
  return ADMIN_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function unauthorized() {
  return new Response('Acesso restrito.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MPMV Admin", charset="UTF-8"',
      'Cache-Control': 'no-store'
    }
  });
}

function authorized(request) {
  const expectedPassword = process.env.ADMIN_BLOG_TOKEN;
  if (!expectedPassword) return false;

  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    return username === 'admin' && password === expectedPassword;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/data/blog-posts.json']
};

export default async function middleware(request) {
  const pathname = new URL(request.url).pathname;

  // Proteção server-side: a página administrativa não é entregue
  // antes da autenticação. Isso impede acesso direto ao /admin/*.
  if (isAdminPath(pathname) && !authorized(request)) {
    return unauthorized();
  }

  try {
    const origin = new URL(request.url).origin;
    const responses = await Promise.all(
      SOURCES.map(path => fetch(origin + path + '?inventory=' + Date.now(), {
        cache: 'no-store'
      }))
    );

    const groups = await Promise.all(
      responses.map(async response => {
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      })
    );

    const merged = new Map();
    for (const group of groups) {
      for (const post of group) {
        if (post && post.slug) merged.set(post.slug, post);
      }
    }
    for (const post of Array.isArray(primary) ? primary : []) {
      if (post && post.slug) merged.set(post.slug, post);
    }

    return new Response(JSON.stringify([...merged.values()]), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Não foi possível consolidar o inventário do blog.'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
}
