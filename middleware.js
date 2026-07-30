// Vercel Edge Middleware — password-gates every request before any page is served.
// Runs on Vercel's edge, so unauthenticated visitors never receive the dashboard HTML
// (or its embedded data) at all.
//
// Password: set SITE_PASSWORD in the Vercel project's Environment Variables to change it
// without editing code. Falls back to "Frodo" if unset.
// Sign-in prompt: any username works; the password is what's checked.

export const config = {
  // Protect everything except Vercel internals.
  matcher: ['/((?!_vercel|_next/static|favicon.ico).*)'],
};

export default function middleware(request) {
  const PASSWORD = process.env.SITE_PASSWORD || 'Zbag';

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch (_) {
      decoded = '';
    }
    const sep = decoded.indexOf(':');
    const password = sep >= 0 ? decoded.slice(sep + 1) : '';
    if (password === PASSWORD) {
      return; // authenticated — let the request through
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="RANDYS Dashboards", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}
