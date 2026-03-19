import { defineMiddleware } from 'astro:middleware';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zotride_secret_key';

// Routes nécessitant une authentification
const PROTECTED = ['/api/sorties', '/api/users', '/api/notifications', '/api/admin'];
// Routes nécessitant le rôle admin
const ADMIN_ONLY = ['/api/admin'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  const needsAuth  = PROTECTED.some(p => pathname.startsWith(p));
  const needsAdmin = ADMIN_ONLY.some(p => pathname.startsWith(p));

  if (needsAuth) {
    const auth  = context.request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);
      context.locals.user = user;

      if (needsAdmin && user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Token invalide ou expiré' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return next();
});
