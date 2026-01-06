const model = require('../models/maintenanceDetailsModel');

// Get all workflow steps
const getAllWorkflowSteps = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const result = await model.getAllWorkflowSteps(org_id);
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching workflow steps:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflow steps',
            details: error.message
        });
    }
};

// Create workflow step
const createWorkflowStep = async (req, res) => {
    try {
        const { text } = req.body;
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Step name is required'
            });
        }

        const result = await model.createWorkflowStep(org_id, text.trim(), created_by);
        res.status(201).json({
            success: true,
            message: 'Workflow step created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow step',
            details: error.message
        });
    }
};

// Update workflow step
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
                error: 'Workflow step not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Workflow step updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workflow step',
            details: error.message
        });
    }
};

// Delete workflow step
const deleteWorkflowStep = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete related job roles and sequences first
        await model.deleteJobRolesByWorkflowStep(id);
        await model.deleteSequencesByWorkflowStep(id);

        const result = await model.deleteWorkflowStep(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow step not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Workflow step deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting workflow step:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workflow step',
            details: error.message
        });
    }
};

// Get workflow sequences for asset type
const getWorkflowSequencesByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const org_id = req.user.org_id;

        const result = await model.getWorkflowSequencesByAssetType(asset_type_id, org_id);
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching workflow sequences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflow sequences',
            details: error.message
        });
    }
};

// Create workflow sequence
const createWorkflowSequence = async (req, res) => {
    try {
        const { asset_type_id, wf_steps_id, seqs_no } = req.body;
        const org_id = req.user.org_id;

        if (!asset_type_id || !wf_steps_id || !seqs_no) {
            return res.status(400).json({
                success: false,
                error: 'Asset type, workflow step, and sequence number are required'
            });
        }

        // Validate sequence number format (should be 1, 2, 3, etc.)
        const seqNum = parseInt(seqs_no);
        if (isNaN(seqNum) || seqNum < 1) {
            return res.status(400).json({
                success: false,
                error: 'Sequence number must be a positive integer (e.g., 1, 2, 3)'
            });
        }

        // Check if sequence already exists for this asset type
        const exists = await model.checkSequenceExists(asset_type_id, seqs_no, org_id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: `Sequence number ${seqs_no} already exists for this asset type`
            });
        }

        const result = await model.createWorkflowSequence(asset_type_id, wf_steps_id, seqs_no, org_id);
        res.status(201).json({
            success: true,
            message: 'Workflow sequence created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create workflow sequence',
            details: error.message
        });
    }
};

// Update workflow sequence
const updateWorkflowSequence = async (req, res) => {
    try {
        const { id } = req.params;
        const { asset_type_id, wf_steps_id, seqs_no } = req.body;
        const org_id = req.user.org_id;

        if (!asset_type_id || !wf_steps_id || !seqs_no) {
            return res.status(400).json({
                success: false,
                error: 'Asset type, workflow step, and sequence number are required'
            });
        }

        // Validate sequence number format (should be 1, 2, 3, etc.)
        const seqNum = parseInt(seqs_no);
        if (isNaN(seqNum) || seqNum < 1) {
            return res.status(400).json({
                success: false,
                error: 'Sequence number must be a positive integer (e.g., 1, 2, 3)'
            });
        }

        // Check if sequence already exists for this asset type (excluding current record)
        const exists = await model.checkSequenceExists(asset_type_id, seqs_no, org_id, id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: `Sequence number ${seqs_no} already exists for this asset type`
            });
        }

        const result = await model.updateWorkflowSequence(id, wf_steps_id, seqs_no, asset_type_id, org_id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow sequence not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Workflow sequence updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update workflow sequence',
            details: error.message
        });
    }
};

// Delete workflow sequence
const deleteWorkflowSequence = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await model.deleteWorkflowSequence(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow sequence not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Workflow sequence deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting workflow sequence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete workflow sequence',
            details: error.message
        });
    }
};

// Get job roles for workflow step
const getJobRolesByWorkflowStep = async (req, res) => {
    try {
        const { wf_steps_id } = req.params;
        const org_id = req.user.org_id;

        const result = await model.getJobRolesByWorkflowStep(wf_steps_id, org_id);
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching job roles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch job roles',
            details: error.message
        });
    }
};

// Create workflow job role
const createWorkflowJobRole = async (req, res) => {
    try {
        const { wf_steps_id, job_role_id, emp_int_id, dept_id } = req.body;
        const org_id = req.user.org_id;

        if (!wf_steps_id || !job_role_id || !dept_id) {
            return res.status(400).json({
                success: false,
                error: 'Workflow step, job role, and department are required'
            });
        }

        // Check if job role already assigned to this workflow step
        const exists = await model.checkJobRoleExists(wf_steps_id, job_role_id, org_id);
        if (exists) {
            return res.status(400).json({
                success: false,
                error: 'This job role is already assigned to this workflow step'
            });
        }

        const result = await model.createWorkflowJobRole(wf_steps_id, job_role_id, emp_int_id || null, dept_id, org_id);
        res.status(201).json({
            success: true,
            message: 'Job role assigned successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating workflow job role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign job role',
            details: error.message
        });
    }
};

// Update workflow job role
const updateWorkflowJobRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { wf_steps_id, job_role_id, emp_int_id, dept_id } = req.body;
        const org_id = req.user.org_id;

        if (!job_role_id || !dept_id) {
            return res.status(400).json({
                success: false,
                error: 'Job role and department are required'
            });
        }

        // Get current workflow step to check job role uniqueness
        const currentRecord = await model.getJobRolesByWorkflowStep(wf_steps_id, org_id);
        const currentJobRole = currentRecord.rows.find(r => r.wf_job_role_id === id);

        // Check if job role already assigned to this workflow step (excluding current record)
        if (currentJobRole && currentJobRole.job_role_id !== job_role_id) {
            const exists = await model.checkJobRoleExists(wf_steps_id, job_role_id, org_id, id);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: 'This job role is already assigned to this workflow step'
                });
            }
        }

        const result = await model.updateWorkflowJobRole(id, job_role_id, emp_int_id || null, dept_id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow job role not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Job role updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating workflow job role:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update job role',
            details: error.message
        });
    }
};

// Delete workflow job role
const deleteWorkflowJobRole = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await model.deleteWorkflowJobRole(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Workflow job role not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Job role removed successfully'
        });
    } catch (error) {
        console.error('Error deleting workflow job role:', error);
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

