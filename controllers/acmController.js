const { getAcmRowsByUserId } = require('../models/acmModel');
const { buildAcmScope, getRequestAcm, isWild } = require('../utils/acmAccess');
const { getDbFromContext } = require('../utils/dbContext');

/**
 * GET /api/acm/me
 * Returns permission ACM + active filter (from header selection).
 */
const getMyAcmScope = async (req, res) => {
  try {
    const { resolveDefaultAcmSelection } = require('../utils/acmAccess');
    const db = req.db || getDbFromContext();
    const rows = req.user.acm?.rows?.length
      ? req.user.acm.rows
      : await getAcmRowsByUserId(req.user.user_id, db);

    const defaultSelection = await resolveDefaultAcmSelection(rows, db);

    return res.json({
      user_id: req.user.user_id,
      acm: req.user.acm,
      acmFilter: getRequestAcm(req),
      selection: req.user.acmSelection || null,
      defaultSelection,
      context: {
        orgId: req.user.org_id || null,
        branchId: req.user.branch_id || null,
        deptId: req.user.dept_id || null,
        branchCode: req.user.branch_code || null,
        hasSuperAccess: Boolean(req.user.hasSuperAccess),
      },
    });
  } catch (err) {
    console.error('Error fetching ACM scope:', err);
    return res.status(500).json({ error: 'Failed to fetch ACM scope' });
  }
};

const getMyAcmRows = async (req, res) => {
  try {
    const rows = await getAcmRowsByUserId(req.user.user_id, req.db);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching ACM rows:', err);
    return res.status(500).json({ error: 'Failed to fetch ACM rows' });
  }
};

/**
 * GET /api/acm/options
 * Cascading picker options derived from tblACM (int_status=1) + master tables.
 * Query: ?org_id=&branch_id= to narrow branch/dept lists for the draft selection.
 */
const getAcmOptions = async (req, res) => {
  try {
    const { resolveDefaultAcmSelection } = require('../utils/acmAccess');
    const db = req.db || getDbFromContext();
    const rows = (req.user.acm?.rows?.length
      ? req.user.acm.rows
      : await getAcmRowsByUserId(req.user.user_id, db)
    ).filter((r) => r.int_status === 1 || r.int_status === undefined);

    const defaultSelection = await resolveDefaultAcmSelection(rows, db);

    const draftOrg = String(req.query.org_id || '').trim() || null;
    const draftBranch = String(req.query.branch_id || '').trim() || null;

    const allOrgs = rows.some((r) => isWild(r.org_id));
    const orgIdSet = new Set();
    rows.forEach((r) => {
      if (!isWild(r.org_id)) orgIdSet.add(String(r.org_id));
    });

    let orgs;
    if (allOrgs) {
      const r = await db.query(
        `SELECT org_id, text, org_code, org_city, int_status
         FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id`
      );
      orgs = r.rows;
    } else if (orgIdSet.size) {
      const r = await db.query(
        `SELECT org_id, text, org_code, org_city, int_status
         FROM "tblOrgs"
         WHERE int_status = 1 AND org_id = ANY($1::text[])
         ORDER BY org_id`,
        [[...orgIdSet]]
      );
      orgs = r.rows;
    } else {
      orgs = [];
    }

    // Branches accessible under ACM (optionally for draft org)
    const relevantRows = draftOrg
      ? rows.filter((r) => isWild(r.org_id) || String(r.org_id) === draftOrg)
      : rows;

    const allBranches = relevantRows.some((r) => isWild(r.branch_id));
    const branchIdSet = new Set();
    relevantRows.forEach((r) => {
      if (!isWild(r.branch_id)) branchIdSet.add(String(r.branch_id));
    });

    let branches;
    if (allBranches) {
      if (draftOrg) {
        const r = await db.query(
          `SELECT b.branch_id, b.org_id, b.text, b.branch_code, b.city, b.int_status
           FROM "tblBranches" b
           WHERE b.int_status = 1 AND b.org_id = $1
           ORDER BY b.text`,
          [draftOrg]
        );
        branches = r.rows;
      } else if (allOrgs) {
        const r = await db.query(
          `SELECT b.branch_id, b.org_id, b.text, b.branch_code, b.city, b.int_status
           FROM "tblBranches" b
           WHERE b.int_status = 1
           ORDER BY b.org_id, b.text`
        );
        branches = r.rows;
      } else {
        const r = await db.query(
          `SELECT b.branch_id, b.org_id, b.text, b.branch_code, b.city, b.int_status
           FROM "tblBranches" b
           WHERE b.int_status = 1 AND b.org_id = ANY($1::text[])
           ORDER BY b.org_id, b.text`,
          [[...orgIdSet]]
        );
        branches = r.rows;
      }
    } else if (branchIdSet.size) {
      const r = await db.query(
        `SELECT b.branch_id, b.org_id, b.text, b.branch_code, b.city, b.int_status
         FROM "tblBranches" b
         WHERE b.int_status = 1 AND b.branch_id = ANY($1::text[])
         ORDER BY b.org_id, b.text`,
        [[...branchIdSet]]
      );
      branches = draftOrg ? r.rows.filter((b) => b.org_id === draftOrg) : r.rows;
    } else {
      branches = [];
    }

    // Departments via tblBR_DEPT for draft branch (or all accessible)
    const deptRows = draftBranch
      ? relevantRows.filter((r) => isWild(r.branch_id) || String(r.branch_id) === draftBranch)
      : relevantRows;
    const allDepts = deptRows.some((r) => isWild(r.dept_id));
    const deptIdSet = new Set();
    deptRows.forEach((r) => {
      if (!isWild(r.dept_id)) deptIdSet.add(String(r.dept_id));
    });

    let departments = [];
    if (draftBranch) {
      if (allDepts) {
        const r = await db.query(
          `SELECT DISTINCT d.dept_id, d.text, d.org_id, bd.branch_id
           FROM "tblDepartments" d
           INNER JOIN "tblBR_DEPT" bd ON bd.dept_id = d.dept_id AND bd.int_status = 1
           WHERE d.int_status = 1 AND bd.branch_id = $1
           ORDER BY d.text`,
          [draftBranch]
        );
        departments = r.rows;
      } else if (deptIdSet.size) {
        const r = await db.query(
          `SELECT DISTINCT d.dept_id, d.text, d.org_id, bd.branch_id
           FROM "tblDepartments" d
           INNER JOIN "tblBR_DEPT" bd ON bd.dept_id = d.dept_id AND bd.int_status = 1
           WHERE d.int_status = 1 AND bd.branch_id = $1 AND d.dept_id = ANY($2::text[])
           ORDER BY d.text`,
          [draftBranch, [...deptIdSet]]
        );
        departments = r.rows;
      }
    }

    const scope = buildAcmScope(rows, {
      org_id: req.user.org_id,
      branch_id: req.user.branch_id,
      dept_id: req.user.dept_id,
    });

    return res.json({
      orgs,
      branches,
      departments,
      rows,
      acm: scope,
      acmFilter: getRequestAcm(req),
      defaultSelection,
      context: {
        org_id: req.user.org_id,
        branch_id: req.user.branch_id,
        dept_id: req.user.dept_id,
      },
    });
  } catch (err) {
    console.error('Error fetching ACM options:', err);
    return res.status(500).json({ error: 'Failed to fetch ACM options' });
  }
};

module.exports = {
  getMyAcmScope,
  getMyAcmRows,
  getAcmOptions,
};
