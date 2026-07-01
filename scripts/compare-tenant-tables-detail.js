require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const tenantDb = 'skasc_db';
const hospUrl = process.env.DATABASE_URL;
const skascUrl = process.env.TENANT_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, `/${tenantDb}$1`);

async function listTables(pool) {
  const { rows } = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY table_name
  `);
  return rows;
}

(async () => {
  const hosp = new Pool({ connectionString: hospUrl, ssl: false });
  const skasc = new Pool({ connectionString: skascUrl, ssl: false });
  const [hRows, sRows] = await Promise.all([listTables(hosp), listTables(skasc)]);
  await hosp.end();
  await skasc.end();

  const hNames = hRows.map((r) => r.table_name);
  const sNames = sRows.map((r) => r.table_name);
  const hSet = new Set(hNames);
  const sSet = new Set(sNames);

  const missing = hNames.filter((t) => !sSet.has(t));
  const extra = sNames.filter((t) => !hSet.has(t));
  const shared = hNames.filter((t) => sSet.has(t));

  const hType = Object.fromEntries(hRows.map((r) => [r.table_name, r.table_type]));
  const sType = Object.fromEntries(sRows.map((r) => [r.table_name, r.table_type]));

  const watch = [
    'tblJobs', 'tblJobHistory', 'tblATInspCert', 'tblATInspCerts',
    'tblAssetExpiryNotify', 'tblAssetMaintSch_BR_Hist', 'tblWFScrapHist', 'tblvendorslarecs',
  ];

  console.log('WHY SAME COUNT:', hNames.length, 'vs', sNames.length);
  console.log('  shared:', shared.length);
  console.log('  missing in skasc:', missing.length, '->', missing.join(', '));
  console.log('  extra in skasc:', extra.length, '->', extra.join(', '));
  console.log('  math:', shared.length, '+', extra.length, '=', shared.length + extra.length);
  console.log('');
  console.log('WATCHED TABLES:');
  for (const t of watch) {
    const inH = hSet.has(t);
    const inS = sSet.has(t);
    console.log(
      `  ${t}: hospitality=${inH ? hType[t] : 'ABSENT'} | skasc=${inS ? sType[t] : 'ABSENT'}`
    );
  }
  console.log('');
  console.log('MISSING IN SKASC (' + missing.length + '):');
  missing.forEach((t) => console.log('  -', t, `(hospitality: ${hType[t]})`));
  console.log('');
  console.log('EXTRA IN SKASC (' + extra.length + '):');
  extra.forEach((t) => console.log('  +', t, `(skasc: ${sType[t]})`));
  console.log('');
  console.log('ALL HOSPITALITY TABLES (' + hNames.length + '):');
  hNames.forEach((t) => console.log('  ', t));
  console.log('');
  console.log('ALL SKASC TABLES (' + sNames.length + '):');
  sNames.forEach((t) => console.log('  ', t));

  fs.writeFileSync(
    path.join(__dirname, 'compare-skasc-full-report.txt'),
    [
      `hospitality: ${hNames.length} tables/views`,
      `skasc_db: ${sNames.length} tables/views`,
      `shared: ${shared.length}`,
      `missing in skasc: ${missing.join(', ')}`,
      `extra in skasc: ${extra.join(', ')}`,
      '',
      '--- hospitality full list ---',
      ...hNames,
      '',
      '--- skasc full list ---',
      ...sNames,
    ].join('\n')
  );
})();
