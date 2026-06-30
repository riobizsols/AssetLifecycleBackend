/**
 * Remap tenant org_id values and apply deferred foreign key constraints after seeding.
 */

async function listTablesWithOrgId(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
      AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name = 'org_id'
      AND c.table_name <> 'tblOrgs'
    ORDER BY c.table_name
  `);
  return rows.map((r) => r.table_name);
}

/**
 * Rewrite copied reference org_ids (ORG001, etc.) to the tenant org before FK creation.
 */
async function remapOrgIdsForTenant(client, orgId) {
  if (!orgId) {
    throw new Error('orgId is required to remap tenant org_id values');
  }

  const tables = await listTablesWithOrgId(client);
  const details = [];
  let rowsUpdated = 0;

  for (const tableName of tables) {
    const result = await client.query(
      `
        UPDATE "${tableName}"
        SET org_id = $1
        WHERE org_id IS NOT NULL AND org_id <> $1
      `,
      [orgId],
    );

    if (result.rowCount > 0) {
      details.push({ table: tableName, rowsUpdated: result.rowCount });
      rowsUpdated += result.rowCount;
    }
  }

  if (rowsUpdated > 0) {
    console.log(
      `[TenantFK] Remapped org_id to ${orgId} across ${details.length} table(s), ${rowsUpdated} row(s)`,
    );
    details.forEach((d) => {
      console.log(`[TenantFK]   - ${d.table}: ${d.rowsUpdated} row(s)`);
    });
  } else {
    console.log(`[TenantFK] org_id values already aligned with ${orgId}`);
  }

  return { orgId, tablesChecked: tables.length, rowsUpdated, details };
}

/**
 * Replace placeholder audit user ids (SYSTEM, SETUP, etc.) and any created_by/changed_by
 * values that do not exist in tblUsers — required before FK constraints are applied.
 */
async function normalizeUserReferences(client, adminUserId) {
  if (!adminUserId) {
    return { rowsUpdated: 0, details: [] };
  }

  const sentinels = ['SYSTEM', 'SETUP', 'ADMIN', 'system', 'setup', 'admin'];
  const { rows: columns } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('created_by', 'changed_by')
    ORDER BY table_name, column_name
  `);

  const details = [];
  let rowsUpdated = 0;

  for (const { table_name: tableName, column_name: columnName } of columns) {
    const result = await client.query(
      `
        UPDATE "${tableName}" AS t
        SET "${columnName}" = $1
        WHERE t."${columnName}" IS NOT NULL
          AND t."${columnName}" <> $1
          AND (
            t."${columnName}" = ANY($2::text[])
            OR NOT EXISTS (
              SELECT 1 FROM "tblUsers" u WHERE u.user_id = t."${columnName}"
            )
          )
      `,
      [adminUserId, sentinels],
    );

    if (result.rowCount > 0) {
      details.push({ table: tableName, column: columnName, rowsUpdated: result.rowCount });
      rowsUpdated += result.rowCount;
    }
  }

  if (rowsUpdated > 0) {
    console.log(
      `[TenantFK] Normalized user references to ${adminUserId} (${rowsUpdated} row(s) across ${details.length} column(s))`,
    );
    details.forEach((d) => {
      console.log(`[TenantFK]   - ${d.table}.${d.column}: ${d.rowsUpdated} row(s)`);
    });
  }

  return { rowsUpdated, details };
}

/**
 * Fail fast if any org_id still points outside tblOrgs (blocks FK creation).
 */
async function assertOrgIdIntegrity(client, orgId) {
  const tables = await listTablesWithOrgId(client);
  const violations = [];

  for (const tableName of tables) {
    const { rows } = await client.query(
      `
        SELECT COUNT(*)::int AS orphan_count
        FROM "${tableName}" t
        WHERE t.org_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "tblOrgs" o WHERE o.org_id = t.org_id)
      `,
    );

    if (rows[0].orphan_count > 0) {
      const sample = await client.query(
        `
          SELECT DISTINCT org_id
          FROM "${tableName}"
          WHERE org_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "tblOrgs" o WHERE o.org_id = "${tableName}".org_id)
          LIMIT 5
        `,
      );
      violations.push({
        table: tableName,
        orphanCount: rows[0].orphan_count,
        sampleOrgIds: sample.rows.map((r) => r.org_id),
      });
    }
  }

  const wrongTenantOrg = [];
  for (const tableName of tables) {
    const { rows } = await client.query(
      `
        SELECT COUNT(*)::int AS wrong_count
        FROM "${tableName}"
        WHERE org_id IS NOT NULL AND org_id <> $1
      `,
      [orgId],
    );
    if (rows[0].wrong_count > 0) {
      wrongTenantOrg.push({ table: tableName, count: rows[0].wrong_count });
    }
  }

  if (violations.length > 0 || wrongTenantOrg.length > 0) {
    const message = [
      'Tenant org_id integrity check failed before applying foreign keys.',
      violations.length
        ? `Orphan org_id references: ${JSON.stringify(violations.slice(0, 5))}`
        : null,
      wrongTenantOrg.length
        ? `Rows not using tenant org_id ${orgId}: ${JSON.stringify(wrongTenantOrg.slice(0, 5))}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    throw new Error(message);
  }

  return { ok: true, tablesChecked: tables.length, orgId };
}

function splitSqlStatements(sql) {
  const trimmed = sql.trim();
  if (!trimmed) return [];

  // Setup wizard wraps each FK in DO $$ ... END $$; blocks
  if (trimmed.includes('DO $$')) {
    return trimmed
      .split(/\n(?=DO \$\$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => (s.endsWith(';') ? s : `${s};`));
  }

  return trimmed
    .split(/;\s*(?=\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))
    .map((s) => (s.endsWith(';') ? s : `${s};`));
}

async function countForeignKeys(client) {
  const { rows } = await client.query(`
    SELECT COUNT(*)::int AS c
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
  `);
  return rows[0].c;
}

/**
 * Apply deferred FK DDL one statement at a time so one failure does not abort the batch.
 */
async function applyDeferredForeignKeys(client, foreignKeysSql, options = {}) {
  const { expectedCount = 0, label = 'TenantFK' } = options;

  if (!foreignKeysSql || !foreignKeysSql.trim()) {
    return { applied: 0, failed: [], totalFkInDb: await countForeignKeys(client) };
  }

  const statements = splitSqlStatements(foreignKeysSql);
  const failed = [];
  let applied = 0;

  console.log(`[${label}] Applying ${statements.length} foreign key statement(s)...`);

  for (const stmt of statements) {
    const sql = stmt.endsWith(';') ? stmt : `${stmt};`;
    try {
      await client.query(sql);
      applied += 1;
    } catch (err) {
      failed.push({
        sql: sql.slice(0, 200),
        error: err.message,
        detail: err.detail || null,
      });
      console.error(`[${label}] FK statement failed: ${err.message}`);
      if (err.detail) {
        console.error(`[${label}] Detail: ${err.detail}`);
      }
    }
  }

  const totalFkInDb = await countForeignKeys(client);
  const result = { applied, failed, totalFkInDb, expectedCount };

  if (failed.length > 0) {
    throw new Error(
      `Failed to apply ${failed.length}/${statements.length} foreign key constraint(s). ` +
        `First error: ${failed[0].error}`,
    );
  }

  if (options.strictCount !== false && expectedCount > 0 && totalFkInDb < expectedCount) {
    throw new Error(
      `Foreign key count mismatch: expected at least ${expectedCount}, found ${totalFkInDb} in database`,
    );
  }

  console.log(
    `[${label}] ✅ Applied ${applied} foreign key statement(s); total FK constraints in DB: ${totalFkInDb}`,
  );

  return result;
}

/**
 * Full pre-FK pipeline: remap org_ids, verify integrity, apply deferred FK DDL.
 */
async function finalizeTenantForeignKeys(client, orgId, foreignKeysSql, options = {}) {
  await remapOrgIdsForTenant(client, orgId);
  if (options.adminUserId) {
    await normalizeUserReferences(client, options.adminUserId);
  }
  await assertOrgIdIntegrity(client, orgId);
  return applyDeferredForeignKeys(client, foreignKeysSql, {
    expectedCount: options.expectedCount || 0,
    label: options.label || 'TenantFK',
  });
}

module.exports = {
  remapOrgIdsForTenant,
  normalizeUserReferences,
  assertOrgIdIntegrity,
  applyDeferredForeignKeys,
  finalizeTenantForeignKeys,
  countForeignKeys,
};
