/**
 * presanna (presanna_db) — Fire Safety Equipment for KIA (ORG005, AT003) and Honda (ORG006, AT013):
 * monthly in-house maintenance, certificates, checklist with spare-part item, 2-approver maintenance
 * and inspection workflows (System Administrator → new Fire Safety Officer), inspection checklist.
 *
 * Usage: node scripts/setup-presanna-fire-safety.js           (dry run, rolls back)
 *        node scripts/setup-presanna-fire-safety.js --apply   (commits)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const APPLY = process.argv.includes('--apply');
const TENANT_DB = 'presanna_db';
const SUBDOMAIN = 'presanna';
const HOME_ORG = 'ORG005';
const ADMIN_USER = 'USR001';
const ADMIN_ROLE = 'JR001';
const MAINT_TYPE = 'MT002';
const UOM_DAYS = 'UOM001';
const FREQ_DAYS = 30;
const CERT_IDS = ['TCERT012', 'TCERT013'];

const OFFICER = {
  name: 'Fire Safety Officer',
  first: 'Fire Safety',
  last: 'Officer',
  email: 'firesafety@presanna.com',
  phone: '9000000000',
  tempPassword: 'FireSafety@2026',
  dept: 'DPT008',
  branch: 'BR001',
};

const ORGS = [
  { org: 'ORG005', label: 'KIA', at: 'AT003', freqId: 'ATMF001', dept: 'DPT008' },
  { org: 'ORG006', label: 'Honda', at: 'AT013', freqId: null, dept: 'DPT017', copyFrom: 'ORG005' },
];

const NAV_APP_IDS = [
  'DASHBOARD', 'SUPERVISORAPPROVAL', 'MAINTENANCESCHEDULE', 'MAINTENANCEAPPROVAL', 'MAINTENANCEHISTORY',
  'INSPECTIONVIEW', 'INSPECTIONAPPROVAL', 'SPAREPARTS', 'SPAREPARTLIST', 'SPAREPARTAPPROVAL', 'SPAREPARTISSUE',
  'EMPLOYEE TECH CERTIFICATION',
];
const NAV_MOBILE_GROUPS = ['Maintenance Supervisor'];

const INSP_ITEMS = [
  { text: 'Pressure Gauge in Green Zone', type: 'Qualitative', expected: 'Yes', trigger: true },
  { text: 'Safety Pin & Tamper Seal Intact', type: 'Qualitative', expected: 'Yes', trigger: true },
  { text: 'Hose & Nozzle Condition', type: 'Qualitative', expected: 'Good', trigger: true },
  { text: 'Extinguisher Accessible & Signage Visible', type: 'Qualitative', expected: 'Yes', trigger: false },
  { text: 'Cylinder Pressure (Bar)', type: 'Quantitative', min: 12, max: 18, trigger: true },
];

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

const usedSeq = new Map();

async function nextId(c, table, column, prefix, pad, sep = '', seqKey = null) {
  const re = `^${prefix}${sep}[0-9]+$`;
  const { rows } = await c.query(
    `SELECT MAX(CAST(SUBSTRING(${column} FROM $2::int) AS BIGINT)) AS n FROM "${table}" WHERE ${column} ~ $1`,
    [re, prefix.length + sep.length + 1],
  );
  let n = Number(rows[0].n || 0);
  if (seqKey) {
    const s = await c.query(`SELECT last_number FROM "tblIDSequences" WHERE table_key=$1`, [seqKey]);
    n = Math.max(n, Number(s.rows[0]?.last_number || 0));
  }
  let k = 0;
  return () => {
    k += 1;
    if (seqKey) usedSeq.set(seqKey, Math.max(usedSeq.get(seqKey) || 0, n + k));
    return `${prefix}${sep}${String(n + k).padStart(pad, '0')}`;
  };
}

async function main() {
  const c = new Client({ connectionString: dbUrl(TENANT_DB), ssl: false });
  await c.connect();
  const say = (m) => console.log(m);

  try {
    await c.query('BEGIN');

    const dup = await c.query(`SELECT 1 FROM "tblUsers" WHERE LOWER(email)=LOWER($1)`, [OFFICER.email]);
    if (dup.rowCount) throw new Error(`${OFFICER.email} already exists — aborting`);

    // 0. Inspection checklist constraint only allowed legacy 'QL'/'QN'; the app stores full names.
    await c.query(`ALTER TABLE "tblInspCheckList" DROP CONSTRAINT IF EXISTS "tblInspCheckList_Response_Type_check"`);
    await c.query(
      `ALTER TABLE "tblInspCheckList" ADD CONSTRAINT "tblInspCheckList_Response_Type_check"
         CHECK (response_type IN ('Qualitative','Quantitative','QL','QN'))`,
    );
    say('tblInspCheckList response_type check now accepts Qualitative/Quantitative (and legacy QL/QN)');

    // 1. Role + menu (subset of System Administrator's nav)
    const roleId = (await nextId(c, 'tblJobRoles', 'job_role_id', 'JR', 3, '', 'job_role'))();
    await c.query(
      `INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status, notif_warranty, notif_scrap)
       VALUES ($1,$2,$3,'Fire safety maintenance & inspection approvals',1,false,false)`,
      [HOME_ORG, roleId, OFFICER.name],
    );
    const adminNav = (await c.query(`SELECT * FROM "tblJobRoleNav" WHERE job_role_id=$1`, [ADMIN_ROLE])).rows;
    const leaves = adminNav.filter((r) => NAV_APP_IDS.includes(r.app_id));
    const parentIds = new Set(leaves.map((r) => r.parent_id).filter(Boolean));
    const mobileGroups = adminNav.filter((r) => r.mob_desk === 'M' && NAV_MOBILE_GROUPS.includes(r.label));
    const navRows = [...adminNav.filter((r) => parentIds.has(r.job_role_nav_id)), ...leaves, ...mobileGroups];
    const navId = await nextId(c, 'tblJobRoleNav', 'job_role_nav_id', 'JRN', 3, '', 'jobrolenav');
    const navMap = new Map(navRows.map((r) => [r.job_role_nav_id, navId()]));
    for (const r of navRows) {
      await c.query(
        `INSERT INTO "tblJobRoleNav" (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label,
           sub_menu, sequence, access_level, is_group, mob_desk, branch_id, dept_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [navMap.get(r.job_role_nav_id), r.org_id, r.int_status, roleId, r.parent_id ? navMap.get(r.parent_id) || null : null,
          r.app_id, r.label, r.sub_menu, r.sequence, r.access_level, r.is_group, r.mob_desk, r.branch_id, r.dept_id],
      );
    }
    say(`Role ${roleId} "${OFFICER.name}" with ${navRows.length} menu entries (${leaves.map((r) => r.label).join(', ')})`);

    // 2. Employee, user, user-role, access control, certificates held
    const empIntId = (await nextId(c, 'tblEmployees', 'emp_int_id', 'EMP_INT', 4, '_', 'emp_int_id'))();
    const employeeId = (await nextId(c, 'tblEmployees', 'employee_id', 'EMP', 3, '', 'employee'))();
    await c.query(
      `INSERT INTO "tblEmployees" (emp_int_id, employee_id, name, first_name, last_name, full_name, email_id, dept_id,
         phone_number, employee_type, joining_date, language_code, int_status, created_by, created_on, changed_by,
         changed_on, org_id, branch_id)
       VALUES ($1,$2,$3,$4,$5,$3,$6,$7,$8,'PERMANENT',CURRENT_DATE,'en',1,$9,CURRENT_DATE,$9,CURRENT_DATE,$10,$11)`,
      [empIntId, employeeId, OFFICER.name, OFFICER.first, OFFICER.last, OFFICER.email, OFFICER.dept, OFFICER.phone,
        ADMIN_USER, HOME_ORG, OFFICER.branch],
    );
    const userId = (await nextId(c, 'tblUsers', 'user_id', 'USR', 3, '', 'user'))();
    await c.query(
      `INSERT INTO "tblUsers" (org_id, user_id, full_name, email, phone, job_role_id, password, created_by, created_on,
         changed_by, changed_on, time_zone, int_status, dept_id, emp_int_id, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$8,CURRENT_DATE,'IST',1,$9,$10,$11)`,
      [HOME_ORG, userId, OFFICER.name, OFFICER.email, OFFICER.phone, roleId, await bcrypt.hash(OFFICER.tempPassword, 10),
        ADMIN_USER, OFFICER.dept, empIntId, OFFICER.branch],
    );
    const ujrId = (await nextId(c, 'tblUserJobRoles', 'user_job_role_id', 'UJR', 3, '', 'userjobrole'))();
    await c.query(`INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id) VALUES ($1,$2,$3)`, [ujrId, userId, roleId]);
    const acmId = (await nextId(c, 'tblACM', 'acm_id', 'ACM', 3))();
    await c.query(
      `INSERT INTO "tblACM" (acm_id, user_id, access_level, org_id, branch_id, dept_id, int_status, created_by, created_on, changed_by, changed_on)
       VALUES ($1,$2,'Write','*','*','*',1,$3,NOW(),$3,NOW())`,
      [acmId, userId, ADMIN_USER],
    );
    const etcId = await nextId(c, 'tblEmpTechCert', 'etc_id', 'ETC', 3, '', 'etc');
    for (const tc of CERT_IDS) {
      await c.query(
        `INSERT INTO "tblEmpTechCert" (etc_id, emp_int_id, tc_id, certificate_date, certificate_expiry, status, created_by, created_on, org_id)
         VALUES ($1,$2,$3,TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'),TO_CHAR(CURRENT_DATE + INTERVAL '2 years','YYYY-MM-DD'),'Approved',$4,NOW(),$5)`,
        [etcId(), empIntId, tc, ADMIN_USER, HOME_ORG],
      );
    }
    say(`Employee ${empIntId}/${employeeId}, user ${userId} (${OFFICER.email}), access ${acmId} (all orgs, Write), holds ${CERT_IDS.join(' + ')}`);

    // 3. Per-org maintenance + inspection
    const wfsId = await nextId(c, 'tblWFSteps', 'wf_steps_id', 'WFS', 3, '', 'wfs');
    const wfjrId = await nextId(c, 'tblWFJobRole', 'wf_job_role_id', 'WFJR', 3, '', 'wfjr');
    const wfasId = await nextId(c, 'tblWFATSeqs', 'wf_at_seqs_id', 'WFAS', 3, '', 'wfas');
    const atmfId = await nextId(c, 'tblATMaintFreq', 'at_main_freq_id', 'ATMF', 3, '', 'atmf');
    const atmcId = await nextId(c, 'tblATMaintCert', 'atmc_id', 'ATMC', 3, '', 'atmc');
    const atmclId = await nextId(c, 'tblATMaintCheckList', 'at_main_checklist_id', 'ATMCL', 3, '', 'atmcl');
    const spbId = await nextId(c, 'tblSPBrand', 'spb_id', 'SPB', 3, '', 'sp_brand');
    const spmId = await nextId(c, 'tblSPBMod', 'spbm_id', 'SPBM', 3, '', 'sp_model');
    const spcId = await nextId(c, 'tblSPCategory', 'spc_id', 'SPC', 3, '', 'sp_category');
    const spcatmId = await nextId(c, 'tblSPCatATMap', 'spcatm_id', 'SPCATM', 3, '', 'sp_cat_at_map');
    const icId = await nextId(c, 'tblInspCheckList', 'insp_check_id', 'IC', 3, '', 'IC');
    const aaticId = await nextId(c, 'tblAATInspCheckList', 'aatic_id', 'AATIC', 3, '', 'aat_insp_checklist');
    const aatifId = await nextId(c, 'tblAAT_Insp_Freq', 'aatif_id', 'AATIF', 3, '', 'aatif_id');
    const wfisId = await nextId(c, 'tblWFInspSteps', 'wf_insp_steps_id', 'WFIS', 3);
    const wfijrId = await nextId(c, 'tblWFInspJobRole', 'wf_insp_job_role_id', 'WFIJR', 3, '_');
    const wfatisId = await nextId(c, 'tblWFATInspSeqs', 'wfatis_id', 'WFATIS', 3);

    const kia = ORGS[0];
    for (const o of ORGS) {
      say(`\n--- ${o.label} (${o.org}) ${o.at} ---`);

      // Frequency (monthly, in-house, officer as technician)
      if (o.freqId) {
        await c.query(
          `UPDATE "tblATMaintFreq" SET frequency=$2, uom=$3, text='Monthly', maintained_by='Inhouse', emp_int_id=$4,
                  is_recurring=true, int_status=1 WHERE at_main_freq_id=$1`,
          [o.freqId, FREQ_DAYS, UOM_DAYS, empIntId],
        );
        say(`Frequency ${o.freqId}: every ${FREQ_DAYS} days, Inhouse, technician ${empIntId}`);
      } else {
        o.freqId = atmfId();
        await c.query(
          `INSERT INTO "tblATMaintFreq" (at_main_freq_id, asset_type_id, frequency, uom, text, maintained_by, maint_type_id,
             int_status, org_id, is_recurring, emp_int_id)
           VALUES ($1,$2,$3,$4,'Monthly','Inhouse',$5,1,$6,true,$7)`,
          [o.freqId, o.at, FREQ_DAYS, UOM_DAYS, MAINT_TYPE, o.org, empIntId],
        );
        say(`Frequency ${o.freqId} created: every ${FREQ_DAYS} days, Inhouse, ${MAINT_TYPE}, technician ${empIntId}`);
      }

      // Certificates, spare category and checklist (Honda copies KIA's)
      if (o.copyFrom) {
        const certs = (await c.query(`SELECT * FROM "tblATMaintCert" WHERE asset_type_id=$1 ORDER BY atmc_id`, [kia.at])).rows;
        for (const m of certs) {
          await c.query(
            `INSERT INTO "tblATMaintCert" (atmc_id, asset_type_id, tc_id, maint_type_id, created_by, created_on, is_mandatory,
               requires_expiry, expiry_alert_days, org_id)
             VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9)`,
            [atmcId(), o.at, m.tc_id, m.maint_type_id, ADMIN_USER, m.is_mandatory, m.requires_expiry, m.expiry_alert_days, o.org],
          );
        }
        say(`Certificates ${certs.map((m) => m.tc_id).join(', ')} mapped to ${o.at}`);

        const spcMap = new Map();
        const srcMaps = (await c.query(
          `SELECT m.spcatm_id, cat.* FROM "tblSPCatATMap" m JOIN "tblSPCategory" cat USING (spc_id) WHERE m.asset_type_id=$1`,
          [kia.at],
        )).rows;
        for (const s of srcMaps) {
          let newSpb = null;
          let newSpm = null;
          if (s.spb_id) {
            const b = (await c.query(`SELECT * FROM "tblSPBrand" WHERE spb_id=$1`, [s.spb_id])).rows[0];
            newSpb = spbId();
            await c.query(
              `INSERT INTO "tblSPBrand" (spb_id, text, int_status, org_id, created_by, created_on, changed_by, changed_on)
               VALUES ($1,$2,1,$3,$4,NOW(),$4,NOW())`,
              [newSpb, b.text, o.org, ADMIN_USER],
            );
            const mdl = s.spm_id ? (await c.query(`SELECT * FROM "tblSPBMod" WHERE spbm_id=$1`, [s.spm_id])).rows[0] : null;
            if (mdl) {
              newSpm = spmId();
              await c.query(
                `INSERT INTO "tblSPBMod" (spbm_id, spb_id, text, int_status, org_id, created_by, created_on, changed_by, changed_on)
                 VALUES ($1,$2,$3,1,$4,$5,NOW(),$5,NOW())`,
                [newSpm, newSpb, mdl.text, o.org, ADMIN_USER],
              );
            }
          }
          const newSpc = spcId();
          await c.query(
            `INSERT INTO "tblSPCategory" (spc_id, text, uom, minimum_stock, re_order_level, int_status, org_id, created_by,
               created_on, changed_by, changed_on, last_gen_seq_no, spb_id, spm_id, expiry)
             VALUES ($1,$2,$3,$4,$5,1,$6,$7,NOW(),$7,NOW(),0,$8,$9,$10)`,
            [newSpc, s.text, s.uom, s.minimum_stock, s.re_order_level, o.org, ADMIN_USER, newSpb, newSpm, s.expiry],
          );
          const newMap = spcatmId();
          await c.query(
            `INSERT INTO "tblSPCatATMap" (spcatm_id, spc_id, asset_type_id, int_status, org_id, created_by, created_on, changed_by, changed_on)
             VALUES ($1,$2,$3,1,$4,$5,NOW(),$5,NOW())`,
            [newMap, newSpc, o.at, o.org, ADMIN_USER],
          );
          spcMap.set(s.spcatm_id, newMap);
          say(`Spare category ${newSpc} "${s.text}" (brand ${newSpb || '-'}, model ${newSpm || '-'}) mapped to ${o.at} via ${newMap}`);
        }

        const items = (await c.query(`SELECT * FROM "tblATMaintCheckList" WHERE asset_type_id=$1 ORDER BY at_main_checklist_id`, [kia.at])).rows;
        for (const it of items) {
          await c.query(
            `INSERT INTO "tblATMaintCheckList" (at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id, required_spare_part, spcatm_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [atmclId(), o.org, o.at, it.text, o.freqId, it.required_spare_part, it.spcatm_id ? spcMap.get(it.spcatm_id) || null : null],
          );
        }
        say(`Maintenance checklist copied: ${items.map((i) => i.text + (i.required_spare_part ? ' [spare]' : '')).join(', ')}`);
      }

      // Maintenance workflow: 10 System Admin → 20 Fire Safety Officer
      const s1 = wfsId();
      const s2 = wfsId();
      await c.query(
        `INSERT INTO "tblWFSteps" (wf_steps_id, org_id, text) VALUES ($1,$3,'System Administrator Approval'), ($2,$3,'Fire Safety Officer Approval')`,
        [s1, s2, o.org],
      );
      await c.query(
        `INSERT INTO "tblWFJobRole" (wf_job_role_id, wf_steps_id, job_role_id, org_id) VALUES ($1,$3,$5,$7), ($2,$4,$6,$7)`,
        [wfjrId(), wfjrId(), s1, s2, ADMIN_ROLE, roleId, o.org],
      );
      await c.query(
        `INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id) VALUES ($1,$3,$4,'10',$6), ($2,$3,$5,'20',$6)`,
        [wfasId(), wfasId(), o.at, s1, s2, o.org],
      );
      say(`Maintenance workflow: 10 ${s1} → ${ADMIN_ROLE}, 20 ${s2} → ${roleId}`);

      // Inspection checklist + monthly in-house frequency
      for (const it of INSP_ITEMS) {
        const ic = icId();
        const aatic = aaticId();
        await c.query(
          `INSERT INTO "tblInspCheckList" (insp_check_id, inspection_text, response_type, expected_value, min_range, max_range,
             trigger_maintenance, org_id, created_by, created_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          [ic, it.text, it.type, it.expected || null, it.min ?? null, it.max ?? null, it.trigger, o.org, ADMIN_USER],
        );
        await c.query(
          `INSERT INTO "tblAATInspCheckList" (aatic_id, at_id, insp_check_id, expected_value, min_range, max_range,
             trigger_maintenance, org_id, created_by, created_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
          [aatic, o.at, ic, it.expected || null, it.min ?? null, it.max ?? null, it.trigger, o.org, ADMIN_USER],
        );
        await c.query(
          `INSERT INTO "tblAAT_Insp_Freq" (aatif_id, aatic_id, freq, uom, text, maintained_by, int_status, org_id, is_recurring,
             created_by, created_on, emp_int_id)
           VALUES ($1,$2,$3,$4,'Monthly','inhouse',1,$5,true,$6,NOW(),$7)`,
          [aatifId(), aatic, FREQ_DAYS, UOM_DAYS, o.org, ADMIN_USER, empIntId],
        );
      }
      say(`Inspection checklist: ${INSP_ITEMS.length} items, every ${FREQ_DAYS} days, in-house by ${empIntId}`);

      // Inspection workflow: 1 System Admin → 2 Fire Safety Officer
      const i1 = wfisId();
      const i2 = wfisId();
      await c.query(
        `INSERT INTO "tblWFInspSteps" (wf_insp_steps_id, org_id, text) VALUES ($1,$3,'System Administrator Approval'), ($2,$3,'Fire Safety Officer Approval')`,
        [i1, i2, o.org],
      );
      await c.query(
        `INSERT INTO "tblWFInspJobRole" (wf_insp_job_role_id, wf_insp_steps_id, job_role_id, dept_id, org_id)
         VALUES ($1,$3,$5,$7,$8), ($2,$4,$6,$7,$8)`,
        [wfijrId(), wfijrId(), i1, i2, ADMIN_ROLE, roleId, o.dept, o.org],
      );
      await c.query(
        `INSERT INTO "tblWFATInspSeqs" (wfatis_id, at_id, wf_steps_id, seqs_no, org_id) VALUES ($1,$3,$4,'1',$6), ($2,$3,$5,'2',$6)`,
        [wfatisId(), wfatisId(), o.at, i1, i2, o.org],
      );
      say(`Inspection workflow: 1 ${i1} → ${ADMIN_ROLE}, 2 ${i2} → ${roleId}`);
    }

    for (const [key, n] of usedSeq) {
      await c.query(`UPDATE "tblIDSequences" SET last_number = GREATEST(last_number, $2) WHERE table_key = $1`, [key, n]);
    }
    say(`\nID sequences advanced: ${[...usedSeq].map(([k, n]) => `${k}=${n}`).join(', ')}`);

    if (!APPLY) {
      await c.query('ROLLBACK');
      say('DRY RUN — rolled back (run with --apply to commit)');
      return;
    }
    await c.query('COMMIT');
    say('COMMITTED to presanna_db');

    const reg = new Client({ connectionString: dbUrl('postgres'), ssl: false });
    await reg.connect();
    try {
      await reg.query(
        `INSERT INTO tenant_user_emails (email_normalized, email_display, org_id, subdomain, user_id, employee_id, source, created_at, updated_at)
         VALUES (LOWER($1),$1,$2,$3,$4,$5,'create_user_for_employee',NOW(),NOW()) ON CONFLICT (email_normalized) DO NOTHING`,
        [OFFICER.email, HOME_ORG, SUBDOMAIN, userId, employeeId],
      );
      say(`Registered ${OFFICER.email} → ${HOME_ORG}/${SUBDOMAIN}`);
    } finally {
      await reg.end();
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
