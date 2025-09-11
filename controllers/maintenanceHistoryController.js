const model = require('../models/maintenanceHistoryModel');

// Get maintenance history with filtering
const getMaintenanceHistory = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        const {
            asset_id,
            vendor_id,
            wo_id,
            notes,
            maintenance_start_date_from,
            maintenance_start_date_to,
            maintenance_end_date_from,
            maintenance_end_date_to,
            status,
            maintenance_type_id,
            advancedConditions,
            page = 1,
            limit = 50
        } = req.query;

        // Build filters object
        const filters = {};
        
        if (asset_id) filters.asset_id = asset_id;
        if (vendor_id) filters.vendor_id = vendor_id;
        if (wo_id) filters.wo_id = wo_id;
        if (notes) filters.notes = notes;
        if (maintenance_start_date_from) filters.maintenance_start_date_from = maintenance_start_date_from;
        if (maintenance_start_date_to) filters.maintenance_start_date_to = maintenance_start_date_to;
        if (maintenance_end_date_from) filters.maintenance_end_date_from = maintenance_end_date_from;
        if (maintenance_end_date_to) filters.maintenance_end_date_to = maintenance_end_date_to;
        if (status) filters.status = status;
        if (maintenance_type_id) filters.maintenance_type_id = maintenance_type_id;

        // Parse and add advanced conditions
        if (advancedConditions) {
            try {
                filters.advancedConditions = typeof advancedConditions === 'string' 
                    ? JSON.parse(advancedConditions) 
                    : advancedConditions;
                console.log('🔍 [MaintenanceHistoryController] Advanced conditions:', filters.advancedConditions);
            } catch (error) {
                console.error('❌ [MaintenanceHistoryController] Error parsing advanced conditions:', error);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid advanced conditions format'
                });
            }
        }

        // Add pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        filters.limit = limitNum;
        filters.offset = offset;

        // Get maintenance history and count
        const [historyResult, countResult] = await Promise.all([
            model.getMaintenanceHistory(filters, orgId),
            model.getMaintenanceHistoryCount(filters, orgId)
        ]);

        const totalCount = parseInt(countResult.rows[0].total_count);
        const totalPages = Math.ceil(totalCount / limitNum);

        // Format the response
        const formattedData = historyResult.rows.map(record => ({
            // Maintenance Schedule Information
            ams_id: record.ams_id,
            wo_id: record.wo_id,
            asset_id: record.asset_id,
            maint_type_id: record.maint_type_id,
            vendor_id: record.vendor_id,
            act_maint_st_date: record.act_maint_st_date,
            act_main_end_date: record.act_main_end_date,
            notes: record.notes,
            status: record.status,
            maintained_by: record.maintained_by,
            po_number: record.po_number,
            invoice: record.invoice,
            technician_name: record.technician_name,
            technician_email: record.technician_email,
            technician_phno: record.technician_phno,
            created_by: record.created_by,
            created_on: record.created_on,
            changed_by: record.changed_by,
            changed_on: record.changed_on,
            org_id: record.org_id,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Vendor Information
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address
        }));

        res.json({
            success: true,
            message: 'Maintenance history retrieved successfully',
            data: formattedData,
            pagination: {
                current_page: pageNum,
                total_pages: totalPages,
                total_records: totalCount,
                records_per_page: limitNum,
                has_next_page: pageNum < totalPages,
                has_previous_page: pageNum > 1
            },
            filters_applied: filters,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getMaintenanceHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance history',
            error: error.message
        });
    }
};

// Get maintenance history by asset ID
const getMaintenanceHistoryByAsset = async (req, res) => {
    try {
        const { assetId } = req.params;
        const orgId = req.query.orgId || 'ORG001';

        if (!assetId) {
            return res.status(400).json({
                success: false,
                message: 'Asset ID is required'
            });
        }

        const result = await model.getMaintenanceHistoryByAsset(assetId, orgId);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No maintenance history found for this asset'
            });
        }

        // Format the response
        const formattedData = result.rows.map(record => ({
            // Maintenance Schedule Information
            ams_id: record.ams_id,
            wo_id: record.wo_id,
            asset_id: record.asset_id,
            maint_type_id: record.maint_type_id,
            vendor_id: record.vendor_id,
            act_maint_st_date: record.act_maint_st_date,
            act_main_end_date: record.act_main_end_date,
            notes: record.notes,
            status: record.status,
            maintained_by: record.maintained_by,
            po_number: record.po_number,
            invoice: record.invoice,
            technician_name: record.technician_name,
            technician_email: record.technician_email,
            technician_phno: record.technician_phno,
            created_by: record.created_by,
            created_on: record.created_on,
            changed_by: record.changed_by,
            changed_on: record.changed_on,
            org_id: record.org_id,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Vendor Information
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address
        }));

        res.json({
            success: true,
            message: 'Maintenance history for asset retrieved successfully',
            data: formattedData,
            count: formattedData.length,
            asset_id: assetId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getMaintenanceHistoryByAsset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance history for asset',
            error: error.message
        });
    }
};

// Get maintenance history by work order ID
const getMaintenanceHistoryByWorkOrder = async (req, res) => {
    try {
        const { woId } = req.params;
        const orgId = req.query.orgId || 'ORG001';

        if (!woId) {
            return res.status(400).json({
                success: false,
                message: 'Work Order ID is required'
            });
        }

        const result = await model.getMaintenanceHistoryByWorkOrder(woId, orgId);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No maintenance history found for this work order'
            });
        }

        // Format the response
        const formattedData = result.rows.map(record => ({
            // Maintenance Schedule Information
            ams_id: record.ams_id,
            wo_id: record.wo_id,
            asset_id: record.asset_id,
            maint_type_id: record.maint_type_id,
            vendor_id: record.vendor_id,
            act_maint_st_date: record.act_maint_st_date,
            act_main_end_date: record.act_main_end_date,
            notes: record.notes,
            status: record.status,
            maintained_by: record.maintained_by,
            po_number: record.po_number,
            invoice: record.invoice,
            technician_name: record.technician_name,
            technician_email: record.technician_email,
            technician_phno: record.technician_phno,
            created_by: record.created_by,
            created_on: record.created_on,
            changed_by: record.changed_by,
            changed_on: record.changed_on,
            org_id: record.org_id,
            
            // Asset Information
            serial_number: record.serial_number,
            asset_description: record.asset_description,
            asset_status: record.asset_status,
            purchased_on: record.purchased_on,
            purchased_cost: record.purchased_cost,
            
            // Asset Type Information
            asset_type_id: record.asset_type_id,
            asset_type_name: record.asset_type_name,
            
            // Maintenance Type Information
            maintenance_type_name: record.maintenance_type_name,
            
            // Vendor Information
            vendor_name: record.vendor_name,
            vendor_contact_person: record.contact_person_name,
            vendor_email: record.vendor_email,
            vendor_phone: record.vendor_phone,
            vendor_address: record.vendor_address
        }));

        res.json({
            success: true,
            message: 'Maintenance history for work order retrieved successfully',
            data: formattedData,
            count: formattedData.length,
            wo_id: woId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getMaintenanceHistoryByWorkOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance history for work order',
            error: error.message
        });
    }
};

// Get maintenance history summary statistics
const getMaintenanceHistorySummary = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';

        const result = await model.getMaintenanceHistorySummary(orgId);
        const summary = result.rows[0];

        res.json({
            success: true,
            message: 'Maintenance history summary retrieved successfully',
            data: {
                total_maintenance_records: parseInt(summary.total_maintenance_records),
                completed_maintenance: parseInt(summary.completed_maintenance),
                in_progress_maintenance: parseInt(summary.in_progress_maintenance),
                cancelled_maintenance: parseInt(summary.cancelled_maintenance),
                maintenance_last_30_days: parseInt(summary.maintenance_last_30_days),
                maintenance_last_90_days: parseInt(summary.maintenance_last_90_days),
                unique_assets_maintained: parseInt(summary.unique_assets_maintained),
                unique_vendors_used: parseInt(summary.unique_vendors_used)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getMaintenanceHistorySummary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance history summary',
            error: error.message
        });
    }
};

// Get filter options for dropdowns
const getFilterOptions = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';

        const result = await model.getFilterOptions(orgId);
        const options = result.rows[0];

        res.json({
            success: true,
            message: 'Filter options retrieved successfully',
            data: {
                asset_options: options.asset_options || [],
                vendor_options: options.vendor_options || [],
                work_order_options: options.work_order_options || [],
                maintenance_type_options: options.maintenance_type_options || [],
                status_options: options.status_options || []
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getFilterOptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve filter options',
            error: error.message
        });
    }
};

// Export maintenance history to PDF or CSV
const exportMaintenanceHistory = async (req, res) => {
    try {
        const orgId = req.query.orgId || 'ORG001';
        const exportType = req.query.type || 'pdf'; // 'pdf' or 'csv'
        const filters = req.body || {};

        // Get all records without pagination for export
        const result = await model.getMaintenanceHistory(filters, orgId);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No maintenance history records found for export'
            });
        }

        // Format data for export
        const exportData = result.rows.map(record => ({
            'AMS ID': record.ams_id,
            'Work Order ID': record.wo_id,
            'Asset ID': record.asset_id,
            'Serial Number': record.serial_number,
            'Asset Description': record.asset_description,
            'Asset Type': record.asset_type_name,
            'Maintenance Type': record.maintenance_type_name,
            'Vendor': record.vendor_name,
            'Maintenance Start Date': record.act_maint_st_date,
            'Maintenance End Date': record.act_main_end_date,
            'Status': record.status,
            'Maintained By': record.maintained_by,
            'Notes': record.notes,
            'PO Number': record.po_number,
            'Invoice': record.invoice,
            'Technician Name': record.technician_name,
            'Technician Email': record.technician_email,
            'Technician Phone': record.technician_phno,
            'Created By': record.created_by,
            'Created On': record.created_on
        }));

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `maintenance-history-${timestamp}`;

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
        console.error('Error in exportMaintenanceHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export maintenance history',
            error: error.message
        });
    }
};

// Generate CSV content
const generateCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
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
    doc.text('Maintenance History Report', margin, yPosition);
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
        const fields = [
            { label: 'AMS ID', value: record['AMS ID'] },
            { label: 'Work Order ID', value: record['Work Order ID'] },
            { label: 'Asset ID', value: record['Asset ID'] },
            { label: 'Serial Number', value: record['Serial Number'] },
            { label: 'Asset Description', value: record['Asset Description'] },
            { label: 'Asset Type', value: record['Asset Type'] },
            { label: 'Maintenance Type', value: record['Maintenance Type'] },
            { label: 'Vendor', value: record['Vendor'] },
            { label: 'Maintenance Start Date', value: record['Maintenance Start Date'] },
            { label: 'Maintenance End Date', value: record['Maintenance End Date'] },
            { label: 'Status', value: record['Status'] },
            { label: 'Maintained By', value: record['Maintained By'] },
            { label: 'Notes', value: record['Notes'] },
            { label: 'PO Number', value: record['PO Number'] },
            { label: 'Invoice', value: record['Invoice'] },
            { label: 'Technician Name', value: record['Technician Name'] },
            { label: 'Technician Email', value: record['Technician Email'] },
            { label: 'Technician Phone', value: record['Technician Phone'] },
            { label: 'Created By', value: record['Created By'] },
            { label: 'Created On', value: record['Created On'] }
        ];
        
        fields.forEach(field => {
            // Check if we need a new page
            if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
            }
            
            // Field label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${field.label}:`, margin, yPosition);
            
            // Field value
            doc.setFont('helvetica', 'normal');
            const value = field.value || 'N/A';
            const valueLines = doc.splitTextToSize(value.toString(), contentWidth - 60);
            
            if (valueLines.length === 1) {
                doc.text(valueLines[0], margin + 60, yPosition);
                yPosition += 6;
            } else {
                // Multi-line value
                valueLines.forEach((line, lineIndex) => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = margin;
                    }
                    doc.text(line, margin + 60, yPosition);
                    yPosition += 6;
                });
            }
            yPosition += 2;
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
    getMaintenanceHistory,
    getMaintenanceHistoryByAsset,
    getMaintenanceHistoryByWorkOrder,
    getMaintenanceHistorySummary,
    getFilterOptions,
    exportMaintenanceHistory
};
