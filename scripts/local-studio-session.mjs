import {randomUUID} from 'node:crypto';
import {handleStudioSession} from '../api/studio-session.js';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const path = '/api/studio-session';

function mount(server) {
  const sessions = new Map();
  server.middlewares.use(async (req, res, next) => {
    if (req.url?.split('?')[0] !== path) return next();
    res.setHeader('Cache-Control', 'private, no-store');
    const {host, cookie = ''} = req.headers;
    if (!loopback.has(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host || '')) {
      res.writeHead(403).end(); return;
    }
    const origin = (req.socket.encrypted ? 'https://' : 'http://') + host;
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    if (req.headers.origin !== origin) { res.writeHead(403).end(); return; }

    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2048) { res.writeHead(413).end(); return; }
      }
      req.body = JSON.parse(body);
    } catch { res.writeHead(400).end(); return; }
    const key = 'chronicle-studio-preview-' + req.socket.localPort;
    const handle = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(key + '='))?.slice(key.length + 1);
    for (const [id, data] of sessions) if (data.expiresAt <= Date.now()) sessions.delete(id);
    const reply = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) { res.statusCode = code; return this; },
      end: () => res.end(),
      json(data) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); }
    };
    await handleStudioSession(req, reply, {
      origin, saved:sessions.get(handle),
      persist(data, ttl) {
        sessions.delete(handle);
        const id = data ? randomUUID() : '';
        if (data) sessions.set(id, data);
        const secure = req.socket.encrypted ? '; Secure' : '';
        res.setHeader('Set-Cookie', key + '=' + id + '; Max-Age=' + ttl + '; Path=' + path + '; HttpOnly; SameSite=Strict' + secure);
      }
    });
  });
}

export const localStudioSession = {name:'local-studio-session', configureServer:mount, configurePreviewServer:mount};
