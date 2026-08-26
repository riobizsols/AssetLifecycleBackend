/**
 * Zoho Directory OIDC (OpenID Provider) settings for RIO EAM SSO.
 * Values come from Zoho Admin → Applications → RIO EAM → Single Sign-On.
 */
function getZohoOidcConfig() {
  const enabled = String(process.env.ZOHO_OIDC_ENABLED || '').toLowerCase() === 'true';
  const clientId = String(process.env.ZOHO_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.ZOHO_CLIENT_SECRET || '').trim();
  const redirectUri = String(
    process.env.ZOHO_REDIRECT_URI || 'https://rioassetmanagement.net/api/auth/zoho/callback'
  ).trim();
  const authorizeUrl = String(
    process.env.ZOHO_AUTHORIZE_URL ||
      'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/authorize'
  ).trim();
  const tokenUrl = String(
    process.env.ZOHO_TOKEN_URL ||
      'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/token'
  ).trim();
  const userInfoUrl = String(
    process.env.ZOHO_USERINFO_URL ||
      'https://directory.zoho.in/p/60084560311/app/514401000000006001/sso/userinfo'
  ).trim();
  const mainDomain = String(process.env.MAIN_DOMAIN || 'rioassetmanagement.net').trim();
  const platformOrigin = String(
    process.env.SSO_PLATFORM_ORIGIN || process.env.FRONTEND_URL || `https://${mainDomain}`
  )
    .trim()
    .replace(/\/+$/, '');
  const frontendProtocol = String(process.env.SSO_FRONTEND_PROTOCOL || 'https').trim();

  return {
    enabled,
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl,
    tokenUrl,
    userInfoUrl,
    mainDomain,
    platformOrigin,
    frontendProtocol,
    isConfigured: Boolean(enabled && clientId && clientSecret && redirectUri && authorizeUrl && tokenUrl),
  };
}

function buildTenantSsoCompleteUrl(subdomain, token) {
  const { mainDomain, frontendProtocol } = getZohoOidcConfig();
  const host = `${String(subdomain).trim().toLowerCase()}.${mainDomain}`;
  return `${frontendProtocol}://${host}/auth/sso/complete?token=${encodeURIComponent(token)}`;
}

function buildSsoErrorRedirect(message) {
  const { platformOrigin } = getZohoOidcConfig();
  const q = new URLSearchParams({ sso_error: message || 'SSO login failed' });
  return `${platformOrigin}/login?${q.toString()}`;
}

module.exports = {
  getZohoOidcConfig,
  buildTenantSsoCompleteUrl,
  buildSsoErrorRedirect,
};
