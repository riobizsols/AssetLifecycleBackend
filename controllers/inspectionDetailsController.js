const model = require('../models/inspectionDetailsModel');
const operationalCache = require('../utils/operationalCache');

const getAllWorkflowSteps = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const { data: rows } = await operationalCache.cachedList(
            req,
            'inspection-details',
            'workflow-steps',
            () => model.getAllWorkflowSteps(org_id).then((result) => result.rows),
        );
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching inspection workflow steps:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inspection workflow steps',
            details: error.message
        });
    }
};

const createWorkflowStep = async (req, res) => {
    try {
        const { text } = req.body;
        const org_id = req.user.org_id;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Step name is required'
            });
        }

        const result = await model.createWorkflowStep(org_id, text.trim());
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
        res.status(201).json({
            success: true,
            message: 'Inspection workflow step created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating inspection workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create inspection workflow step',
            details: error.message
        });
    }
};

const updateWorkflowStep = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Step name is required'
            });
        }

        const result = await model.updateWorkflowStep(id, text.trim());

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow step not found'
            });
        }

        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Inspection workflow step updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating inspection workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update inspection workflow step',
            details: error.message
        });
    }
};

const deleteWorkflowStep = async (req, res) => {
    try {
        const { id } = req.params;

        await model.deleteJobRolesByWorkflowStep(id);
        await model.deleteSequencesByWorkflowStep(id);

        const result = await model.deleteWorkflowStep(id);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow step not found'
            });
        }

        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Inspection workflow step deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting inspection workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete inspection workflow step',
            details: error.message
        });
    }
};

const getWorkflowSequencesByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const org_id = req.user.org_id;

        const { data: rows } = await operationalCache.cachedList(
            req,
            'inspection-details',
            `workflow-sequences:${asset_type_id}`,
            () => model.getWorkflowSequencesByAssetType(asset_type_id, org_id).then((result) => result.rows),
        );
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching inspection workflow sequences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inspection workflow sequences',
            details: error.message
        });
    }
};

const createWorkflowSequence = async (req, res) => {
    try {
        const { asset_type_id, wf_insp_steps_id, seqs_no } = req.body;
        const org_id = req.user.org_id;

        if (!asset_type_id || !wf_insp_steps_id || !seqs_no) {
            return res.status(400).json({
                success: false,
                error: 'Asset type, workflow step, and sequence number are required'
            });
        }

        const seqNum = parseInt(seqs_no, 10);
        if (isNaN(seqNum) || seqNum < 1) {
            return res.status(400).json({
                success: false,
                error: 'Sequence number must be a positive integer (e.g., 1, 2, 3)'
            });
        }

        const exists = await model.checkSequenceExists(asset_type_id, seqs_no, org_id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: `Sequence number ${seqs_no} already exists for this asset type`
            });
        }

        const result = await model.createWorkflowSequence(asset_type_id, wf_insp_steps_id, seqs_no, org_id);
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
        res.status(201).json({
            success: true,
            message: 'Inspection workflow sequence created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating inspection workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create inspection workflow sequence',
            details: error.message
        });
    }
};

const updateWorkflowSequence = async (req, res) => {
    try {
        const { id } = req.params;
        const { asset_type_id, wf_insp_steps_id, seqs_no } = req.body;
        const org_id = req.user.org_id;

        if (!asset_type_id || !wf_insp_steps_id || !seqs_no) {
            return res.status(400).json({
                success: false,
                error: 'Asset type, workflow step, and sequence number are required'
            });
        }

        const seqNum = parseInt(seqs_no, 10);
        if (isNaN(seqNum) || seqNum < 1) {
            return res.status(400).json({
                success: false,
                error: 'Sequence number must be a positive integer (e.g., 1, 2, 3)'
            });
        }

        const exists = await model.checkSequenceExists(asset_type_id, seqs_no, org_id, id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: `Sequence number ${seqs_no} already exists for this asset type`
            });
        }

        const result = await model.updateWorkflowSequence(id, wf_insp_steps_id, seqs_no, asset_type_id, org_id);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow sequence not found'
            });
        }

        operationalCache.invalidateOrgCaches(org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Inspection workflow sequence updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating inspection workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update inspection workflow sequence',
            details: error.message
        });
    }
};

const deleteWorkflowSequence = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await model.deleteWorkflowSequence(id);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow sequence not found'
            });
        }

        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Inspection workflow sequence deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting inspection workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete inspection workflow sequence',
            details: error.message
        });
    }
};

const getJobRolesByWorkflowStep = async (req, res) => {
    try {
        const { wf_insp_steps_id } = req.params;
        const org_id = req.user.org_id;

        const { data: rows } = await operationalCache.cachedList(
            req,
            'inspection-details',
            `workflow-job-roles:${wf_insp_steps_id}`,
            () => model.getJobRolesByWorkflowStep(wf_insp_steps_id, org_id).then((result) => result.rows),
        );
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching inspection workflow job roles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch job roles',
            details: error.message
        });
    }
};

const createWorkflowJobRole = async (req, res) => {
    try {
        const { wf_insp_steps_id, job_role_id, emp_int_id } = req.body;
        const org_id = req.user.org_id;

        if (!wf_insp_steps_id || !job_role_id) {
            return res.status(400).json({
                success: false,
                error: 'Workflow step and job role are required'
            });
        }

        const exists = await model.checkJobRoleExists(wf_insp_steps_id, job_role_id, org_id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: 'This job role is already assigned to this workflow step'
            });
        }

        const result = await model.createWorkflowJobRole(wf_insp_steps_id, job_role_id, emp_int_id || null, org_id);
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
        res.status(201).json({
            success: true,
            message: 'Job role assigned successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating inspection workflow job role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign job role',
            details: error.message
        });
    }
};

const updateWorkflowJobRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { wf_insp_steps_id, job_role_id, emp_int_id } = req.body;
        const org_id = req.user.org_id;

        if (!job_role_id) {
            return res.status(400).json({
                success: false,
                error: 'Job role is required'
            });
        }

        const currentRecord = await model.getJobRolesByWorkflowStep(wf_insp_steps_id, org_id);
        const currentJobRole = currentRecord.rows.find((r) => r.wf_insp_job_role_id === id);

        if (currentJobRole && currentJobRole.job_role_id !== job_role_id) {
            const exists = await model.checkJobRoleExists(wf_insp_steps_id, job_role_id, org_id, id);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: 'This job role is already assigned to this workflow step'
                });
            }
        }

        const result = await model.updateWorkflowJobRole(id, job_role_id, emp_int_id || null);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow job role not found'
            });
        }

        operationalCache.invalidateOrgCaches(org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Job role updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating inspection workflow job role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update job role',
            details: error.message
        });
    }
};

const deleteWorkflowJobRole = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await model.deleteWorkflowJobRole(id);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Inspection workflow job role not found'
            });
        }

        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});

        res.status(200).json({
            success: true,
            message: 'Job role removed successfully'
        });
    } catch (error) {
        console.error('Error deleting inspection workflow job role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove job role',
            details: error.message
        });
    }
};

module.exports = {
    getAllWorkflowSteps,
    createWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    getWorkflowSequencesByAssetType,
    createWorkflowSequence,
    updateWorkflowSequence,
    deleteWorkflowSequence,
    getJobRolesByWorkflowStep,
    createWorkflowJobRole,
    updateWorkflowJobRole,
    deleteWorkflowJobRole
};
