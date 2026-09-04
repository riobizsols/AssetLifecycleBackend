const DepartmentModel = require('../models/departmentModel');
const operationalCache = require('../utils/operationalCache');
const { generateCustomId } = require("../utils/idGenerator");

const createDepartment = async (req, res) => {
    try {
        const { text, branch_id: bodyBranchId } = req.body;
        const { isResourceInAcmScope, getRequestAcm } = require('../utils/acmAccess');
        const acm = getRequestAcm(req);

        if (!acm?.canWrite) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Write access is not granted in Access Control Management (tblACM)',
            });
        }

        if (!text?.trim()) {
            return res.status(400).json({ error: "Department name is required" });
        }
        if (!bodyBranchId) {
            return res.status(400).json({ error: "Branch is required" });
        }

        const branchModel = require("../models/branchModel");
        const branch = await branchModel.getBranchById(bodyBranchId);
        if (!branch) {
            return res.status(400).json({ error: "Invalid branch selected" });
        }

        if (!isResourceInAcmScope(acm, { org_id: branch.org_id, branch_id: branch.branch_id })) {
            return res.status(403).json({
                error: "Access denied",
                message: "Selected branch is outside your ACM data scope"
            });
        }

        const org_id = branch.org_id || req.user.org_id;
        const branch_id = branch.branch_id;
        const created_by = req.user.user_id;

        const duplicateName = await DepartmentModel.findDepartmentByName(org_id, text);
        if (duplicateName) {
            return res.status(400).json({
                error: "Duplicate department name",
                message: "A department with this name already exists"
            });
        }

        const int_status = 1;
        const parent_id = null;
        const changed_by = null;

        // Generate next dept_id from numeric max for this org (then bump sequence)
        const dbPool = req.db || require("../config/db");

        const maxResult = await dbPool.query(
            `SELECT COALESCE(MAX(
                CAST(SUBSTRING(dept_id FROM 4) AS INTEGER)
             ), 0) AS max_num
             FROM "tblDepartments"
             WHERE org_id = $1
               AND dept_id ~ '^DPT[0-9]+$'`,
            [org_id]
        );
        const maxNum = Number(maxResult.rows[0]?.max_num || 0);
        const newDeptId = `DPT${String(maxNum + 1).padStart(3, "0")}`;

        await dbPool.query(
            `INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
             VALUES ('department', 'DPT', $1)
             ON CONFLICT (table_key) DO UPDATE
             SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)`,
            [maxNum + 1]
        );

        // 🔹 Create department (branch lives in tblBR_DEPT, not tblDepartments)
        const newDept = await DepartmentModel.createDepartment({
            org_id,
            dept_id: newDeptId,
            int_status,
            text,
            parent_id,
            created_by,
            changed_by
        });

        const mapping = await DepartmentModel.mapDepartmentToBranch({
            branch_id,
            dept_id: newDeptId,
            org_id,
            created_by,
        });

        res.status(201).json({ ...newDept, branch_id: mapping.branch_id });
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
    } catch (err) {
        console.error("Error creating department:", err);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

const getNextDepartmentId = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const dbPool = req.db || require("../config/db");

        // Numeric max — lexicographic ORDER BY dept_id can mis-order once IDs exceed DPT999
        const result = await dbPool.query(
            `SELECT COALESCE(MAX(
                CAST(SUBSTRING(dept_id FROM 4) AS INTEGER)
             ), 0) AS max_num
             FROM "tblDepartments"
             WHERE org_id = $1
               AND dept_id ~ '^DPT[0-9]+$'`,
            [org_id]
        );

        const nextNum = Number(result.rows[0]?.max_num || 0) + 1;
        const nextDeptId = `DPT${String(nextNum).padStart(3, "0")}`;

        // Keep sequence table aligned so generateCustomId stays in sync
        await dbPool.query(
            `INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
             VALUES ('department', 'DPT', $1)
             ON CONFLICT (table_key) DO UPDATE
             SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)`,
            [result.rows[0]?.max_num || 0]
        );

        console.log('Next department ID:', nextDeptId);
        res.status(200).json({ nextDeptId });
    } catch (err) {
        console.error('Error getting next dept_id:', err);
        res.status(500).json({ error: 'Failed to fetch next department ID' });
    }
};



const deleteDepartment = async (req, res) => {
    try {
        const { departments } = req.body; // array of { org_id, dept_id }

        if (!departments || departments.length === 0) {
            return res.status(400).json({ error: "No departments provided" });
        }

        for (const dept of departments) {
            await DepartmentModel.deleteDepartment(dept.org_id, dept.dept_id);
        }

        res.status(200).json({ message: "Departments deleted successfully" });
        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});
    } catch (err) {
        console.error("Error deleting departments:", err);
        
        // Handle foreign key constraint errors
        if (err.message && err.message.includes('Cannot delete department')) {
            return res.status(400).json({ 
                error: "Cannot delete department",
                message: err.message,
                hint: "You must first reassign or delete all employees associated with this department before it can be deleted"
            });
        }
        
        // Handle PostgreSQL foreign key constraint errors
        if (err.code === '23503') {
            return res.status(400).json({ 
                error: "Cannot delete department",
                message: "This department is being used by existing employees",
                hint: "You must first reassign or delete all employees associated with this department before it can be deleted"
            });
        }
        
        res.status(500).json({ error: "Failed to delete departments" });
    }
  };

const updateDepartment = async (req, res) => {
    try {
        const { dept_id } = req.body;
        const text = String(req.body?.text || '').trim();

        const org_id = req.user.org_id;
        const changed_by = req.user.user_id;

        if (!dept_id || !text) {
            return res.status(400).json({ error: "Missing dept_id or text" });
        }

        // Unique department name within org (case-insensitive), excluding current dept
        const duplicateName = await DepartmentModel.findDepartmentByName(
            org_id,
            text,
            dept_id
        );
        if (duplicateName) {
            return res.status(400).json({
                error: "Duplicate department name",
                message: "A department with this name already exists"
            });
        }

        const updatedDept = await DepartmentModel.updateDepartment({
            dept_id,
            org_id,
            text,
            changed_by
        });

        if (!updatedDept) {
            return res.status(404).json({ error: "Department not found or not updated" });
        }

        res.status(200).json({ message: "Department updated successfully", department: updatedDept });
        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});
    } catch (err) {
        console.error("Error updating department:", err);
        res.status(500).json({ error: "Failed to update department" });
    }
};



module.exports = {
    createDepartment,
    getAllDepartments: async (req, res) => {
        const { getRequestAcm, getEffectiveListContext } = require('../utils/acmAccess');
        const acm = getRequestAcm(req);
        const { orgId, branchId, hasSuperAccess } = getEffectiveListContext(req);
        const cacheKey = acm?.hasAcm
            ? `list-acm-v2-${acm.allOrgs ? '*' : (acm.orgIds || []).join(',')}-${acm.allBranches ? '*' : (acm.branchIds || []).join(',')}-${(acm.selection && acm.selection.orgId) || ''}-${(acm.selection && acm.selection.branchId) || ''}-${(acm.selection && acm.selection.deptId) || ''}`
            : 'list-legacy';

        const { data: departments } = await operationalCache.cachedList(
            req,
            'departments',
            cacheKey,
            () => DepartmentModel.getAllDepartments(
                orgId || req.user.org_id,
                branchId || req.user.branch_id,
                hasSuperAccess,
                acm
            ),
        );
        res.status(200).json(departments);
    },
    deleteDepartment,
    updateDepartment,
    getNextDepartmentId
};
