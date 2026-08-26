/**
 * Zoho Directory OIDC helpers (India DC).
 * Enabled only when ZOHO_OIDC_ENABLED=true and credentials are set.
 * Does not affect password login or tenant registration.
 *
 * Env aliases (either name works):
 *   ZOHO_AUTHORIZATION_ENDPOINT | ZOHO_AUTHORIZE_URL
 *   ZOHO_TOKEN_ENDPOINT          | ZOHO_TOKEN_URL
 *   ZOHO_USERINFO_ENDPOINT       | ZOHO_USERINFO_URL
 */

const crypto = require('crypto');

const DEFAULT_AUTHORIZE =
  'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/authorize';
const DEFAULT_TOKEN =
  'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/token';
const DEFAULT_USERINFO =
  'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/userinfo';
const DEFAULT_REDIRECT = 'https://rioassetmanagement.net/api/auth/zoho/callback';

const envFirst = (...keys) => {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
};

const getZohoConfig = () => ({
  clientId: envFirst('ZOHO_CLIENT_ID'),
  clientSecret: envFirst('ZOHO_CLIENT_SECRET'),
  redirectUri: envFirst('ZOHO_REDIRECT_URI') || DEFAULT_REDIRECT,
  authorizationEndpoint:
    envFirst('ZOHO_AUTHORIZATION_ENDPOINT', 'ZOHO_AUTHORIZE_URL') || DEFAULT_AUTHORIZE,
  tokenEndpoint: envFirst('ZOHO_TOKEN_ENDPOINT', 'ZOHO_TOKEN_URL') || DEFAULT_TOKEN,
  userinfoEndpoint:
    envFirst('ZOHO_USERINFO_ENDPOINT', 'ZOHO_USERINFO_URL') || DEFAULT_USERINFO,
  scopes: envFirst('ZOHO_SCOPES') || 'openid email profile',
});

const isZohoOidcEnabled = () => {
  const flag = String(process.env.ZOHO_OIDC_ENABLED || '').toLowerCase().trim();
  if (flag !== 'true' && flag !== '1' && flag !== 'yes') return false;
  const cfg = getZohoConfig();
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
};

/** HMAC-signed state so we don't need cookie-parser / shared session store. */
const createOidcState = () => {
  const nonce = crypto.randomBytes(16).toString('hex');
  const body = Buffer.from(
    JSON.stringify({ n: nonce, t: Date.now() }),
    'utf8'
  ).toString('base64url');
  const secret = process.env.JWT_SECRET || process.env.ZOHO_CLIENT_SECRET || 'zoho-state';
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const verifyOidcState = (state, maxAgeMs = 10 * 60 * 1000) => {
  if (!state || typeof state !== 'string' || !state.includes('.')) return false;
  const [body, sig] = state.split('.');
  if (!body || !sig) return false;
  const secret = process.env.JWT_SECRET || process.env.ZOHO_CLIENT_SECRET || 'zoho-state';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed?.t || Date.now() - Number(parsed.t) > maxAgeMs) return false;
    return true;
  } catch {
    return false;
  }
};

const buildAuthorizeUrl = (state) => {
  const cfg = getZohoConfig();
  const url = new URL(cfg.authorizationEndpoint);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('scope', cfg.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  return url.toString();
};

const exchangeCodeForTokens = async (code) => {
  const cfg = getZohoConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
  });

  const res = await fetch(cfg.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || `Token exchange failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
};

const fetchZohoUserInfo = async (accessToken) => {
  const cfg = getZohoConfig();
  const res = await fetch(cfg.userinfoEndpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || `UserInfo failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
};

const extractEmailFromZohoProfile = (profile = {}, idTokenPayload = null) => {
  const candidates = [
    profile.email,
    profile.Email,
    profile.mail,
    profile.preferred_username,
    profile.Preferred_Username,
    idTokenPayload?.email,
  ];
  for (const c of candidates) {
    const email = String(c || '').trim().toLowerCase();
    if (email.includes('@')) return email;
  }
  return null;
};

const decodeJwtPayloadUnsafe = (jwt) => {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

module.exports = {
  isZohoOidcEnabled,
  getZohoConfig,
  createOidcState,
  verifyOidcState,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchZohoUserInfo,
  extractEmailFromZohoProfile,
  decodeJwtPayloadUnsafe,
};
