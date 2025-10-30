const model = require('../models/breakdownHistoryModel');
const {
    logReportApiCall,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logNoDataFound,
    logLargeResultSet, 
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');

// Get breakdown history with filtering
const getBreakdownHistory = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const APP_ID = 'BREAKDOWNHISTORY';
    
    try {
        const orgId = req.query.orgId || 'ORG001';
        const filters = req.query || {};
        
        // Add user's branch_id as default filter
        const userBranchId = req.user?.branch_id;
        if (userBranchId) {
            filters.branch_id = userBranchId;
            console.log('🔍 [BreakdownHistoryController] Added user branch_id filter:', userBranchId);
        }
        
        // Log API called
        await logReportApiCall({
            appId: APP_ID,
            operation: 'Get Breakdown History Report',
            method: req.method,
            url: req.originalUrl,
            requestData: { orgId, hasFilters: Object.keys(filters).length > 2 },
            userId
        });
        
        // Parse advancedConditions if it exists
        if (filters.advancedConditions) {
            try {
                filters.advancedConditions = JSON.parse(filters.advancedConditions);
            } catch (error) {
                console.error('Error parsing advancedConditions:', error);
                filters.advancedConditions = [];
            }
        }
        
        // Add pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        filters.limit = limit;
        filters.offset = offset;
        
        console.log('Breakdown History Request:', { filters, orgId, page, limit });
        
        // Log filters applied
        const appliedFilters = Object.keys(filters).filter(key => 
            filters[key] !== null && !['limit', 'offset', 'page', 'orgId'].includes(key)
        );
        
        if (appliedFilters.length > 0) {
            await logReportFiltersApplied({
                appId: APP_ID,
                reportType: 'Breakdown History',
                filters: Object.fromEntries(appliedFilters.map(key => [key, filters[key]])),
                userId
            });
        }
        
        // Log data retrieval started
        await logReportDataRetrieval({
            appId: APP_ID,
            reportType: 'Breakdown History',
            filters,
            userId
        });
        
        // Get breakdown history and count
        const [historyResult, countResult] = await Promise.all([
            model.getBreakdownHistory(filters, orgId),
            model.getBreakdownHistoryCount(filters, orgId)
        ]);
        
        const totalCount = countResult.rows[0].total_count;
        const totalPages = Math.ceil(totalCount / limit);
        const recordCount = historyResult.rows?.length || 0;
        
        // Format the response data
        const formattedData = historyResult.rows.map(record => ({
            // Breakdown Information
            breakdown_id: record.abr_id,
            asset_id: record.asset_id,
            breakdown_reason_code_id: record.atbrrc_id,
            reported_by: record.reported_by,
            is_create_maintenance: record.is_create_maintenance,
            decision_code: record.decision_code,
            breakdown_status: record.breakdown_status,
            breakdown_description: record.breakdown_description,
            breakdown_date: record.breakdown_date,
            breakdown_updated_on: record.breakdown_updated_on,
            breakdown_updated_by: record.breakdown_updated_by,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            service_vendor_id: record.service_vendor_id,
            group_id: record.group_id,
            branch_id: record.branch_id,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            maintenance_lead_type: record.maint_lead_type,
            
            // Breakdown Reason Information
            breakdown_reason: record.breakdown_reason,
            reason_code_status: record.reason_code_status,
            
            // Reported By User Information
            reported_by_name: record.reported_by_name,
            reported_by_email: record.reported_by_email,
            reported_by_phone: record.reported_by_phone,
            
            // Department Information
            department_id: record.dept_id,
            department_name: record.department_name,
            
            // Vendor Information
            vendor_id: record.vendor_id,
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address,
            
            // Work Order Information (if maintenance was created)
            work_order_id: record.work_order_id,
            maintenance_start_date: record.maintenance_start_date,
            maintenance_end_date: record.maintenance_end_date,
            maintenance_status: record.maintenance_status,
            maintenance_notes: record.maintenance_notes,
            maintained_by: record.maintained_by,
            po_number: record.po_number,
            invoice: record.invoice,
            technician_name: record.technician_name,
            technician_email: record.technician_email,
            technician_phone: record.technician_phno,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Branch Information
            branch_name: record.branch_name,
            
            // Group Information
            group_name: record.group_name
        }));
        
        // Log no data or success
        if (recordCount === 0) {
            await logNoDataFound({
                appId: APP_ID,
                reportType: 'Breakdown History',
                filters,
                userId,
                duration: Date.now() - startTime
            });
        } else {
            await logReportDataRetrieved({
                appId: APP_ID,
                reportType: 'Breakdown History',
                recordCount,
                filters,
                duration: Date.now() - startTime,
                userId
            });
            
            // Warn if large result set
            if (totalCount > 1000) {
                await logLargeResultSet({
                    appId: APP_ID,
                    reportType: 'Breakdown History',
                    recordCount: totalCount,
                    threshold: 1000,
                    userId
                });
            }
        }
        
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
        console.error('Error in getBreakdownHistory:', error);
        
        // Determine error level
        const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
        
        if (error.code === 'ECONNREFUSED') {
            await logDatabaseConnectionFailure({
                appId: APP_ID,
                reportType: 'Breakdown History',
                error,
                userId,
                duration: Date.now() - startTime
            });
        } else if (isDbError) {
            await logDatabaseQueryError({
                appId: APP_ID,
                reportType: 'Breakdown History',
                query: 'getBreakdownHistory',
                error,
                userId,
                duration: Date.now() - startTime
            });
        } else {
            await logReportGenerationError({
                appId: APP_ID,
                reportType: 'Breakdown History',
                error,
                filters: req.query,
                userId,
                duration: Date.now() - startTime
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to fetch breakdown history',
            error: error.message
        });
    }
};

// Get breakdown history by asset ID
const getBreakdownHistoryByAsset = async (req, res) => {
    try {
        const { assetId } = req.params;
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Breakdown History by Asset Request:', { assetId, orgId });
        
        const result = await model.getBreakdownHistoryByAsset(assetId, orgId);
        
        // Format the response data
        const formattedData = result.rows.map(record => ({
            // Breakdown Information
            breakdown_id: record.abr_id,
            asset_id: record.asset_id,
            breakdown_reason_code_id: record.atbrrc_id,
            reported_by: record.reported_by,
            is_create_maintenance: record.is_create_maintenance,
            decision_code: record.decision_code,
            breakdown_status: record.breakdown_status,
            breakdown_description: record.breakdown_description,
            breakdown_date: record.breakdown_date,
            breakdown_updated_on: record.breakdown_updated_on,
            breakdown_updated_by: record.breakdown_updated_by,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            service_vendor_id: record.service_vendor_id,
            group_id: record.group_id,
            branch_id: record.branch_id,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            maintenance_lead_type: record.maint_lead_type,
            
            // Breakdown Reason Information
            breakdown_reason: record.breakdown_reason,
            reason_code_status: record.reason_code_status,
            
            // Reported By User Information
            reported_by_name: record.reported_by_name,
            reported_by_email: record.reported_by_email,
            reported_by_phone: record.reported_by_phone,
            
            // Department Information
            department_id: record.dept_id,
            department_name: record.department_name,
            
            // Vendor Information
            vendor_id: record.vendor_id,
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address,
            
            // Work Order Information (if maintenance was created)
            work_order_id: record.work_order_id,
            maintenance_start_date: record.maintenance_start_date,
            maintenance_end_date: record.maintenance_end_date,
            maintenance_status: record.maintenance_status,
            maintenance_notes: record.maintenance_notes,
            maintained_by: record.maintained_by,
            po_number: record.po_number,
            invoice: record.invoice,
            technician_name: record.technician_name,
            technician_email: record.technician_email,
            technician_phone: record.technician_phno,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Branch Information
            branch_name: record.branch_name,
            
            // Group Information
            group_name: record.group_name
        }));
        
        res.json({
            success: true,
            data: formattedData,
            asset_id: assetId,
            total_records: formattedData.length
        });
        
    } catch (error) {
        console.error('Error in getBreakdownHistoryByAsset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch breakdown history for asset',
            error: error.message
        });
    }
};

// Get breakdown history summary
const getBreakdownHistorySummary = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        
        console.log('Breakdown History Summary Request:', { orgId });
        
        const result = await model.getBreakdownHistorySummary(orgId);
        
        const summary = result.rows[0];
        
        res.json({
            success: true,
            summary: {
                total_breakdown_records: parseInt(summary.total_breakdown_records),
                created_breakdowns: parseInt(summary.created_breakdowns),
                in_progress_breakdowns: parseInt(summary.in_progress_breakdowns),
                completed_breakdowns: parseInt(summary.completed_breakdowns),
                breakdowns_with_maintenance: parseInt(summary.breakdowns_with_maintenance),
                breakdowns_without_maintenance: parseInt(summary.breakdowns_without_maintenance),
                breakdowns_cancelled: parseInt(summary.breakdowns_cancelled),
                breakdowns_last_30_days: parseInt(summary.breakdowns_last_30_days),
                breakdowns_last_90_days: parseInt(summary.breakdowns_last_90_days),
                unique_assets_with_breakdowns: parseInt(summary.unique_assets_with_breakdowns),
                unique_reporters: parseInt(summary.unique_reporters),
                unique_vendors_involved: parseInt(summary.unique_vendors_involved)
            }
        });
        
    } catch (error) {
        console.error('Error in getBreakdownHistorySummary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch breakdown history summary',
            error: error.message
        });
    }
};

// Get available filter options
const getBreakdownFilterOptions = async (req, res) => {
    try {
        const orgId = req.query.orgId;
        
        console.log('Breakdown Filter Options Request:', { orgId });
        
        const result = await model.getBreakdownFilterOptions(orgId);
        
        res.json({
            success: true,
            filter_options: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error in getBreakdownFilterOptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch breakdown filter options',
            error: error.message
        });
    }
};

// Export breakdown history
const exportBreakdownHistory = async (req, res) => {
    try {
        const orgId = req.query.orgId;
        const exportType = req.query.type || 'csv'; // 'pdf' or 'csv'
        const filters = req.body || {};
        
        console.log('Export Breakdown History Request:', { filters, orgId, exportType });
        
        // Get all data without pagination for export
        const result = await model.getBreakdownHistory(filters, orgId);
        
        // Format the export data
        const exportData = result.rows.map(record => ({
            'Breakdown ID': record.abr_id,
            'Asset ID': record.asset_id,
            'Serial Number': record.serial_number,
            'Asset Description': record.asset_description,
            'Asset Type': record.asset_type_name,
            'Breakdown Date': record.breakdown_date,
            'Breakdown Status': record.breakdown_status,
            'Breakdown Description': record.breakdown_description,
            'Breakdown Reason': record.breakdown_reason,
            'Decision Code': record.decision_code,
            'Reported By': record.reported_by_name,
            'Reported By Email': record.reported_by_email,
            'Department': record.department_name,
            'Vendor': record.vendor_name,
            'Vendor Contact': record.contact_person_name,
            'Vendor Email': record.vendor_email,
            'Vendor Phone': record.vendor_phone,
            'Vendor Address': record.vendor_address,
            'Work Order ID': record.work_order_id,
            'Maintenance Start Date': record.maintenance_start_date,
            'Maintenance End Date': record.maintenance_end_date,
            'Maintenance Status': record.maintenance_status,
            'Maintenance Notes': record.maintenance_notes,
            'Maintained By': record.maintained_by,
            'PO Number': record.po_number,
            'Invoice': record.invoice,
            'Technician Name': record.technician_name,
            'Technician Email': record.technician_email,
            'Technician Phone': record.technician_phno,
            'Maintenance Type': record.maintenance_type_name,
            'Branch': record.branch_name,
            'Group': record.group_name,
            'Asset Status': record.asset_status,
            'Purchased On': record.purchased_on,
            'Purchased Cost': record.purchased_cost,
            'Updated On': record.breakdown_updated_on,
            'Updated By': record.breakdown_updated_by
        }));
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `breakdown-history-${timestamp}`;
        
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
        console.error('Error in exportBreakdownHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export breakdown history',
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
    doc.text('Breakdown History Report', margin, yPosition);
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
    getBreakdownHistory,
    getBreakdownHistoryByAsset,
    getBreakdownHistorySummary,
    getBreakdownFilterOptions,
    exportBreakdownHistory
};
