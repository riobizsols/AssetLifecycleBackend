const branchModel = require('../models/branchModel');
const operationalCache = require('../utils/operationalCache');
const { generateCustomId } = require("../utils/idGenerator");

const getBranches = async (req, res) => {
    try {
        const { getRequestAcm } = require('../utils/acmAccess');
        const acm = getRequestAcm(req);
        const cacheSuffix = acm?.hasAcm
            ? `acm-${acm.allOrgs ? 'allOrgs' : (acm.orgIds || []).join(',')}-${acm.allBranches ? 'allBr' : (acm.branchIds || []).join(',')}-${(acm.selection && acm.selection.orgId) || ''}-${(acm.selection && acm.selection.branchId) || ''}`
            : `legacy-${req.user?.branch_id || 'none'}`;

        const { data: branches } = await operationalCache.cachedList(
            req,
            'branches',
            `list-acm-v2-${cacheSuffix}`,
            () => branchModel.getAllBranches(null, acm),
        );
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const createBranch = async (req, res) => {
    try {
        const { isResourceInAcmScope, getRequestAcm } = require('../utils/acmAccess');
        const acm = getRequestAcm(req);
        if (!acm?.canWrite) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Write access is not granted in Access Control Management (tblACM)',
            });
        }

        const { user_id, org_id: tokenOrgId } = req.user;
        const text = String(req.body?.text || '').trim();
        const city = String(req.body?.city || '').trim();
        const branch_code = String(req.body?.branch_code || '').trim();
        const org_id = String(req.body?.org_id || tokenOrgId || '').trim();

        if (!org_id || !text || !city || !branch_code) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "Organization, branch name, city and branch code are required"
            });
        }

        if (!isResourceInAcmScope(acm, { org_id })) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Selected organization is outside your ACM data scope',
            });
        }

        const orgExists = await branchModel.orgExists(org_id);
        if (!orgExists) {
            return res.status(400).json({
                error: "Invalid organization",
                message: "Selected organization does not exist"
            });
        }

        const newId = await generateCustomId("branch", 3);

        const newBranch = await branchModel.addBranch({
            branch_id: newId,
            org_id,
            text,
            city,
            branch_code,
            created_by: user_id,
        });

        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
        if (tokenOrgId && tokenOrgId !== org_id) {
            operationalCache.invalidateOrgCaches(tokenOrgId).catch(() => {});
        }
        res.status(201).json(newBranch);
    } catch (error) {
        console.error("Error creating branch:", error);
        res.status(500).json({ error: "Internal server error", message: error.message });
    }
};

const deleteBranches = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Invalid or empty 'ids' array" });
        }

        const deletedCount = await branchModel.deleteBranches(ids);
        operationalCache.invalidateOrgCaches(req.user?.org_id).catch(() => {});
        res.json({ message: `${deletedCount} branch(es) deleted` });
    } catch (error) {
        console.error("Error deleting branches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateBranch = async (req, res) => {
    try {
        const { branch_id } = req.params;
        const text = String(req.body?.text || '').trim();
        const city = String(req.body?.city || '').trim();
        const branch_code = String(req.body?.branch_code || '').trim();
        const { user_id, org_id } = req.user;

        // Validate required fields
        if (!text || !city || !branch_code) {
            return res.status(400).json({ 
                error: "Missing required fields",
                message: "Branch name, city and branch code are required" 
            });
        }

        // Check if branch exists (any org)
        const branchExists = await branchModel.getBranchById(branch_id);
        
        if (!branchExists) {
            return res.status(404).json({ 
                error: "Branch not found",
                message: "The specified branch does not exist" 
            });
        }

        // Check if branch code is unique within the same org (excluding current branch)
        const branches = await branchModel.getAllBranches(branchExists.org_id);
        const duplicateBranchCode = branches.find(b => 
            b.branch_code === branch_code && b.branch_id !== branch_id
        );

        if (duplicateBranchCode) {
            return res.status(400).json({ 
                error: "Duplicate branch code",
                message: "This branch code is already in use" 
            });
        }

        const updatedBranch = await branchModel.updateBranch(
            branch_id,
            { text, city, branch_code },
            user_id
        );

        operationalCache.invalidateOrgCaches(branchExists.org_id || org_id).catch(() => {});
        res.json({
            message: "Branch updated successfully",
            data: updatedBranch
        });
    } catch (error) {
        console.error("Error updating branch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getBranches,
    createBranch,
    deleteBranches,
    updateBranch,
};
