require('dotenv').config();

const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const ASSET_TYPE_REFERENCE_COLUMNS = [
  ['tblAssets', 'asset_type_id'],
  ['tblProdServs', 'asset_type_id'],
  ['tblDeptAssetTypes', 'asset_type_id'],
  ['tblAATInspCheckList', 'at_id'],
  ['tblATBRReasonCodes', 'asset_type_id'],
  ['tblATDocs', 'asset_type_id'],
  ['tblATInspCert', 'asset_type_id'],
  ['tblATMaintCert', 'asset_type_id'],
  ['tblATMaintCheckList', 'asset_type_id'],
  ['tblATMaintFreq', 'asset_type_id'],
  ['tblAssetTypeProps', 'asset_type_id'],
  ['tblWFATInspSeqs', 'at_id'],
  ['tblWFATSeqs', 'asset_type_id'],
  ['tblWFScrapSeq', 'asset_type_id'],
];

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

async function tableExists(client, tableName) {
  const result = await client.query(
    'select to_regclass($1) is not null as exists',
    [`public.${quoteIdentifier(tableName)}`],
  );
  return result.rows[0].exists;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `select exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = $1
         and column_name = $2
     ) as exists`,
    [tableName, columnName],
  );
  return result.rows[0].exists;
}

async function remapAssetTypeColumn(client, tableName, columnName) {
  if (!(await tableExists(client, tableName)) || !(await columnExists(client, tableName, columnName))) {
    return 0;
  }

  const result = await client.query(
    `update ${quoteIdentifier(tableName)} child
        set ${quoteIdentifier(columnName)} = map.canonical_id
       from bannari_asset_type_map map
      where child.${quoteIdentifier(columnName)} = map.old_id
        and map.old_id <> map.canonical_id`,
  );
  return result.rowCount;
}

async function count(client, tableName) {
  const result = await client.query(`select count(*)::int as n from ${quoteIdentifier(tableName)}`);
  return result.rows[0].n;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  let inTransaction = false;
  try {
    const database = (await client.query('select current_database() as name')).rows[0].name;
    if (database !== TARGET_DATABASE) {
      throw new Error(`Refusing to modify ${database}; expected ${TARGET_DATABASE}`);
    }

    const orgResult = await client.query(`
      select org_id
      from "tblOrgs"
      where org_id like 'BAN%'
      order by org_id
    `);
    const orgIds = orgResult.rows.map((row) => row.org_id);
    if (!orgIds.length) {
      throw new Error('No Bannari organizations were found');
    }

    const assetCountBefore = await count(client, 'tblAssets');
    const assignmentCountBefore = await count(client, 'tblAssetAssignments');

    await client.query('begin');
    inTransaction = true;

    await client.query(`
      create temporary table bannari_asset_type_map (
        old_id text primary key,
        canonical_id text not null,
        org_id text not null
      ) on commit drop
    `);
    await client.query(
      `
        insert into bannari_asset_type_map (old_id, canonical_id, org_id)
        with ranked as (
          select
            asset_type_id,
            org_id,
            first_value(asset_type_id) over (
              partition by org_id, lower(trim(coalesce(text, '')))
              order by int_status desc, asset_type_id
            ) as canonical_id
          from "tblAssetTypes"
          where org_id = any($1::text[])
        )
        select asset_type_id, canonical_id, org_id
        from ranked
      `,
      [orgIds],
    );

    const duplicateResult = await client.query(`
      select count(*)::int as n
      from bannari_asset_type_map
      where old_id <> canonical_id
    `);
    const duplicateCount = duplicateResult.rows[0].n;

    if (await columnExists(client, 'tblAssetTypes', 'parent_asset_type_id')) {
      await remapAssetTypeColumn(client, 'tblAssetTypes', 'parent_asset_type_id');
    }

    let remappedReferences = 0;
    for (const [tableName, columnName] of ASSET_TYPE_REFERENCE_COLUMNS) {
      remappedReferences += await remapAssetTypeColumn(client, tableName, columnName);
    }

    if (await tableExists(client, 'tblDeptAssetTypes')) {
      await client.query(`
        with ranked as (
          select
            ctid,
            row_number() over (
              partition by org_id, dept_id, asset_type_id
              order by int_status desc, dept_asset_type_id
            ) as row_number
          from "tblDeptAssetTypes"
          where org_id = any($1::text[])
        )
        delete from "tblDeptAssetTypes" dat
        using ranked
        where dat.ctid = ranked.ctid
          and ranked.row_number > 1
      `, [orgIds]);
    }

    const deletedResult = await client.query(`
      delete from "tblAssetTypes" asset_type
      using bannari_asset_type_map map
      where asset_type.asset_type_id = map.old_id
        and map.old_id <> map.canonical_id
    `);
    if (deletedResult.rowCount !== duplicateCount) {
      throw new Error(
        `Expected to delete ${duplicateCount} duplicate asset types, deleted ${deletedResult.rowCount}`,
      );
    }

    const duplicateCheck = await client.query(`
      select count(*)::int as n
      from (
        select org_id, lower(trim(coalesce(text, ''))) as type_name
        from "tblAssetTypes"
        where org_id = any($1::text[])
        group by org_id, lower(trim(coalesce(text, '')))
        having count(*) > 1
      ) duplicates
    `, [orgIds]);
    if (duplicateCheck.rows[0].n !== 0) {
      throw new Error(`Duplicate organization-level asset types remain: ${duplicateCheck.rows[0].n}`);
    }

    const missingAssignments = await client.query(`
      select count(*)::int as n
      from "tblAssets" asset
      left join lateral (
        select assignment.dept_id
        from "tblAssetAssignments" assignment
        where assignment.asset_id = asset.asset_id
          and assignment.org_id = asset.org_id
          and assignment.latest_assignment_flag = true
        order by assignment.action_on desc, assignment.asset_assign_id desc
        limit 1
      ) assignment on true
      where asset.org_id = any($1::text[])
        and assignment.dept_id is null
    `, [orgIds]);
    if (missingAssignments.rows[0].n !== 0) {
      throw new Error(`Assets missing department assignments: ${missingAssignments.rows[0].n}`);
    }

    const duplicateDeptMappings = await client.query(`
      select count(*)::int as n
      from (
        select org_id, dept_id, asset_type_id
        from "tblDeptAssetTypes"
        where org_id = any($1::text[])
        group by org_id, dept_id, asset_type_id
        having count(*) > 1
      ) duplicates
    `, [orgIds]);
    if (duplicateDeptMappings.rows[0].n !== 0) {
      throw new Error(`Duplicate department asset-type mappings remain: ${duplicateDeptMappings.rows[0].n}`);
    }

    for (const [tableName, columnName] of ASSET_TYPE_REFERENCE_COLUMNS) {
      if (!(await tableExists(client, tableName)) || !(await columnExists(client, tableName, columnName))) {
        continue;
      }
      const orphanResult = await client.query(
        `select count(*)::int as n
         from ${quoteIdentifier(tableName)} child
         left join "tblAssetTypes" asset_type
           on asset_type.asset_type_id = child.${quoteIdentifier(columnName)}
        where child.${quoteIdentifier(columnName)} is not null
          and asset_type.asset_type_id is null`,
      );
      if (orphanResult.rows[0].n !== 0) {
        throw new Error(
          `${tableName}.${columnName} has ${orphanResult.rows[0].n} orphan asset-type references`,
        );
      }
    }

    const assetCountAfter = await count(client, 'tblAssets');
    const assignmentCountAfter = await count(client, 'tblAssetAssignments');
    if (assetCountAfter !== assetCountBefore || assignmentCountAfter !== assignmentCountBefore) {
      throw new Error(
        `Asset data changed unexpectedly: assets ${assetCountBefore}->${assetCountAfter}, ` +
        `assignments ${assignmentCountBefore}->${assignmentCountAfter}`,
      );
    }
    if (assetCountAfter !== 322 || assignmentCountAfter !== 322) {
      throw new Error(
        `Expected 322 assets and assignments, found ${assetCountAfter} and ${assignmentCountAfter}`,
      );
    }

    await client.query('commit');
    inTransaction = false;
    console.log(JSON.stringify({
      database,
      organizations: orgIds.length,
      duplicate_asset_types_removed: duplicateCount,
      asset_type_references_remapped: remappedReferences,
      assets_preserved: assetCountAfter,
      assignments_preserved: assignmentCountAfter,
    }, null, 2));
  } catch (error) {
    if (inTransaction) {
      await client.query('rollback').catch(() => {});
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Bannari asset-type consolidation failed: ${error.message}`);
  process.exitCode = 1;
});
