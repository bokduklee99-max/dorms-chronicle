// Production uses a host-only cookie. Local previews keep the credential in server memory.
const name = '__Secure-chronicle-studio';
const attributes = 'Path=/api/studio-session; HttpOnly; Secure; SameSite=Strict';

export default function studioSession(req, res) {
  let saved;
  try {
    const cookie = req.cookies[name];
    if (cookie) saved = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'));
  } catch { /* An unreadable cookie is an expired session. */ }
  return handleStudioSession(req, res, {
    origin:'https://' + req.headers.host, saved,
    persist(data, ttl) {
      const value = data ? Buffer.from(JSON.stringify(data)).toString('base64url') : '';
      res.setHeader('Set-Cookie', name + '=' + value + '; Max-Age=' + ttl + '; ' + attributes);
    }
  });
}

export async function handleStudioSession(req, res, {origin, saved, persist}) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers.origin !== origin ||
      req.headers['content-type']?.split(';')[0] !== 'application/json') return res.status(403).end();

  const {action, subject, expiresAt} = req.body || {};
  if (action === 'restore') {
    if (!subject || saved?.subject !== subject || !(saved.expiresAt > Date.now())) return res.status(204).end();
    return res.status(200).json(saved);
  }
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._~+/=-]{1,2400})$/)?.[1];
  if (!token) return res.status(400).end();
  if (action === 'forget') {
    if (saved?.token === token) persist(null, 0);
    return res.status(204).end();
  }
  if (action !== 'remember' || !Number.isFinite(expiresAt)) return res.status(400).end();
  const ttl = Math.min(3600, Math.floor((expiresAt - Date.now()) / 1000));
  if (ttl <= 0) return res.status(400).end();
  try {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers:{Authorization:'Bearer ' + token}, redirect:'error', signal:AbortSignal.timeout(5000)
    });
    if (!response.ok) return res.status(response.status === 401 ? 401 : 502).end();
    const {sub} = await response.json();
    if (typeof sub !== 'string' || !sub || sub.length > 255) return res.status(502).end();
    persist({token, subject:sub, expiresAt:Math.min(expiresAt, Date.now() + ttl * 1000)}, ttl);
    return res.status(200).json({subject:sub});
  } catch { return res.status(502).end(); }
}
