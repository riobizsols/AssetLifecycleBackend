/**
 * Workforce report — engineer/technician assignments, closures, backlog,
 * SLA performance, workload, and productivity from tblAssetMaintSch.
 */
const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

function resolvePeriodBounds(period, dateFrom, dateTo) {
  const now = new Date();
  const y = now.getFullYear();
  if (period === 'last_year') {
    return {
      from: `${y - 1}-01-01`,
      to: `${y - 1}-12-31`,
      label: `Last year (${y - 1})`,
    };
  }
  if (period === 'specific' && dateFrom && dateTo) {
    return { from: dateFrom, to: dateTo, label: `${dateFrom} → ${dateTo}` };
  }
  return {
    from: `${y}-01-01`,
    to: `${y}-12-31`,
    label: `Current year (${y})`,
  };
}

function techKey(row) {
  const empName = String(row.employee_full_name || '').trim();
  if (empName) return empName;
  const name = String(row.technician_name || '').trim();
  if (name) return name;
  if (row.emp_int_id) return String(row.emp_int_id);
  return 'Unassigned';
}

function isInhouseRow(row) {
  const maint = String(row.maintained_by || '')
    .toLowerCase()
    .replace(/\s|-/g, '');
  if (maint.includes('vendor')) return false;
  // Require a real employee id for workforce reporting
  return Boolean(row.emp_int_id);
}

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

function dayOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function mapRow(r, isOverdue = false) {
  return {
    ams_id: r.ams_id,
    wo_id: r.wo_id,
    asset_id: r.asset_id,
    serial_number: r.serial_number,
    asset_type_name: r.asset_type_name,
    maintenance_type_name: r.maintenance_type_name,
    technician_name: techKey(r),
    emp_int_id: r.emp_int_id || null,
    technician_email: r.technician_email || r.employee_email || null,
    technician_phno: r.technician_phno || r.employee_phone || null,
    status: r.status,
    act_maint_st_date: r.act_maint_st_date,
    act_main_end_date: r.act_main_end_date,
    branch_name: r.branch_name,
    department_name: r.department_name,
    notes: r.notes,
    is_overdue: Boolean(isOverdue),
    is_inhouse: true,
  };
}

async function getWorkforceReport(opts = {}) {
  const db = getDb();
  const {
    orgId,
    period = 'current_year',
    dateFrom = null,
    dateTo = null,
    branchId = null,
    hasSuperAccess = false,
  } = opts;

  if (!orgId) {
    const err = new Error('Organization is required');
    err.status = 400;
    throw err;
  }

  const bounds = resolvePeriodBounds(period, dateFrom, dateTo);
  const params = [orgId, bounds.from, bounds.to];
  let branchSql = '';
  if (branchId && !hasSuperAccess) {
    params.push(branchId);
    branchSql = ` AND a.branch_id = $${params.length}`;
  }

  const { rows } = await db.query(
    `
      SELECT
        ams.ams_id,
        ams.wo_id,
        ams.asset_id,
        ams.maint_type_id,
        ams.status,
        ams.technician_name,
        COALESCE(ams.technician_email, e.email_id) AS technician_email,
        COALESCE(ams.technician_phno, e.phone_number) AS technician_phno,
        ams.maintained_by,
        COALESCE(ams.emp_int_id, wfh.emp_int_id) AS emp_int_id,
        ams.act_maint_st_date,
        ams.act_main_end_date,
        ams.notes,
        a.serial_number,
        a.branch_id,
        a.dept_id,
        at.text AS asset_type_name,
        mt.text AS maintenance_type_name,
        b.text AS branch_name,
        d.text AS department_name,
        COALESCE(
          NULLIF(BTRIM(e.full_name), ''),
          NULLIF(BTRIM(e.name), ''),
          NULLIF(BTRIM(ams.technician_name), '')
        ) AS employee_full_name,
        e.email_id AS employee_email,
        e.phone_number AS employee_phone
      FROM "tblAssetMaintSch" ams
      INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id AND a.org_id = ams.org_id
      LEFT JOIN "tblWFAssetMaintSch_H" wfh
        ON wfh.wfamsh_id = ams.wfamsh_id AND wfh.org_id = ams.org_id
      LEFT JOIN "tblEmployees" e
        ON e.emp_int_id = COALESCE(ams.emp_int_id, wfh.emp_int_id)
       AND e.org_id = ams.org_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      WHERE ams.org_id = $1
        AND COALESCE(ams.emp_int_id, wfh.emp_int_id) IS NOT NULL
        AND BTRIM(COALESCE(ams.emp_int_id, wfh.emp_int_id)::text) <> ''
        AND (
          ams.maintained_by IS NULL
          OR LOWER(REPLACE(REPLACE(COALESCE(ams.maintained_by, ''), ' ', ''), '-', ''))
             NOT LIKE '%vendor%'
        )
        AND (
          (
            ams.act_maint_st_date IS NOT NULL
            AND (ams.act_maint_st_date)::timestamp::date BETWEEN $2::date AND $3::date
          )
          OR UPPER(COALESCE(ams.status, '')) NOT IN ('CO', 'CA')
        )
        ${branchSql}
      ORDER BY ams.act_maint_st_date DESC NULLS LAST, ams.ams_id
    `,
    params,
  );

  const today = dayOnly(new Date());
  const periodStart = new Date(`${bounds.from}T00:00:00`);
  const periodEnd = new Date(`${bounds.to}T23:59:59`);

  const byTech = new Map();
  const ensure = (row) => {
    const empId = row.emp_int_id || null;
    const name = techKey(row);
    const key = empId ? `emp:${empId}` : `name:${name}`;
    if (!byTech.has(key)) {
      byTech.set(key, {
        technician_name: name,
        empIdCounts: new Map(),
        emails: new Map(),
        phones: new Map(),
        assignments: 0,
        open_assignments: 0,
        closures: 0,
        backlog: 0,
        overdue_backlog: 0,
        sla_due: 0,
        sla_on_time: 0,
        sla_late: 0,
        turnaround_days_sum: 0,
        turnaround_count: 0,
      });
    }
    return byTech.get(key);
  };

  const trackIdentity = (bucket, row) => {
    if (row.emp_int_id) {
      bucket.empIdCounts.set(
        row.emp_int_id,
        (bucket.empIdCounts.get(row.emp_int_id) || 0) + 1,
      );
    }
    if (row.technician_email) {
      bucket.emails.set(
        row.technician_email,
        (bucket.emails.get(row.technician_email) || 0) + 1,
      );
    }
    if (row.technician_phno) {
      bucket.phones.set(
        row.technician_phno,
        (bucket.phones.get(row.technician_phno) || 0) + 1,
      );
    }
  };

  const pickTop = (countMap) => {
    let best = null;
    let bestCount = -1;
    for (const [value, count] of countMap.entries()) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  };

  const assignments = [];
  const closures = [];
  const backlog = [];

  let totalAssignments = 0;
  let totalClosures = 0;
  let totalBacklog = 0;
  let totalOverdue = 0;
  let totalSlaDue = 0;
  let totalSlaOnTime = 0;
  let totalSlaLate = 0;

  for (const row of rows) {
    if (!isInhouseRow(row)) continue;
    const name = techKey(row);
    const bucket = ensure(row);
    if (name && (!bucket.technician_name || bucket.technician_name === row.emp_int_id)) {
      bucket.technician_name = name;
    }
    trackIdentity(bucket, row);
    const status = String(row.status || '').toUpperCase();
    const startDate = row.act_maint_st_date ? new Date(row.act_maint_st_date) : null;
    const startOk = startDate && !Number.isNaN(startDate.getTime());
    const startDay = dayOnly(row.act_maint_st_date);
    const endDay = dayOnly(row.act_main_end_date);

    const inPeriod = startOk && startDate >= periodStart && startDate <= periodEnd;
    const isOpen = status !== 'CO' && status !== 'CA';
    const isClosed = status === 'CO';
    const overdue = Boolean(isOpen && startDay && startDay < today);

    if (inPeriod || isOpen) {
      bucket.assignments += 1;
      totalAssignments += 1;
      assignments.push(mapRow(row, overdue));
      if (isOpen) bucket.open_assignments += 1;
    }

    if (isClosed && inPeriod) {
      bucket.closures += 1;
      totalClosures += 1;
      closures.push(mapRow(row));

      if (startDay && endDay) {
        bucket.sla_due += 1;
        totalSlaDue += 1;
        if (endDay <= startDay) {
          bucket.sla_on_time += 1;
          totalSlaOnTime += 1;
        } else {
          bucket.sla_late += 1;
          totalSlaLate += 1;
        }
        const days = Math.max(
          0,
          Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)),
        );
        bucket.turnaround_days_sum += days;
        bucket.turnaround_count += 1;
      }
    }

    if (isOpen) {
      bucket.backlog += 1;
      totalBacklog += 1;
      backlog.push(mapRow(row, overdue));
      if (overdue) {
        bucket.overdue_backlog += 1;
        totalOverdue += 1;
      }
    }
  }

  const technicians = [...byTech.values()]
    .map((t) => ({
      technician_name: t.technician_name,
      emp_int_id: pickTop(t.empIdCounts),
      technician_email: pickTop(t.emails),
      technician_phno: pickTop(t.phones),
      assignments: t.assignments,
      open_assignments: t.open_assignments,
      closures: t.closures,
      backlog: t.backlog,
      overdue_backlog: t.overdue_backlog,
      sla_due: t.sla_due,
      sla_on_time: t.sla_on_time,
      sla_late: t.sla_late,
      sla_compliance_pct: pct(t.sla_on_time, t.sla_due),
      avg_turnaround_days:
        t.turnaround_count > 0
          ? Math.round((t.turnaround_days_sum / t.turnaround_count) * 10) / 10
          : null,
      productivity_closures: t.closures,
      workload_open: t.open_assignments,
    }))
    .sort(
      (a, b) =>
        b.assignments - a.assignments ||
        a.technician_name.localeCompare(b.technician_name),
    );

  return {
    period: {
      type: period,
      from: bounds.from,
      to: bounds.to,
      label: bounds.label,
    },
    summary: {
      technicians: technicians.length,
      assignments: totalAssignments,
      closures: totalClosures,
      backlog: totalBacklog,
      overdue_backlog: totalOverdue,
      sla_due: totalSlaDue,
      sla_on_time: totalSlaOnTime,
      sla_late: totalSlaLate,
      sla_compliance_pct: pct(totalSlaOnTime, totalSlaDue),
    },
    technicians,
    sections: {
      assignments,
      closures,
      backlog,
      sla_performance: technicians,
      workload: technicians,
      productivity: technicians,
    },
  };
}

function mapEmployeeRow(row) {
  if (!row) return null;
  return {
    emp_int_id: row.emp_int_id || null,
    employee_id: row.employee_id || null,
    full_name: row.full_name || row.name || row.employee_id || row.emp_int_id || null,
    email_id: row.email_id || null,
    phone_number: row.phone_number || null,
  };
}

async function resolveEmployee(orgId, { empIntId, name, email }) {
  const db = getDb();
  if (empIntId) {
    const { rows } = await db.query(
      `SELECT * FROM "tblEmployees" WHERE org_id = $1 AND emp_int_id = $2 LIMIT 1`,
      [orgId, empIntId],
    );
    if (rows[0]) return mapEmployeeRow(rows[0]);
  }

  if (email) {
    const { rows } = await db.query(
      `
        SELECT * FROM "tblEmployees"
        WHERE org_id = $1 AND LOWER(COALESCE(email_id, '')) = LOWER($2)
        LIMIT 1
      `,
      [orgId, email],
    );
    if (rows[0]) return mapEmployeeRow(rows[0]);
  }

  if (name && name !== 'Unassigned') {
    const { rows } = await db.query(
      `
        SELECT * FROM "tblEmployees"
        WHERE org_id = $1
          AND (
            LOWER(COALESCE(full_name, '')) = LOWER($2)
            OR LOWER(COALESCE(name, '')) = LOWER($2)
          )
        LIMIT 1
      `,
      [orgId, name],
    ).catch(async () => {
      // Some tenants only have `name`
      return db.query(
        `
          SELECT * FROM "tblEmployees"
          WHERE org_id = $1 AND LOWER(COALESCE(name, '')) = LOWER($2)
          LIMIT 1
        `,
        [orgId, name],
      );
    });
    if (rows[0]) return mapEmployeeRow(rows[0]);
  }

  return null;
}

async function getTechnicianDetail(opts = {}) {
  const db = getDb();
  const {
    orgId,
    empIntId = null,
    name = null,
    email = null,
    phone = null,
  } = opts;

  if (!orgId) {
    const err = new Error('Organization is required');
    err.status = 400;
    throw err;
  }

  const employee = await resolveEmployee(orgId, { empIntId, name, email });
  const resolvedEmpId = employee?.emp_int_id || empIntId || null;
  const displayName =
    employee?.full_name || name || 'Unassigned';

  let certificates = [];
  if (resolvedEmpId) {
    try {
      const EmployeeTechCertModel = require('./employeeTechCertModel');
      certificates = await EmployeeTechCertModel.getEmployeeCertificates(
        resolvedEmpId,
        orgId,
      );
    } catch (err) {
      console.error('[WorkforceReport] certificates:', err.message);
      certificates = [];
    }
  }

  const recentParams = [orgId];
  let recentFilter = '';
  if (resolvedEmpId) {
    recentParams.push(resolvedEmpId);
    recentFilter = ` AND ams.emp_int_id = $${recentParams.length}`;
  } else if (name && name !== 'Unassigned') {
    recentParams.push(name);
    recentFilter = ` AND LOWER(COALESCE(ams.technician_name, '')) = LOWER($${recentParams.length})`;
  } else {
    recentFilter = ` AND 1=0`;
  }

  const { rows: recentRows } = await db.query(
    `
      SELECT
        ams.ams_id,
        ams.wo_id,
        ams.asset_id,
        ams.status,
        ams.act_maint_st_date,
        ams.act_main_end_date,
        ams.technician_name,
        ams.emp_int_id,
        a.serial_number,
        at.text AS asset_type_name,
        mt.text AS maintenance_type_name,
        b.text AS branch_name
      FROM "tblAssetMaintSch" ams
      INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id AND a.org_id = ams.org_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      WHERE ams.org_id = $1
        ${recentFilter}
      ORDER BY ams.act_maint_st_date DESC NULLS LAST
      LIMIT 20
    `,
    recentParams,
  );

  return {
    identity: {
      emp_int_id: resolvedEmpId,
      employee_id: employee?.employee_id || null,
      full_name: displayName,
      email_id: employee?.email_id || email || null,
      phone_number: employee?.phone_number || phone || null,
    },
    certificates: (certificates || []).map((c) => ({
      etc_id: c.etc_id || c.id,
      tc_id: c.tc_id,
      cert_name: c.cert_name || c.certificate_name || 'Certificate',
      cert_number: c.cert_number || null,
      certificate_date: c.certificate_date || null,
      certificate_expiry: c.certificate_expiry || null,
      status: c.status || null,
      file_path: c.file_path || null,
    })),
    recent_work_orders: recentRows.map((r) => mapRow(r)),
  };
}

module.exports = {
  getWorkforceReport,
  getTechnicianDetail,
  resolvePeriodBounds,
};
