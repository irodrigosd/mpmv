import primary from './data/blog-posts.json';

const SOURCES = [
  '/data/blog-posts-2026-09-12.json',
  '/data/blog-posts-2026-09-09.json',
  '/data/blog-posts-2026-09-08.json',
  '/data/blog-posts-extra.json',
  '/data/blog-posts-2026-09-11.json',
  '/data/blog-posts-2026-09-14.json'
];

export const config = {
  matcher: ['/data/blog-posts.json']
};

export default async function middleware(request) {
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
