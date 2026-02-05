import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.PINTEREST_API_URI || 'https://api.pinterest.com';
const OAUTH_BASE = 'https://www.pinterest.com';

const APP_ID = process.env.PINTEREST_APP_ID;
const APP_SECRET = process.env.PINTEREST_APP_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;

const SCOPES = 'user_accounts:read,boards:read,pins:read,pins:write';

// In-memory: sessionId -> { access_token, refresh_token }
const sessions = new Map();

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

function getSession(req) {
  const sid = req.cookies?.sid;
  return sid ? sessions.get(sid) : null;
}

// ——— OAuth ———
app.get('/auth/login', (req, res) => {
  if (!APP_ID || !APP_SECRET) {
    return res.status(500).send('Set PINTEREST_APP_ID and PINTEREST_APP_SECRET in .env');
  }
  const state = randomBytes(16).toString('hex');
  const sessionId = randomBytes(16).toString('hex');
  sessions.set(sessionId, { state });
  res.cookie('sid', sessionId, { httpOnly: true, maxAge: 86400000 });
  const url = `${OAUTH_BASE}/oauth/?client_id=${encodeURIComponent(APP_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&state=${state}`;
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const session = getSession(req);
  if (!session || session.state !== state || !code) {
    return res.redirect('/?error=auth');
  }
  const auth = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    ...(process.env.CONTINUOUS_REFRESH === 'true' && { continuous_refresh: 'true' }),
  });
  try {
    const r = await fetch(`${API_BASE}/v5/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || JSON.stringify(data));
    session.access_token = data.access_token;
    session.refresh_token = data.refresh_token;
    delete session.state;
  } catch (e) {
    console.error(e);
    return res.redirect('/?error=token');
  }
  res.redirect('/');
});

app.post('/auth/logout', (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.clearCookie('sid').redirect('/');
});

// ——— API proxy (require auth) ———
async function pinterestApi(req, path, options = {}) {
  const session = getSession(req);
  if (!session?.access_token) return { status: 401, data: { error: 'Not authenticated' } };
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

app.get('/api/me', async (req, res) => {
  const { status, data } = await pinterestApi(req, '/v5/user_account');
  res.status(status).json(data);
});

app.get('/api/boards', async (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  const { status, data } = await pinterestApi(req, `/v5/boards${q ? '?' + q : ''}`);
  res.status(status).json(data);
});

app.get('/api/pins', async (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  const { status, data } = await pinterestApi(req, `/v5/pins${q ? '?' + q : ''}`);
  res.status(status).json(data);
});

app.get('/api/boards/:boardId/pins', async (req, res) => {
  const { boardId } = req.params;
  const q = new URLSearchParams(req.query).toString();
  const { status, data } = await pinterestApi(req, `/v5/boards/${boardId}/pins${q ? '?' + q : ''}`);
  res.status(status).json(data);
});

app.post('/api/pins', async (req, res) => {
  const { status, data } = await pinterestApi(req, '/v5/pins', {
    method: 'POST',
    body: JSON.stringify(req.body),
  });
  res.status(status).json(data);
});

app.listen(PORT, () => {
  console.log(`Pinterest app: http://localhost:${PORT}`);
  if (!APP_ID || !APP_SECRET) console.log('Add PINTEREST_APP_ID and PINTEREST_APP_SECRET to .env');
});
