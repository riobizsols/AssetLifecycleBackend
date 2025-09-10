const model = require('../models/assetWorkflowHistoryModel');

// Get asset workflow history with filtering
const getAssetWorkflowHistory = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        const filters = { ...req.body, ...req.query };
        
        // Map frontend field names to backend field names
        if (filters.workOrderId) {
            filters.work_order_id = filters.workOrderId;
        }
        if (filters.assetId) {
            filters.asset_id = filters.assetId;
        }
        if (filters.vendorId) {
            filters.vendor_id = filters.vendorId;
        }
        if (filters.workflowStatus) {
            filters.workflow_status = filters.workflowStatus;
        }
        if (filters.stepStatus) {
            filters.step_status = filters.stepStatus;
        }
        if (filters.plannedScheduleDateFrom) {
            filters.planned_schedule_date_from = filters.plannedScheduleDateFrom;
        }
        if (filters.plannedScheduleDateTo) {
            filters.planned_schedule_date_to = filters.plannedScheduleDateTo;
        }
        if (filters.actualScheduleDateFrom) {
            filters.actual_schedule_date_from = filters.actualScheduleDateFrom;
        }
        if (filters.actualScheduleDateTo) {
            filters.actual_schedule_date_to = filters.actualScheduleDateTo;
        }
        if (filters.workflowCreatedDateFrom) {
            filters.workflow_created_date_from = filters.workflowCreatedDateFrom;
        }
        if (filters.workflowCreatedDateTo) {
            filters.workflow_created_date_to = filters.workflowCreatedDateTo;
        }
        if (filters.assetDescription) {
            filters.asset_description = filters.assetDescription;
        }
        if (filters.vendorName) {
            filters.vendor_name = filters.vendorName;
        }
        
        // Add pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        filters.limit = limit;
        filters.offset = offset;
        
        // Parse advanced conditions if it's a JSON string
        if (filters.advancedConditions && typeof filters.advancedConditions === 'string') {
            try {
                filters.advancedConditions = JSON.parse(filters.advancedConditions);
            } catch (error) {
                console.error('Error parsing advancedConditions:', error);
                filters.advancedConditions = [];
            }
        }
        
        // Log advanced conditions for debugging
        if (filters.advancedConditions) {
            console.log('Advanced Conditions:', JSON.stringify(filters.advancedConditions, null, 2));
        }
        
        console.log('Asset Workflow History Request:', { filters, orgId, page, limit });
        console.log('🔍 [Controller] Work Order ID filter:', filters.work_order_id);
        console.log('🔍 [Controller] Asset ID filter:', filters.asset_id);
        console.log('🔍 [Controller] Vendor ID filter:', filters.vendor_id);
        console.log('🔍 [Controller] Advanced Conditions:', JSON.stringify(filters.advancedConditions, null, 2));
        
        // Get workflow history and count
        const [historyResult, countResult] = await Promise.all([
            model.getAssetWorkflowHistory(filters, orgId),
            model.getAssetWorkflowHistoryCount(filters, orgId)
        ]);
        
        const totalCount = countResult.rows[0].total_count;
        const totalPages = Math.ceil(totalCount / limit);
        
        // Debug: Log sample data to see what's being returned
        if (historyResult.rows.length > 0) {
            console.log('🔍 [Controller] Sample record user data:', {
                user_id: historyResult.rows[0].user_id,
                user_name: historyResult.rows[0].user_name,
                user_email: historyResult.rows[0].user_email,
                wfamsd_id: historyResult.rows[0].wfamsd_id,
                wfamsh_id: historyResult.rows[0].wfamsd_id
            });
            console.log('🔍 [Controller] All available fields in first record:', Object.keys(historyResult.rows[0]));
        }
        
        // Format the response data
        const formattedData = historyResult.rows.map(record => ({
            // Workflow Header Information
            workflow_id: record.wfamsh_id,
            asset_maintenance_frequency_id: record.at_main_freq_id,
            maintenance_type_id: record.maint_type_id,
            asset_id: record.asset_id,
            group_id: record.group_id,
            vendor_id: record.vendor_id,
            planned_schedule_date: record.planned_schedule_date,
            actual_schedule_date: record.actual_schedule_date,
            workflow_status: record.workflow_status,
            workflow_created_by: record.workflow_created_by,
            workflow_created_on: record.workflow_created_on,
            workflow_changed_by: record.workflow_changed_by,
            workflow_changed_on: record.workflow_changed_on,
            
            // Workflow Step Information
            step_id: record.wfamsd_id,
            user_id: record.user_id,
            job_role_id: record.job_role_id,
            department_id: record.dept_id,
            sequence: record.sequence,
            step_status: record.step_status,
            step_notes: record.step_notes,
            step_changed_by: record.step_changed_by,
            step_changed_on: record.step_changed_on,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            service_vendor_id: record.service_vendor_id,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            maintenance_lead_type: record.maint_lead_type,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Vendor Information
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address,
            
            // User Information
            user_name: record.user_name,
            user_email: record.user_email,
            
            // Department Information
            department_name: record.department_name,
            
            // Job Role Information
            job_role_name: record.job_role_name,
            
            // Workflow History Information
            history_count: record.history_count,
            latest_action: record.latest_action,
            latest_action_date: record.latest_action_date,
            latest_action_by: record.latest_action_by
        }));
        
        res.json({
            success: true,
            data: formattedData,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_records: totalCount,
                records_per_page: limit,
                has_next_page: page < totalPages,
                has_previous_page: page > 1
            },
            filters_applied: filters
        });
        
    } catch (error) {
        console.error('Error in getAssetWorkflowHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch asset workflow history',
            error: error.message
        });
    }
};

// Get asset workflow history by asset ID
const getAssetWorkflowHistoryByAsset = async (req, res) => {
    try {
        const { assetId } = req.params;
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Asset Workflow History by Asset Request:', { assetId, orgId });
        
        const result = await model.getAssetWorkflowHistoryByAsset(assetId, orgId);
        
        // Format the response data
        const formattedData = result.rows.map(record => ({
            // Workflow Header Information
            workflow_id: record.wfamsh_id,
            asset_maintenance_frequency_id: record.at_main_freq_id,
            maintenance_type_id: record.maint_type_id,
            asset_id: record.asset_id,
            group_id: record.group_id,
            vendor_id: record.vendor_id,
            planned_schedule_date: record.planned_schedule_date,
            actual_schedule_date: record.actual_schedule_date,
            workflow_status: record.workflow_status,
            workflow_created_by: record.workflow_created_by,
            workflow_created_on: record.workflow_created_on,
            workflow_changed_by: record.workflow_changed_by,
            workflow_changed_on: record.workflow_changed_on,
            
            // Workflow Step Information
            step_id: record.wfamsd_id,
            user_id: record.user_id,
            job_role_id: record.job_role_id,
            department_id: record.dept_id,
            sequence: record.sequence,
            step_status: record.step_status,
            step_notes: record.step_notes,
            step_changed_by: record.step_changed_by,
            step_changed_on: record.step_changed_on,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            service_vendor_id: record.service_vendor_id,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            maintenance_lead_type: record.maint_lead_type,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Vendor Information
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address,
            
            // User Information
            user_name: record.user_name,
            user_email: record.user_email,
            
            // Department Information
            department_name: record.department_name,
            
            // Job Role Information
            job_role_name: record.job_role_name,
            
            // Workflow History Information
            history_count: record.history_count,
            latest_action: record.latest_action,
            latest_action_date: record.latest_action_date,
            latest_action_by: record.latest_action_by
        }));
        
        res.json({
            success: true,
            data: formattedData,
            asset_id: assetId,
            total_records: formattedData.length
        });
        
    } catch (error) {
        console.error('Error in getAssetWorkflowHistoryByAsset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch asset workflow history for asset',
            error: error.message
        });
    }
};

// Get workflow history details for a specific workflow
const getWorkflowHistoryDetails = async (req, res) => {
    try {
        const { workflowId } = req.params;
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Workflow History Details Request:', { workflowId, orgId });
        
        const result = await model.getWorkflowHistoryDetails(workflowId, orgId);
        
        // Format the response data
        const formattedData = result.rows.map(record => ({
            history_id: record.wfamhis_id,
            workflow_id: record.wfamsh_id,
            step_id: record.wfamsd_id,
            action_by: record.action_by,
            action_on: record.action_on,
            action: record.action,
            history_notes: record.history_notes,
            
            // Action performer details
            action_by_name: record.action_by_name,
            action_by_email: record.action_by_email,
            
            // Workflow step details
            sequence: record.sequence,
            step_status: record.step_status,
            step_user_id: record.step_user_id,
            job_role_id: record.job_role_id,
            department_id: record.dept_id,
            
            // Step user details
            step_user_name: record.step_user_name,
            step_user_email: record.step_user_email,
            
            // Department details
            department_name: record.department_name,
            
            // Job role details
            job_role_name: record.job_role_name
        }));
        
        res.json({
            success: true,
            data: formattedData,
            workflow_id: workflowId,
            total_records: formattedData.length
        });
        
    } catch (error) {
        console.error('Error in getWorkflowHistoryDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow history details',
            error: error.message
        });
    }
};

// Get asset workflow history summary
const getAssetWorkflowHistorySummary = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Asset Workflow History Summary Request:', { orgId });
        
        const result = await model.getAssetWorkflowHistorySummary(orgId);
        
        const summary = result.rows[0];
        
        res.json({
            success: true,
            summary: {
                total_workflow_records: parseInt(summary.total_workflow_records),
                completed_workflows: parseInt(summary.completed_workflows),
                in_progress_workflows: parseInt(summary.in_progress_workflows),
                in_process_workflows: parseInt(summary.in_process_workflows),
                cancelled_workflows: parseInt(summary.cancelled_workflows),
                workflows_last_30_days: parseInt(summary.workflows_last_30_days),
                workflows_last_90_days: parseInt(summary.workflows_last_90_days),
                unique_assets_in_workflow: parseInt(summary.unique_assets_in_workflow),
                unique_vendors_in_workflow: parseInt(summary.unique_vendors_in_workflow),
                unique_users_in_workflow: parseInt(summary.unique_users_in_workflow)
            }
        });
        
    } catch (error) {
        console.error('Error in getAssetWorkflowHistorySummary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch asset workflow history summary',
            error: error.message
        });
    }
};

// Get available filter options
const getWorkflowFilterOptions = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Workflow Filter Options Request:', { orgId });
        
        const result = await model.getWorkflowFilterOptions(orgId);
        
        res.json({
            success: true,
            filter_options: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error in getWorkflowFilterOptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow filter options',
            error: error.message
        });
    }
};

// Export asset workflow history
const exportAssetWorkflowHistory = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        const exportType = req.query.type || 'csv'; // 'pdf' or 'csv'
        const filters = req.body || {};
        
        console.log('Export Asset Workflow History Request:', { filters, orgId, exportType });
        
        // Get all data without pagination for export
        const result = await model.getAssetWorkflowHistory(filters, orgId);
        
        // Format the export data
        const exportData = result.rows.map(record => ({
            'Workflow ID': record.wfamsh_id,
            'Asset ID': record.asset_id,
            'Serial Number': record.serial_number,
            'Asset Description': record.asset_description,
            'Asset Type': record.asset_type_name,
            'Maintenance Type': record.maintenance_type_name,
            'Vendor': record.vendor_name,
            'Planned Schedule Date': record.planned_schedule_date,
            'Actual Schedule Date': record.actual_schedule_date,
            'Workflow Status': record.workflow_status,
            'Step Status': record.step_status,
            'User': record.user_name,
            'Department': record.department_name,
            'Job Role': record.job_role_name,
            'Sequence': record.sequence,
            'Step Notes': record.step_notes,
            'Vendor Contact': record.contact_person_name,
            'Vendor Email': record.vendor_email,
            'Vendor Phone': record.vendor_phone,
            'Vendor Address': record.vendor_address,
            'Workflow Created By': record.workflow_created_by,
            'Workflow Created On': record.workflow_created_on,
            'Latest Action': record.latest_action,
            'Latest Action Date': record.latest_action_date,
            'Latest Action By': record.latest_action_by,
            'History Count': record.history_count
        }));
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `asset-workflow-history-${timestamp}`;
        
        if (exportType.toLowerCase() === 'csv') {
            // Generate CSV
            console.log('Generating CSV export...');
            const csvContent = generateCSV(exportData);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            res.send(csvContent);
            
        } else {
            // Generate PDF (default)
            console.log('Generating PDF export...');
            try {
                const pdfBuffer = await generatePDF(exportData, filters);
                console.log('PDF generated successfully, size:', pdfBuffer.byteLength);
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
                res.send(Buffer.from(pdfBuffer));
            } catch (pdfError) {
                console.error('PDF generation failed:', pdfError);
                // Fallback to CSV if PDF generation fails
                console.log('Falling back to CSV due to PDF error...');
                const csvContent = generateCSV(exportData);
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
                res.send(csvContent);
            }
        }
        
    } catch (error) {
        console.error('Error in exportAssetWorkflowHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export asset workflow history',
            error: error.message
        });
    }
};

// Generate CSV content
const generateCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            if (value && typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
        });
        csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
};

// Generate PDF with vertical field layout
const generatePDF = async (data, filters) => {
    console.log('Starting PDF generation with', data.length, 'records');
    const jsPDF = require('jspdf').jsPDF;
    const doc = new jsPDF();
    console.log('PDF document created');
    
    // Set up document
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let yPosition = margin;
    
    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Asset Workflow History Report', margin, yPosition);
    yPosition += 15;
    
    // Add filters applied
    if (Object.keys(filters).length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Filters Applied:', margin, yPosition);
        yPosition += 8;
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                doc.text(`• ${key}: ${value}`, margin + 5, yPosition);
                yPosition += 6;
            }
        });
        yPosition += 10;
    }
    
    // Add generation info
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPosition);
    doc.text(`Total Records: ${data.length}`, pageWidth - margin - 50, yPosition);
    yPosition += 15;
    
    // Add separator line
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    // Process each record
    data.forEach((record, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            yPosition = margin;
        }
        
        // Record header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Record ${index + 1}`, margin, yPosition);
        yPosition += 10;
        
        // Add separator line for record
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 8;
        
        // Add fields vertically
        const fields = Object.entries(record);
        fields.forEach(([key, value]) => {
            if (yPosition > pageHeight - 30) {
                doc.addPage();
                yPosition = margin;
            }
            
            // Field label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${key}:`, margin, yPosition);
            
            // Field value
            doc.setFont('helvetica', 'normal');
            const valueStr = value ? String(value) : '';
            const maxWidth = contentWidth - 80;
            
            if (doc.getTextWidth(valueStr) > maxWidth) {
                const lines = doc.splitTextToSize(valueStr, maxWidth);
                doc.text(lines, margin + 80, yPosition);
                yPosition += (lines.length * 4);
            } else {
                doc.text(valueStr, margin + 80, yPosition);
                yPosition += 6;
            }
        });
        
        // Add space between records
        yPosition += 10;
    });
    
    // Add footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    }
    
    console.log('PDF generation completed, total pages:', totalPages);
    const pdfBuffer = doc.output('arraybuffer');
    console.log('PDF buffer created, size:', pdfBuffer.byteLength);
    
    return pdfBuffer;
};

module.exports = {
    getAssetWorkflowHistory,
    getAssetWorkflowHistoryByAsset,
    getWorkflowHistoryDetails,
    getAssetWorkflowHistorySummary,
    getWorkflowFilterOptions,
    exportAssetWorkflowHistory
};
