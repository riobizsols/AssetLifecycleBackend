require('dotenv').config();
const { Client } = require('pg');

const DEFAULT_TYPES = [
  {
    irtd_id: 'IRTD_QN_001',
    name: 'QN',
    expected_value: null,
    option: null,
  },
  {
    irtd_id: 'IRTD_QL_YES_NO_001',
    name: 'QL',
    expected_value: 'Yes/No',
    option: 'Yes,No',
  },
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Prefer first Bannari org for org_id if required
  const org = await c.query(
    `SELECT org_id FROM "tblOrgs" WHERE org_id LIKE 'BAN%' ORDER BY org_id LIMIT 1`
  );
  const orgId = org.rows[0]?.org_id || 'BAN001';

  for (const row of DEFAULT_TYPES) {
    const result = await c.query(
      `
      INSERT INTO "tblInspResTypeDet" (
        irtd_id, name, expected_value, option, org_id, created_by, created_on
      ) VALUES ($1, $2, $3, $4, $5, 'SYSTEM', NOW())
      ON CONFLICT (irtd_id) DO UPDATE SET
        name = EXCLUDED.name,
        expected_value = COALESCE(EXCLUDED.expected_value, "tblInspResTypeDet".expected_value),
        option = COALESCE(EXCLUDED.option, "tblInspResTypeDet".option),
        changed_by = 'SYSTEM',
        changed_on = NOW()
      RETURNING irtd_id, name, org_id
      `,
      [row.irtd_id, row.name, row.expected_value, row.option, orgId]
    );
    console.log('upserted', result.rows[0]);
  }

  const check = await c.query(`
    SELECT irtd_id, name FROM "tblInspResTypeDet"
    WHERE irtd_id IN ('IRTD_QN_001', 'IRTD_QL_YES_NO_001')
    ORDER BY name DESC
  `);
  console.log('available for dropdown', check.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
