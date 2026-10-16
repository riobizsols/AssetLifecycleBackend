/**
 * Pressana (pressana_db, org ORG001) — Fire Safety Equipment (AT009) setup:
 * in-house maintenance, 2 tech certificates, maintenance checklist with a spare-part item,
 * spare category, 2-approver workflow (System Admin + new Fire Safety Officer),
 * new employee/user/role, and inspection checklist.
 *
 * Usage: node scripts/setup-pressana-fire-safety.js           (dry run, rolls back)
 *        node scripts/setup-pressana-fire-safety.js --apply   (commits)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const APPLY = process.argv.includes('--apply');
const TENANT_DB = 'pressana_db';
const REGISTRY_ORG = 'PK001';
const SUBDOMAIN = 'pressana';
const ORG = 'ORG001';
const AT = 'AT009';
const FREQ_ID = 'ATMF009';
const ADMIN_USER = 'USR001';
const ADMIN_ROLE = 'JR001';
const ROLE_TEMPLATE = 'JR021';
const DEPT = 'DPT001';
const MAINT_TYPE = 'MT006';
const UOM_DAYS = 'UOM001';

const OFFICER = {
  name: 'Fire Safety Officer',
  first: 'Fire Safety',
  last: 'Officer',
  email: 'firesafety@pressana.com',
  phone: '9000000000',
  tempPassword: 'FireSafety@2026',
};

const CERTS = [
  { name: 'Fire Extinguisher Servicing Certification', no: 'FES-001' },
  { name: 'Fire Alarm & Detection System Certification', no: 'FADS-001' },
];

const SPARE_CATEGORY = { text: 'Fire Extinguisher Refill & Spares', uom: 'PCS', min: 2, reorder: 5 };

const MAINT_CHECKLIST = [
  { text: 'Pressure gauge reading in green zone', spare: false },
  { text: 'Safety pin, tamper seal, hose & nozzle intact', spare: false },
  { text: 'Cylinder free of corrosion, dents or leakage', spare: false },
  { text: 'Mounted, accessible and signage visible', spare: false },
  { text: 'Test alarm panel, sounders and indicator lamps', spare: false },
  { text: 'Refill agent / replace worn spares', spare: true },
];

const INSP_ITEMS = [
  { text: 'Safety Pin & Tamper Seal Intact', type: 'Qualitative', expected: 'Yes', trigger: true },
  { text: 'Hose & Nozzle Condition', type: 'Qualitative', expected: 'Good', trigger: true },
  { text: 'Extinguisher Accessible & Signage Visible', type: 'Qualitative', expected: 'Yes', trigger: false },
  { text: 'Fire Alarm Panel Healthy (No Faults)', type: 'Qualitative', expected: 'Yes', trigger: true },
  { text: 'Smoke Detector Test Passed', type: 'Qualitative', expected: 'Yes', trigger: true },
];
const INSP_FREQ_DAYS = 30;

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

const usedSeq = new Map();

async function nextId(c, table, column, prefix, pad, sep = '', seqKey = null) {
  const re = `^${prefix.replace(/[-_]/g, (m) => `\\${m}`)}${sep}[0-9]+$`;
  const { rows } = await c.query(
    `SELECT MAX(CAST(SUBSTRING(${column} FROM $2::int) AS BIGINT)) AS n FROM "${table}" WHERE ${column} ~ $1`,
    [re, prefix.length + sep.length + 1],
  );
  let n = Number(rows[0].n || 0);
  if (seqKey) {
    const s = await c.query(`SELECT last_number FROM "tblIDSequences" WHERE table_key=$1`, [seqKey]);
    n = Math.max(n, Number(s.rows[0]?.last_number || 0));
  }
  return (k = 1) => {
    if (seqKey) usedSeq.set(seqKey, Math.max(usedSeq.get(seqKey) || 0, n + k));
    return `${prefix}${sep}${String(n + k).padStart(pad, '0')}`;
  };
}

async function flushSequences(c) {
  for (const [key, n] of usedSeq) {
    await c.query(`UPDATE "tblIDSequences" SET last_number = GREATEST(last_number, $2) WHERE table_key = $1`, [key, n]);
  }
}

async function main() {
  const c = new Client({ connectionString: dbUrl(TENANT_DB), ssl: false });
  await c.connect();
  const log = [];
  const say = (msg) => { log.push(msg); console.log(msg); };

  try {
    await c.query('BEGIN');

    const at = (await c.query(`SELECT text FROM "tblAssetTypes" WHERE asset_type_id=$1 AND org_id=$2`, [AT, ORG])).rows[0];
    if (!at) throw new Error(`${AT} not found`);
    const exists = await c.query(`SELECT 1 FROM "tblUsers" WHERE LOWER(email)=LOWER($1)`, [OFFICER.email]);
    if (exists.rowCount) throw new Error(`User ${OFFICER.email} already exists — aborting to avoid duplicates`);

    // 1. Asset type flags
    await c.query(
      `UPDATE "tblAssetTypes" SET required_maint=true, required_spare_parts=true, changed_by=$3, changed_on=CURRENT_DATE
        WHERE asset_type_id=$1 AND org_id=$2`,
      [AT, ORG, ADMIN_USER],
    );
    say(`AssetType ${AT} (${at.text}): required_maint=true, required_spare_parts=true`);

    // 2. Job role (copy nav from template)
    const roleId = (await nextId(c, 'tblJobRoles', 'job_role_id', 'JR', 3, '', 'jobrole'))();
    await c.query(
      `INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status, notif_warranty, notif_scrap)
       VALUES ($1,$2,$3,$4,1,false,false)`,
      [ORG, roleId, OFFICER.name, 'Fire safety maintenance & inspection approvals'],
    );
    const navRows = (await c.query(
      `SELECT * FROM "tblJobRoleNav" WHERE job_role_id=$1 AND org_id=$2 ORDER BY job_role_nav_id`,
      [ROLE_TEMPLATE, ORG],
    )).rows;
    const navId = await nextId(c, 'tblJobRoleNav', 'job_role_nav_id', 'JRN', 6, '', 'jobrolenav');
    const navMap = new Map(navRows.map((r, i) => [r.job_role_nav_id, navId(i + 1)]));
    for (const r of navRows) {
      await c.query(
        `INSERT INTO "tblJobRoleNav" (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label,
           sub_menu, sequence, access_level, is_group, mob_desk, branch_id, dept_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [navMap.get(r.job_role_nav_id), r.org_id, r.int_status, roleId, r.parent_id ? navMap.get(r.parent_id) || null : null,
          r.app_id, r.label, r.sub_menu, r.sequence, r.access_level, r.is_group, r.mob_desk, r.branch_id, r.dept_id],
      );
    }
    say(`JobRole ${roleId} "${OFFICER.name}" with ${navRows.length} menu entries copied from ${ROLE_TEMPLATE}`);

    // 3. Employee + user + user role
    const empIntId = (await nextId(c, 'tblEmployees', 'emp_int_id', 'EMP_INT', 4, '_', 'emp_int_id'))();
    const employeeId = (await nextId(c, 'tblEmployees', 'employee_id', 'EMP', 3, '', 'employee'))();
    await c.query(
      `INSERT INTO "tblEmployees" (emp_int_id, employee_id, name, first_name, last_name, middle_name, full_name, email_id,
         dept_id, phone_number, employee_type, joining_date, language_code, int_status,
         created_by, created_on, changed_by, changed_on, org_id)
       VALUES ($1,$2,$3,$4,$5,'',$3,$6,$7,$8,'Full-time',CURRENT_DATE,'en',1,$9,NOW(),$9,NOW(),$10)`,
      [empIntId, employeeId, OFFICER.name, OFFICER.first, OFFICER.last, OFFICER.email, DEPT, OFFICER.phone, ADMIN_USER, ORG],
    );
    const userId = (await nextId(c, 'tblUsers', 'user_id', 'USR', 3, '', 'user'))();
    const hash = await bcrypt.hash(OFFICER.tempPassword, 10);
    await c.query(
      `INSERT INTO "tblUsers" (org_id, user_id, full_name, email, phone, job_role_id, password, created_by, created_on,
         changed_by, changed_on, time_zone, date_format, language_code, int_status, dept_id, emp_int_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$8,CURRENT_DATE,'IST','YYYY-MM-DD','EN',1,$9,$10)`,
      [ORG, userId, OFFICER.name, OFFICER.email, OFFICER.phone, roleId, hash, ADMIN_USER, DEPT, empIntId],
    );
    const ujrId = (await nextId(c, 'tblUserJobRoles', 'user_job_role_id', 'UJR', 3, '', 'userjobrole'))();
    await c.query(
      `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id, org_id) VALUES ($1,$2,$3,$4)`,
      [ujrId, userId, roleId, ORG],
    );
    say(`Employee ${empIntId}/${employeeId}, User ${userId} (${OFFICER.email}) with role ${roleId}`);

    // 4. Tech certificates → asset type mapping → employee certs
    const tcId = await nextId(c, 'tblTechCert', 'tc_id', 'TCERT', 3, '', 'tcert');
    const atmcId = await nextId(c, 'tblATMaintCert', 'atmc_id', 'ATMC', 3, '', 'atmc');
    const etcId = await nextId(c, 'tblEmpTechCert', 'etc_id', 'ETC', 3, '', 'etc');
    const certIds = [];
    for (let i = 0; i < CERTS.length; i++) {
      const id = tcId(i + 1);
      certIds.push(id);
      await c.query(
        `INSERT INTO "tblTechCert" (tc_id, certificate_name, certificate_no, created_by, created_on, org_id)
         VALUES ($1,$2,$3,$4,NOW(),$5)`,
        [id, CERTS[i].name, CERTS[i].no, ADMIN_USER, ORG],
      );
      const mapId = atmcId(i + 1);
      await c.query(
        `INSERT INTO "tblATMaintCert" (atmc_id, asset_type_id, tc_id, created_by, created_on, maint_type_id, org_id,
           is_mandatory, requires_expiry, expiry_alert_days)
         VALUES ($1,$2,$3,$4,NOW(),$5,$6,true,true,30)`,
        [mapId, AT, id, ADMIN_USER, MAINT_TYPE, ORG],
      );
      const empCertId = etcId(i + 1);
      await c.query(
        `INSERT INTO "tblEmpTechCert" (etc_id, emp_int_id, tc_id, certificate_date, certificate_expiry, status,
           created_by, created_on, org_id)
         VALUES ($1,$2,$3,TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'),TO_CHAR(CURRENT_DATE + INTERVAL '2 years','YYYY-MM-DD'),
           'Approved',$4,NOW(),$5)`,
        [empCertId, empIntId, id, ADMIN_USER, ORG],
      );
    }
    say(`Certificates ${certIds.join(', ')} mapped to ${AT} (mandatory) and held by ${empIntId}`);

    // 5. In-house maintenance frequency
    await c.query(
      `UPDATE "tblATMaintFreq" SET maintained_by='Inhouse', maint_type_id=$3, emp_int_id=$4
        WHERE at_main_freq_id=$1 AND org_id=$2`,
      [FREQ_ID, ORG, MAINT_TYPE, empIntId],
    );
    say(`Frequency ${FREQ_ID}: maintained_by=Inhouse, maint_type=${MAINT_TYPE} (Preventive), technician=${empIntId}`);

    // 6. Spare category + asset-type map
    const spcId = (await nextId(c, 'tblSPCategory', 'spc_id', 'SPC', 3, '', 'sp_category'))();
    await c.query(
      `INSERT INTO "tblSPCategory" (spc_id, text, uom, minimum_stock, re_order_level, int_status, org_id,
         created_by, created_on, changed_by, changed_on, last_gen_seq_no)
       VALUES ($1,$2,$3,$4,$5,1,$6,$7,NOW(),$7,NOW(),0)`,
      [spcId, SPARE_CATEGORY.text, SPARE_CATEGORY.uom, SPARE_CATEGORY.min, SPARE_CATEGORY.reorder, ORG, ADMIN_USER],
    );
    const spcatmId = (await nextId(c, 'tblSPCatATMap', 'spcatm_id', 'SPCATM', 3, '', 'sp_cat_at_map'))();
    await c.query(
      `INSERT INTO "tblSPCatATMap" (spcatm_id, spc_id, asset_type_id, int_status, org_id, created_by, created_on, changed_by, changed_on)
       VALUES ($1,$2,$3,1,$4,$5,NOW(),$5,NOW())`,
      [spcatmId, spcId, AT, ORG, ADMIN_USER],
    );
    say(`Spare category ${spcId} "${SPARE_CATEGORY.text}" mapped to ${AT} via ${spcatmId}`);

    // 7. Maintenance checklist
    const clId = await nextId(c, 'tblATMaintCheckList', 'at_main_checklist_id', 'ATMCL', 3, '', 'atmcl');
    for (let i = 0; i < MAINT_CHECKLIST.length; i++) {
      const id = clId(i + 1);
      const item = MAINT_CHECKLIST[i];
      await c.query(
        `INSERT INTO "tblATMaintCheckList" (at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id,
           required_spare_part, spcatm_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, ORG, AT, item.text, FREQ_ID, item.spare, item.spare ? spcatmId : null],
      );
    }
    say(`Maintenance checklist: ${MAINT_CHECKLIST.length} items on ${FREQ_ID} (1 requires spare ${spcatmId})`);

    // 8. Workflow: 2 approval steps
    const stepId = await nextId(c, 'tblWFSteps', 'wf_steps_id', 'WFS', 2, '-');
    const step1 = stepId(1);
    const step2 = stepId(2);
    await c.query(
      `INSERT INTO "tblWFSteps" (wf_steps_id, org_id, text, esc_no_days) VALUES ($1,$3,'System Administrator Approval',1), ($2,$3,'Fire Safety Officer Approval',1)`,
      [step1, step2, ORG],
    );
    const wfjrId = await nextId(c, 'tblWFJobRole', 'wf_job_role_id', 'WFJR', 2, '-');
    await c.query(
      `INSERT INTO "tblWFJobRole" (wf_job_role_id, wf_steps_id, job_role_id, dept_id, org_id)
       VALUES ($1,$3,$5,$7,$8), ($2,$4,$6,$7,$8)`,
      [wfjrId(1), wfjrId(2), step1, step2, ADMIN_ROLE, roleId, DEPT, ORG],
    );
    const oldSeqs = (await c.query(`DELETE FROM "tblWFATSeqs" WHERE asset_type_id=$1 RETURNING wf_at_seqs_id, wf_steps_id, seqs_no`, [AT])).rows;
    const wfasId = await nextId(c, 'tblWFATSeqs', 'wf_at_seqs_id', 'WFAS', 3, '', 'wfas');
    const seqA = wfasId(1);
    const seqB = wfasId(2);
    await c.query(
      `INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
       VALUES ($1,$3,$4,'10',$6), ($2,$3,$5,'20',$6)`,
      [seqA, seqB, AT, step1, step2, ORG],
    );
    say(`Workflow for ${AT}: replaced ${oldSeqs.length} old steps (${oldSeqs.map((s) => s.wf_steps_id).join(',')}) with`);
    say(`   10 ${step1} System Administrator Approval -> ${ADMIN_ROLE}`);
    say(`   20 ${step2} Fire Safety Officer Approval  -> ${roleId}`);

    // 9. Inspection checklist (all in-house, same frequency)
    const icId = await nextId(c, 'tblInspCheckList', 'insp_check_id', 'IC', 3, '', 'IC');
    const aaticId = await nextId(c, 'tblAATInspCheckList', 'aatic_id', 'AATIC', 3, '', 'aat_insp_checklist');
    const aatifId = await nextId(c, 'tblAAT_Insp_Freq', 'aatif_id', 'AATIF', 3, '', 'aatif_id');
    for (let i = 0; i < INSP_ITEMS.length; i++) {
      const item = INSP_ITEMS[i];
      await c.query(
        `INSERT INTO "tblInspCheckList" (insp_check_id, inspection_text, response_type, expected_value, trigger_maintenance,
           org_id, created_by, created_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [icId(i + 1), item.text, item.type, item.expected, item.trigger, ORG, ADMIN_USER],
      );
      await c.query(
        `INSERT INTO "tblAATInspCheckList" (aatic_id, at_id, insp_check_id, expected_value, trigger_maintenance, org_id,
           created_by, created_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [aaticId(i + 1), AT, icId(i + 1), item.expected, item.trigger, ORG, ADMIN_USER],
      );
      await c.query(
        `INSERT INTO "tblAAT_Insp_Freq" (aatif_id, aatic_id, freq, uom, text, maintained_by, int_status, org_id,
           is_recurring, created_by, created_on, emp_int_id)
         VALUES ($1,$2,$3,$4,'Monthly','inhouse',1,$5,true,$6,NOW(),$7)`,
        [aatifId(i + 1), aaticId(i + 1), INSP_FREQ_DAYS, UOM_DAYS, ORG, ADMIN_USER, empIntId],
      );
    }
    const existingFreqs = await c.query(
      `UPDATE "tblAAT_Insp_Freq" f SET freq=$2, uom=$3, text='Monthly', maintained_by='inhouse', emp_int_id=$4,
              int_status=1, changed_by=$5, changed_on=NOW()
         FROM "tblAATInspCheckList" c
        WHERE c.aatic_id=f.aatic_id AND c.at_id=$1 AND f.aatif_id <> ALL($6::text[])
        RETURNING f.aatif_id`,
      [AT, INSP_FREQ_DAYS, UOM_DAYS, empIntId, ADMIN_USER, INSP_ITEMS.map((_, i) => aatifId(i + 1))],
    );
    say(`Inspection: +${INSP_ITEMS.length} checklist items; existing frequencies ${existingFreqs.rows.map((r) => r.aatif_id).join(', ')} aligned to in-house every ${INSP_FREQ_DAYS} days (technician ${empIntId})`);

    await flushSequences(c);
    say(`ID sequences advanced: ${[...usedSeq].map(([k, n]) => `${k}=${n}`).join(', ')}`);

    if (APPLY) {
      await c.query('COMMIT');
      say('COMMITTED to pressana_db');
    } else {
      await c.query('ROLLBACK');
      say('DRY RUN — rolled back (run with --apply to commit)');
    }

    if (APPLY) {
      const reg = new Client({ connectionString: dbUrl('postgres'), ssl: false });
      await reg.connect();
      try {
        await reg.query(
          `INSERT INTO tenant_user_emails (email_normalized, email_display, org_id, subdomain, user_id, employee_id, source, created_at, updated_at)
           VALUES (LOWER($1), $1, $2, $3, $4, $5, 'create_user_for_employee', NOW(), NOW())
           ON CONFLICT (email_normalized) DO NOTHING`,
          [OFFICER.email, REGISTRY_ORG, SUBDOMAIN, userId, empIntId],
        );
        say(`Registered ${OFFICER.email} in tenant_user_emails -> ${REGISTRY_ORG}/${SUBDOMAIN}`);
      } finally {
        await reg.end();
      }
    }
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('FAILED (rolled back):', err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
