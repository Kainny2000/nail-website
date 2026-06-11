import type { APIRoute } from 'astro';
import { verifyPassword, newSession, buildSessionCookie, newCsrfToken, buildCsrfCookie } from '../../../lib/admin/auth';
import { recordFailedLogin, recordSuccessfulLogin, getClientKey } from '../../../lib/admin/sessions';

export const POST: APIRoute = async ({ request, redirect, url }) => {
  const key = getClientKey(request);
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/admin') || '/admin';

  const ok = verifyPassword(password);

  if (!ok) {
    const r = recordFailedLogin(key);
    if (r.locked) {
      return redirect(`/admin/login?error=${encodeURIComponent(`Demasiados intentos. Intenta en ${Math.ceil(r.retryAfterSec / 60)} min.`)}`);
    }
    return redirect(`/admin/login?error=${encodeURIComponent('Contraseña incorrecta')}&next=${encodeURIComponent(next)}`);
  }

  recordSuccessfulLogin(key);

  const session = newSession();
  const csrf = newCsrfToken();
  const sessionCookie = buildSessionCookie(session);
  const csrfCookie = buildCsrfCookie(csrf);

  const headers = new Headers();
  headers.set('Location', next.startsWith('/') ? next : '/admin');
  headers.append('Set-Cookie', sessionCookie);
  headers.append('Set-Cookie', csrfCookie);

  return new Response(null, { status: 303, headers });
};

export const DELETE: APIRoute = async () => {
  const { clearSessionCookie } = await import('../../../lib/admin/auth');
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
