import { next } from '@vercel/functions';
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
const AUTH_COOKIE = 'mpmv_admin_auth';

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

async function tokenFingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function authorized(request) {
  const expectedPassword = process.env.ADMIN_BLOG_TOKEN;
  if (!expectedPassword) return false;

  // Depois do primeiro login, o navegador usa o cookie para as requisições
  // internas do painel (inclusive o iframe), sem exigir outro prompt.
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  if (cookieMatch) {
    const expectedFingerprint = await tokenFingerprint(expectedPassword);
    if (cookieMatch[1] === expectedFingerprint) return true;
  }

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

  if (isAdminPath(pathname)) {
    const hasBasicAuth = (request.headers.get('authorization') || '').startsWith('Basic ');
    if (!(await authorized(request))) return unauthorized();

    const response = next();
    // Só grava a sessão quando a autenticação veio do Basic Auth.
    // O valor do cookie é um SHA-256 do token, nunca o token em si.
    if (hasBasicAuth) {
      const fingerprint = await tokenFingerprint(process.env.ADMIN_BLOG_TOKEN);
      response.headers.set(
        'Set-Cookie',
        `${AUTH_COOKIE}=${fingerprint}; Path=/admin; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`
      );
    }
    return response;
  }

  if (pathname !== '/data/blog-posts.json') {
    return next();
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
