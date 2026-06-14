import { defineMiddleware } from 'astro:middleware';
import { verifySessionCookie } from './lib/admin/auth';

const ADMIN_PREFIX = '/admin';
const ADMIN_API_PREFIX = '/api/admin';

function isProtected(pathname: string): boolean {
  if (pathname === '/admin/login' || pathname === '/admin/login/') return false;
  if (pathname.startsWith(ADMIN_PREFIX)) return true;
  if (pathname.startsWith(ADMIN_API_PREFIX)) {
    if (pathname === '/api/admin/auth' || pathname === '/api/admin/auth/') return false;
    return true;
  }
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (isProtected(pathname)) {
    const cookie = context.request.headers.get('cookie') ?? '';
    const session = verifySessionCookie(cookie);

    if (!session) {
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return context.redirect('/admin/login?next=' + encodeURIComponent(pathname));
    }

    context.locals.adminSession = session;
  }

  return next();
});
