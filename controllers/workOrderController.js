const model = require("../models/workOrderModel");

// Get all work orders
const getAllWorkOrders = async (req, res) => {
    try {
        console.log('Fetching all work orders with status "IN" and maintained_by "Vendor"...');
        
        // Get organization ID from request or use default
        const orgId = req.query.org_id || req.user?.org_id || 'ORG001';
        
        const result = await model.getAllWorkOrders(orgId);
        
        if (result.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No work orders found with status 'IN' and maintained_by 'Vendor'",
                data: [],
                count: 0
            });
        }
        
        // Format the response data with separated asset and vendor details
        const formattedData = result.rows.map(row => ({
            // Work Order Details
            ams_id: row.ams_id,
            wo_id: row.wo_id,
            wfamsh_id: row.wfamsh_id,
            final_approver_name: row.final_approver_name,
            approval_date: row.approval_date,
            recent_activities: row.recent_activities || [],
            maint_type_id: row.maint_type_id,
            maintenance_type_name: row.maintenance_type_name,
            act_maint_st_date: row.act_maint_st_date,
            act_main_end_date: row.act_main_end_date,
            status: row.status,
            notes: row.notes,
            po_number: row.po_number,
            invoice: row.invoice,
            technician_name: row.technician_name,
            technician_email: row.technician_email,
            technician_phno: row.technician_phno,
            days_until_due: parseInt(row.days_until_due) || 0,
            days_overdue: parseInt(row.days_overdue) || 0,
            created_by: row.created_by,
            created_on: row.created_on,
            changed_by: row.changed_by,
            changed_on: row.changed_on,
            org_id: row.org_id,
            
            // Asset Details
            asset: {
                asset_id: row.asset_id,
                asset_type_id: row.asset_type_id,
                serial_number: row.serial_number,
                description: row.asset_description,
                purchased_on: row.purchased_on,
                service_vendor_id: row.service_vendor_id
            },
            
            // Asset Type Details
            asset_type: {
                asset_type_id: row.asset_type_id,
                asset_type_name: row.asset_type_name,
                maint_required: row.maint_required,
                assignment_type: row.assignment_type,
                inspection_required: row.inspection_required,
                group_required: row.group_required,
                is_child: row.is_child,
                parent_asset_type_id: row.parent_asset_type_id,
                maint_type_id: row.asset_type_maint_type_id,
                maint_lead_type: row.maint_lead_type,
                depreciation_type: row.depreciation_type,
                checklist_items: row.checklist_items || []
            },
            
            // Vendor Details
            vendor: {
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                contact_person: row.contact_person_name,
                email: row.vendor_email,
                phone: row.vendor_phone
            },
            
            // Breakdown Details (if applicable)
            breakdown_info: row.breakdown_info || null
        }));
        
        console.log(`Successfully fetched ${formattedData.length} work orders with status 'IN' and maintained_by 'Vendor'`);
        
        return res.status(200).json({
            success: true,
            message: "Work orders with status 'IN' and maintained_by 'Vendor' retrieved successfully",
            data: formattedData,
            count: formattedData.length
        });
        
    } catch (error) {
        console.error('Error fetching work orders:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching work orders",
            error: error.message
        });
    }
};

// Get work order by ID
const getWorkOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Work order ID is required"
            });
        }
        
        console.log(`Fetching work order with ID: ${id} with status 'IN' and maintained_by 'Vendor'`);
        
        // Get organization ID from request or use default
        const orgId = req.query.org_id || req.user?.org_id || 'ORG001';
        
        const result = await model.getWorkOrderById(id, orgId);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Work order not found or does not meet criteria (status 'IN' and maintained_by 'Vendor')"
            });
        }
        
        const workOrder = result.rows[0];
        
        // Format the response data with separated asset and vendor details
        const formattedData = {
            // Work Order Details
            ams_id: workOrder.ams_id,
            wo_id: workOrder.wo_id,
            wfamsh_id: workOrder.wfamsh_id,
            final_approver_name: workOrder.final_approver_name,
            approval_date: workOrder.approval_date,
            recent_activities: workOrder.recent_activities || [],
            maint_type_id: workOrder.maint_type_id,
            maintenance_type_name: workOrder.maintenance_type_name,
            act_maint_st_date: workOrder.act_maint_st_date,
            act_main_end_date: workOrder.act_main_end_date,
            status: workOrder.status,
            notes: workOrder.notes,
            po_number: workOrder.po_number,
            invoice: workOrder.invoice,
            technician_name: workOrder.technician_name,
            technician_email: workOrder.technician_email,
            technician_phno: workOrder.technician_phno,
            days_until_due: parseInt(workOrder.days_until_due) || 0,
            days_overdue: parseInt(workOrder.days_overdue) || 0,
            created_by: workOrder.created_by,
            created_on: workOrder.created_on,
            changed_by: workOrder.changed_by,
            changed_on: workOrder.changed_on,
            org_id: workOrder.org_id,
            
            // Asset Details
            asset: {
                asset_id: workOrder.asset_id,
                asset_type_id: workOrder.asset_type_id,
                serial_number: workOrder.serial_number,
                description: workOrder.asset_description,
                purchased_on: workOrder.purchased_on,
                service_vendor_id: workOrder.service_vendor_id
            },
            
            // Asset Type Details
            asset_type: {
                asset_type_id: workOrder.asset_type_id,
                asset_type_name: workOrder.asset_type_name,
                maint_required: workOrder.maint_required,
                assignment_type: workOrder.assignment_type,
                inspection_required: workOrder.inspection_required,
                group_required: workOrder.group_required,
                is_child: workOrder.is_child,
                parent_asset_type_id: workOrder.parent_asset_type_id,
                maint_type_id: workOrder.asset_type_maint_type_id,
                maint_lead_type: workOrder.maint_lead_type,
                depreciation_type: workOrder.depreciation_type,
                checklist_items: workOrder.checklist_items || []
            },
            
            // Vendor Details
            vendor: {
                vendor_id: workOrder.vendor_id,
                vendor_name: workOrder.vendor_name,
                contact_person: workOrder.contact_person_name,
                email: workOrder.vendor_email,
                phone: workOrder.vendor_phone
            },
            
            // Breakdown Details (if applicable)
            breakdown_info: workOrder.breakdown_info || null
        };
        
        console.log(`Successfully fetched work order with ID: ${id} with status 'IN' and maintained_by 'Vendor'`);
        
        return res.status(200).json({
            success: true,
            message: "Work order with status 'IN' and maintained_by 'Vendor' retrieved successfully",
            data: formattedData
        });
        
    } catch (error) {
        console.error('Error fetching work order by ID:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching work order",
            error: error.message
        });
    }
};

module.exports = {
    getAllWorkOrders,
    getWorkOrderById
};
