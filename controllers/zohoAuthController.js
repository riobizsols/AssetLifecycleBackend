/**
 * Zoho OIDC SSO (Option B) — additive to password login.
 * Flow: Zoho → /api/auth/zoho/callback → email → tenant_user_emails → JWT → redirect to {subdomain}.MAIN_DOMAIN
 */

const {
  isZohoOidcEnabled,
  createOidcState,
  verifyOidcState,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  fetchZohoUserInfo,
  extractEmailFromZohoProfile,
  decodeJwtPayloadUnsafe,
} = require('../utils/zohoOidc');
const { resolveTenantDatabase } = require('../utils/tenantAuthResolver');
const { findUserByEmail, getUserWithBranch } = require('../models/userModel');
const { getUserRoles } = require('../models/userJobRoleModel');
const { buildSubdomainUrl } = require('../services/tenantSetupService');
const { createZohoAccessClaim } = require('../utils/zohoAccessClaim');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const generateToken = (user) =>
  jwt.sign(
    {
      org_id: user.org_id,
      user_id: user.user_id,
      email: user.email,
      job_role_id: user.job_role_id,
      emp_int_id: user.emp_int_id,
      language_code: user.language_code || 'en',
      use_default_db: false,
      auth_via: 'zoho_oidc',
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const platformFrontendBase = () => {
  const base =
    process.env.SSO_PLATFORM_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    `https://${process.env.MAIN_DOMAIN || 'rioassetmanagement.net'}`;
  return String(base).replace(/\/$/, '');
};

const redirectWithError = (res, message) => {
  const url = new URL(`${platformFrontendBase()}/login`);
  url.searchParams.set('sso_error', message);
  return res.redirect(302, url.toString());
};

const zohoLoginStart = async (req, res) => {
  try {
    if (!isZohoOidcEnabled()) {
      return res.status(503).json({
        message:
          'Zoho SSO is not enabled on this server. Use email/password login or ask an admin to configure ZOHO_OIDC_*.',
      });
    }

    const state = createOidcState();
    const authorizeUrl = buildAuthorizeUrl(state);
    logger.log('[ZohoSSO] Redirecting to Zoho authorize');
    return res.redirect(302, authorizeUrl);
  } catch (err) {
    console.error('[ZohoSSO] login start failed:', err);
    return redirectWithError(res, 'Could not start Zoho sign-in');
  }
};

const zohoLoginCallback = async (req, res) => {
  try {
    if (!isZohoOidcEnabled()) {
      return redirectWithError(res, 'Zoho SSO is not enabled');
    }

    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
      return redirectWithError(
        res,
        String(errorDescription || error || 'Zoho sign-in was cancelled')
      );
    }

    if (!code) {
      return redirectWithError(res, 'Missing authorization code from Zoho');
    }

    if (!verifyOidcState(String(state || ''))) {
      return redirectWithError(res, 'Invalid or expired Zoho sign-in state. Try again.');
    }

    const tokenSet = await exchangeCodeForTokens(String(code));
    const accessToken = tokenSet.access_token;
    if (!accessToken) {
      return redirectWithError(res, 'Zoho did not return an access token');
    }

    const idPayload = decodeJwtPayloadUnsafe(tokenSet.id_token);
    const profile = await fetchZohoUserInfo(accessToken);
    const email = extractEmailFromZohoProfile(profile, idPayload);

    if (!email) {
      logger.warn('[ZohoSSO] No email in Zoho profile:', profile);
      return redirectWithError(
        res,
        'Zoho account has no email. Use an account with email, or contact your admin.'
      );
    }

    const tenantCtx = await resolveTenantDatabase({ hostname: null, email });
    if (!tenantCtx?.dbPool || !tenantCtx.registryOrgId) {
      // Zoho-first onboarding: send verified user to request-access (not public tenant-setup).
      const fullName =
        profile?.name ||
        profile?.Name ||
        [profile?.given_name || profile?.first_name, profile?.family_name || profile?.last_name]
          .filter(Boolean)
          .join(' ') ||
        idPayload?.name ||
        null;
      try {
        const claim = createZohoAccessClaim({ email, fullName });
        const url = new URL(`${platformFrontendBase()}/request-access`);
        url.searchParams.set('claim', claim);
        logger.log(`[ZohoSSO] No org for ${email} → request-access`);
        return res.redirect(302, url.toString());
      } catch (claimErr) {
        logger.warn('[ZohoSSO] access claim failed:', claimErr.message);
        return redirectWithError(
          res,
          'No ALM organization found for this email. Contact support to request access.'
        );
      }
    }

    const dbPool = tenantCtx.dbPool;
    const registryOrgId = String(tenantCtx.registryOrgId).toUpperCase();
    const subdomain = tenantCtx.subdomain;

    if (!subdomain) {
      return redirectWithError(
        res,
        'Organization has no subdomain configured. Contact support.'
      );
    }

    let user = await findUserByEmail(email, dbPool);
    if (!user) {
      try {
        const loose = await dbPool.query(
          `SELECT *, 'tblUsers' as source_table FROM "tblUsers" WHERE lower(email) = lower($1) LIMIT 1`,
          [email]
        );
        user = loose.rows[0] || null;
      } catch {
        user = null;
      }
    }
    if (!user) {
      return redirectWithError(
        res,
        'Your email is mapped to an organization but no user exists there. Ask your admin to create your user.'
      );
    }

    let userRoles = [];
    try {
      userRoles = await getUserRoles(user.user_id, dbPool);
    } catch {
      userRoles = [];
    }

    let userWithBranch = null;
    try {
      userWithBranch = await getUserWithBranch(user.user_id, dbPool);
    } catch {
      userWithBranch = null;
    }

    let language_code = user.language_code || 'en';
    if (user.emp_int_id) {
      try {
        const langRes = await dbPool.query(
          `SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1 LIMIT 1`,
          [user.emp_int_id]
        );
        if (langRes.rows[0]?.language_code) {
          language_code = langRes.rows[0].language_code;
        }
      } catch {
        /* keep default */
      }
    }

    const tokenUser = {
      ...user,
      org_id: registryOrgId,
      language_code,
    };
    const token = generateToken(tokenUser);

    let tenantName = null;
    try {
      const orgResult = await dbPool.query(
        `SELECT text FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1`
      );
      tenantName = orgResult.rows[0]?.text || null;
    } catch {
      /* optional */
    }

    const sessionPayload = {
      token,
      requiresPasswordChange: false,
      user: {
        full_name: user.full_name,
        email: user.email,
        org_id: user.org_id,
        registry_org_id: registryOrgId,
        tenant_name: tenantName,
        subdomain,
        is_tenant: true,
        user_id: user.user_id,
        job_role_id: user.job_role_id,
        emp_int_id: user.emp_int_id,
        roles: userRoles,
        branch_id: userWithBranch?.branch_id || null,
        branch_name: userWithBranch?.branch_name || null,
        branch_code: userWithBranch?.branch_code || null,
        dept_id: userWithBranch?.dept_id || null,
        dept_name: userWithBranch?.dept_name || null,
        language_code,
        auth_via: 'zoho_oidc',
      },
    };

    const encoded = Buffer.from(JSON.stringify(sessionPayload), 'utf8').toString('base64url');
    const completePath = `/auth/sso/complete?payload=${encoded}`;
    const tenantUrl = buildSubdomainUrl(subdomain);

    // buildSubdomainUrl returns origin only; append path
    const redirectTo = `${String(tenantUrl).replace(/\/$/, '')}${completePath}`;

    logger.log(
      `[ZohoSSO] Success email=${email} org=${registryOrgId} subdomain=${subdomain} → ${subdomain}`
    );
    return res.redirect(302, redirectTo);
  } catch (err) {
    console.error('[ZohoSSO] callback failed:', err?.message || err, err?.details || '');
    return redirectWithError(
      res,
      err?.message || 'Zoho sign-in failed. Try again or use email/password.'
    );
  }
};

module.exports = {
  zohoLoginStart,
  zohoLoginCallback,
};
