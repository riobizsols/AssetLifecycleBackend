const model = require('../models/sparePartsModel');

const getCategories = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const activeOnly = String(req.query.activeOnly || 'true').toLowerCase() !== 'false';

    const categories = await model.getCategories(
      org_id,
      branch_id,
      hasSuperAccess,
      activeOnly
    );
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching spare part categories:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part categories',
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const created_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;

    const { text, category, uom, minimum_stock, re_order_level, reorder_level } = req.body;
    const categoryName = text ?? category;
    const reorder = re_order_level ?? reorder_level;

    if (!categoryName || !String(categoryName).trim()) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (!uom || !String(uom).trim()) {
      return res.status(400).json({ success: false, error: 'UOM is required' });
    }

    const row = await model.createCategory({
      org_id,
      branch_id,
      text: categoryName,
      uom,
      minimum_stock,
      re_order_level: reorder,
      created_by,
    });

    return res.status(201).json({
      success: true,
      message: 'Spare part category created successfully',
      data: row,
    });
  } catch (error) {
    console.error('Error creating spare part category:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to create spare part category',
    });
  }
};

const getCategoryMappings = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);

    const mappings = await model.getCategoryMappings(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({
      success: true,
      data: mappings,
    });
  } catch (error) {
    console.error('Error fetching spare part category mappings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch asset type mappings',
    });
  }
};

const getIspModels = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const models = await model.getIspModels(org_id);
    return res.status(200).json({
      success: true,
      data: models,
    });
  } catch (error) {
    console.error('Error fetching ISP brand models:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch brand / model list',
    });
  }
};

const createCategoryMapping = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const created_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;

    const { spc_id, asset_type_id, spbm_id, prod_serv_id } = req.body;

    if (!spc_id) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (!asset_type_id) {
      return res.status(400).json({ success: false, error: 'Asset type is required' });
    }

    const row = await model.createCategoryMapping({
      org_id,
      branch_id,
      spc_id,
      asset_type_id,
      spbm_id,
      prod_serv_id,
      created_by,
    });

    return res.status(201).json({
      success: true,
      message: 'Asset type mapping saved successfully',
      data: row,
    });
  } catch (error) {
    console.error('Error creating spare part category mapping:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to save asset type mapping',
    });
  }
};

const getLots = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const rows = await model.getSparePartLots(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching spare part lots:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch spare part lots' });
  }
};

const createSparePartLot = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const created_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;

    const {
      spc_id,
      quantity,
      unit_price,
      invoice_no,
      invoice_number,
      lot_purchase_date,
      purchase_date,
      invoice_item_no,
      invoice_item_number,
      has_serial_number,
      serial_numbers,
      remarks,
    } = req.body;

    if (!spc_id) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (quantity === undefined || quantity === null || quantity === '') {
      return res.status(400).json({ success: false, error: 'Quantity is required' });
    }
    if (unit_price === undefined || unit_price === null || unit_price === '') {
      return res.status(400).json({ success: false, error: 'Unit price is required' });
    }
    if (Number(unit_price) < 0 || Number.isNaN(Number(unit_price))) {
      return res.status(400).json({ success: false, error: 'Unit price must be a valid number' });
    }

    const invoiceNo = invoice_no ?? invoice_number;
    const purchaseDate = lot_purchase_date ?? purchase_date;
    const invoiceItemNo = invoice_item_no ?? invoice_item_number;

    if (!invoiceNo || !String(invoiceNo).trim()) {
      return res.status(400).json({ success: false, error: 'Invoice number is required' });
    }
    if (!purchaseDate) {
      return res.status(400).json({ success: false, error: 'Purchase date is required' });
    }
    if (!invoiceItemNo || !String(invoiceItemNo).trim()) {
      return res.status(400).json({ success: false, error: 'Invoice item number is required' });
    }

    const result = await model.createSparePartLot({
      org_id,
      branch_id,
      spc_id,
      unit_price: Number(unit_price),
      lot_purchase_date: purchaseDate,
      invoice_no: String(invoiceNo).trim(),
      invoice_item_no: String(invoiceItemNo).trim(),
      quantity: Number(quantity),
      remarks: remarks || null,
      has_serial_number: Boolean(has_serial_number),
      serial_numbers: Array.isArray(serial_numbers) ? serial_numbers : [],
      created_by,
    });

    return res.status(201).json({
      success: true,
      message: 'Spare part lot saved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error creating spare part lot:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to save spare part lot',
    });
  }
};

const getLotIndividuals = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const { spld_id } = req.params;

    if (!spld_id) {
      return res.status(400).json({ success: false, error: 'Lot id is required' });
    }

    const individuals = await model.getIndividualsByLotId(spld_id, org_id);
    return res.status(200).json({
      success: true,
      data: individuals,
    });
  } catch (error) {
    console.error('Error fetching spare part individuals:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part serial records',
    });
  }
};

const createVendorSpareMappings = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const created_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;
    const { vendor_id, items } = req.body;

    if (!vendor_id) {
      return res.status(400).json({ success: false, error: 'Vendor is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one spare supply item is required',
      });
    }

    const created = await model.createVendorSpareMappings({
      org_id,
      branch_id,
      vendor_id,
      items,
      created_by,
    });

    return res.status(201).json({
      success: true,
      message: 'Spare supply mappings saved successfully',
      data: created,
    });
  } catch (error) {
    console.error('Error creating vendor spare mappings:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to save spare supply mappings',
    });
  }
};

const getMaintenanceList = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);

    const rows = await model.getSparePartMaintenanceList(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching spare part maintenance list:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch spare part list' });
  }
};

const getMaintenanceDetail = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { ams_id } = req.params;

    const row = await model.getSparePartMaintenanceDetail(
      ams_id,
      org_id,
      branch_id,
      hasSuperAccess
    );
    if (!row) {
      return res.status(404).json({ success: false, error: 'Maintenance record not found' });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('Error fetching spare part maintenance detail:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch maintenance detail' });
  }
};

const getCategoriesByAssetType = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { asset_type_id } = req.params;

    if (!asset_type_id) {
      return res.status(400).json({ success: false, error: 'Asset type is required' });
    }

    const rows = await model.getCategoryMappingsByAssetType(
      org_id,
      asset_type_id,
      branch_id,
      hasSuperAccess
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching categories by asset type:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

const createIssueRequests = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const created_by = req.user.user_id;
    const { assetmaintsch_id, ams_id, items } = req.body;

    const created = await model.createSpareIssueRequests({
      org_id,
      branch_id,
      assetmaintsch_id: assetmaintsch_id || ams_id,
      items,
      created_by,
    });

    return res.status(201).json({
      success: true,
      message: 'Spare part request submitted for approval',
      data: created,
    });
  } catch (error) {
    console.error('Error creating spare issue requests:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to submit spare part request',
    });
  }
};

const getIssueApprovals = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);

    const rows = await model.getSpareIssueApprovals(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching spare issue approvals:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch spare part approvals' });
  }
};

const getIssueApprovalDetail = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { si_id } = req.params;

    const row = await model.getSpareIssueApprovalDetail(
      si_id,
      org_id,
      branch_id,
      hasSuperAccess
    );
    if (!row) {
      return res.status(404).json({ success: false, error: 'Spare part request not found' });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('Error fetching spare issue approval detail:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch approval detail' });
  }
};

const approveIssue = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const approved_by = req.user.user_id;
    const { si_id } = req.params;

    const row = await model.approveSpareIssue({
      si_id,
      org_id,
      branch_id,
      approved_by,
    });

    return res.status(200).json({
      success: true,
      message: 'Spare part request approved and issued',
      data: row,
    });
  } catch (error) {
    console.error('Error approving spare issue:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to approve spare part request',
      code: error.code || undefined,
    });
  }
};

const getAvailableQty = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const { spc_id } = req.params;
    const qty = await model.getAvailableQuantity(spc_id, org_id);
    return res.status(200).json({ success: true, data: { spc_id, available_qty: qty } });
  } catch (error) {
    console.error('Error fetching available quantity:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch available quantity' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  getCategoryMappings,
  createCategoryMapping,
  getIspModels,
  getLots,
  createSparePartLot,
  getLotIndividuals,
  createVendorSpareMappings,
  getMaintenanceList,
  getMaintenanceDetail,
  getCategoriesByAssetType,
  createIssueRequests,
  getIssueApprovals,
  getIssueApprovalDetail,
  approveIssue,
  getAvailableQty,
};
