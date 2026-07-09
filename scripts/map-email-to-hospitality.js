require('dotenv').config();
const { Pool } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');

const EMAIL = 'nivethakaliyappan@gmail.com';

(async () => {
  const hospitality = new Pool(buildPoolConfig(process.env.DATABASE_URL, { connectionTimeoutMillis: 15000 }));
  const registry = new Pool(buildPoolConfig(process.env.TENANT_DATABASE_URL, { connectionTimeoutMillis: 15000 }));

  const user = await hospitality.query(
    `SELECT user_id, email, org_id, emp_int_id
     FROM "tblUsers"
     WHERE LOWER(TRIM(email)) = $1`,
    [EMAIL]
  );

  if (!user.rows.length) {
    throw new Error(`User not found in hospitality: ${EMAIL}`);
  }

  const row = user.rows[0];
  const result = await registry.query(
    `INSERT INTO tenant_user_emails (
       email_normalized, email_display, org_id, subdomain, user_id, employee_id, source
     ) VALUES ($1, $2, $3, 'hospitality', $4, $5, 'manual_hospitality')
     ON CONFLICT (email_normalized) DO UPDATE
       SET email_display = EXCLUDED.email_display,
           org_id = EXCLUDED.org_id,
           subdomain = EXCLUDED.subdomain,
           user_id = EXCLUDED.user_id,
           employee_id = EXCLUDED.employee_id,
           source = EXCLUDED.source,
           updated_at = CURRENT_TIMESTAMP
     RETURNING email_normalized, org_id, subdomain, user_id, employee_id, source`,
    [EMAIL, row.email, row.org_id, row.user_id, row.emp_int_id || null]
  );

  console.log('Mapped:', result.rows[0]);
  await hospitality.end();
  await registry.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
