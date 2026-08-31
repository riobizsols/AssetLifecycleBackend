const model = require('../models/sparePartsModel');

const getCategories = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const activeOnly = String(req.query.activeOnly || 'true').toLowerCase() !== 'false';
    const orgWide = String(req.query.orgWide || 'false').toLowerCase() === 'true';

    const categories = await model.getCategories(
      org_id,
      branch_id,
      hasSuperAccess,
      activeOnly,
      orgWide
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

    const { text, category, uom, minimum_stock, re_order_level, reorder_level, spb_id, brand_id, spm_id, model_id } = req.body;
    const categoryName = text ?? category;
    const reorder = re_order_level ?? reorder_level;
    const brandId = spb_id || brand_id;
    const modelId = spm_id || model_id;

    if (!categoryName || !String(categoryName).trim()) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    if (!uom || !String(uom).trim()) {
      return res.status(400).json({ success: false, error: 'UOM is required' });
    }
    if (!brandId) {
      return res.status(400).json({ success: false, error: 'Brand is required' });
    }
    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Model is required' });
    }

    const row = await model.createCategory({
      org_id,
      branch_id,
      text: categoryName,
      uom,
      minimum_stock,
      re_order_level: reorder,
      spb_id: brandId,
      spm_id: modelId,
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

const getSpBrands = async (req, res) => {
  try {
    const spc_id = req.query.spc_id || req.query.category_id || null;
    const brands = await model.getSpBrands(req.user.org_id, spc_id);
    return res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error('Error fetching spare part brands:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch brands',
    });
  }
};

const createSpBrand = async (req, res) => {
  try {
    const { text, brand_name } = req.body;
    const name = text ?? brand_name;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Brand is required' });
    }

    const row = await model.createSpBrand({
      org_id: req.user.org_id,
      branch_id: req.user.branch_id || null,
      text: name,
      created_by: req.user.user_id,
    });

    return res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: row,
    });
  } catch (error) {
    console.error('Error creating spare part brand:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to create brand',
    });
  }
};

const getSpModels = async (req, res) => {
  try {
    const spb_id = req.query.spb_id || req.query.brand_id || null;
    const spc_id = req.query.spc_id || req.query.category_id || null;
    const models = await model.getSpModels(req.user.org_id, spb_id, spc_id);
    return res.status(200).json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching spare part models:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
    });
  }
};

const createSpModel = async (req, res) => {
  try {
    const { text, model_name, spb_id, brand_id } = req.body;
    const name = text ?? model_name;
    const brandId = spb_id || brand_id;
    if (!brandId) {
      return res.status(400).json({ success: false, error: 'Brand is required to create a model' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Model is required' });
    }

    const row = await model.createSpModel({
      org_id: req.user.org_id,
      branch_id: req.user.branch_id || null,
      spb_id: brandId,
      text: name,
      created_by: req.user.user_id,
    });

    return res.status(201).json({
      success: true,
      message: 'Model created successfully',
      data: row,
    });
  } catch (error) {
    console.error('Error creating spare part model:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to create model',
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

    const {
      spc_id,
      asset_type_id,
      category_brand_id,
      brand_id,
      category_model_id,
      model_id,
      asset_brand,
      asset_model,
      brand,
      model: modelName,
    } = req.body;

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
      category_brand_id: category_brand_id || brand_id,
      category_model_id: category_model_id || model_id,
      asset_brand: asset_brand || brand,
      asset_model: asset_model || modelName,
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

const getModCatCategories = async (req, res) => {
  try {
    const categories = await model.getModCatCategories(req.user.org_id);
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching mapping categories:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

const getProdServAssetTypes = async (req, res) => {
  try {
    const types = await model.getProdServAssetTypes(req.user.org_id);
    return res.status(200).json({ success: true, data: types });
  } catch (error) {
    console.error('Error fetching mapping asset types:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch asset types' });
  }
};

const getProdServBrands = async (req, res) => {
  try {
    const asset_type_id = req.query.asset_type_id || req.query.assetTypeId;
    if (!asset_type_id) {
      return res.status(400).json({ success: false, error: 'Asset type is required' });
    }
    const brands = await model.getProdServBrands(req.user.org_id, asset_type_id);
    return res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error('Error fetching mapping asset brands:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch brands' });
  }
};

const getProdServModels = async (req, res) => {
  try {
    const asset_type_id = req.query.asset_type_id || req.query.assetTypeId;
    const brand = req.query.brand;
    if (!asset_type_id) {
      return res.status(400).json({ success: false, error: 'Asset type is required' });
    }
    if (!brand) {
      return res.status(400).json({ success: false, error: 'Brand is required' });
    }
    const models = await model.getProdServModels(req.user.org_id, asset_type_id, brand);
    return res.status(200).json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching mapping asset models:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch models' });
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

const getLotById = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { spld_id } = req.params;

    if (!spld_id) {
      return res.status(400).json({ success: false, error: 'Lot id is required' });
    }

    const lot = await model.getSparePartLotById(
      spld_id,
      org_id,
      branch_id,
      hasSuperAccess
    );
    if (!lot) {
      return res.status(404).json({
        success: false,
        error: 'Spare part lot not found',
      });
    }

    return res.status(200).json({ success: true, data: lot });
  } catch (error) {
    console.error('Error fetching spare part lot:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part lot',
    });
  }
};

const createSparePartLot = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const created_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;

    const {
      spc_id,
      vendor_id,
      brand_id,
      model_id,
      part_number,
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
      vendor_id: vendor_id || null,
      brand_id: brand_id || null,
      model_id: model_id || null,
      part_number: part_number ? String(part_number).trim() : null,
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

const updateSparePartLot = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const changed_by = req.user.user_id;
    const branch_id = req.user.branch_id || null;
    const { spld_id } = req.params;

    if (!spld_id) {
      return res.status(400).json({ success: false, error: 'Lot id is required' });
    }

    const {
      spc_id,
      vendor_id,
      brand_id,
      model_id,
      part_number,
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

    const result = await model.updateSparePartLot({
      spld_id,
      org_id,
      branch_id,
      changed_by,
      spc_id,
      vendor_id: vendor_id || null,
      brand_id: brand_id || null,
      model_id: model_id || null,
      part_number: part_number ? String(part_number).trim() : null,
      unit_price: Number(unit_price),
      lot_purchase_date: purchaseDate,
      invoice_no: String(invoiceNo).trim(),
      invoice_item_no: String(invoiceItemNo).trim(),
      quantity: Number(quantity),
      remarks: remarks || null,
      has_serial_number: Boolean(has_serial_number),
      serial_numbers: Array.isArray(serial_numbers) ? serial_numbers : [],
    });

    return res.status(200).json({
      success: true,
      message: 'Spare part lot updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error updating spare part lot:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to update spare part lot',
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

const getVendorSpareMappings = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const vendor_id = req.query.vendor_id || req.params.vendor_id;
    if (!vendor_id) {
      return res.status(400).json({ success: false, error: 'Vendor is required' });
    }
    const rows = await model.getVendorSpareMappings(vendor_id, org_id);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching vendor spare mappings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare supply mappings',
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
      message: 'Spare part request approved and reserved',
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

const confirmIssue = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const issued_by = req.user.user_id;
    const { ams_id } = req.params;

    const rows = await model.confirmSparePartIssue({
      ams_id,
      org_id,
      branch_id,
      issued_by,
    });

    return res.status(200).json({
      success: true,
      message: 'Spare part issued successfully',
      data: rows,
    });
  } catch (error) {
    console.error('Error confirming spare issue:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to issue spare part',
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

const getLotVendors = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);

    const vendors = await model.getLotVendors(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.error('Error fetching spare part lot vendors:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part vendors',
    });
  }
};

const getLotCategoriesByVendor = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { vendor_id } = req.query;

    const categories = await model.getLotCategoriesByVendor(
      org_id,
      vendor_id || null,
      branch_id,
      hasSuperAccess
    );
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching lot categories by vendor:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part categories',
    });
  }
};

const getLotBrandsByCategory = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { spc_id, vendor_id } = req.query;

    const brands = await model.getLotBrandsByCategory(
      org_id,
      spc_id || null,
      vendor_id || null,
      branch_id,
      hasSuperAccess
    );
    return res.status(200).json({ success: true, data: brands });
  } catch (error) {
    console.error('Error fetching lot brands:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part brands',
    });
  }
};

const getLotModelsByCategoryAndBrand = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const { spc_id, brand_id, vendor_id } = req.query;
    if (!brand_id) {
      return res.status(400).json({ success: false, error: 'Brand is required' });
    }

    const models = await model.getLotModelsByCategoryAndBrand(
      org_id,
      spc_id || null,
      brand_id,
      vendor_id || null,
      branch_id,
      hasSuperAccess
    );
    return res.status(200).json({ success: true, data: models });
  } catch (error) {
    console.error('Error fetching lot models:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare part models',
    });
  }
};

const getLotPartNumber = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const { vendor_id, spc_id, brand_id, model_id } = req.query;

    if (!vendor_id || !spc_id || !brand_id || !model_id) {
      return res.status(400).json({
        success: false,
        error: 'Vendor, category, brand, and model are required',
      });
    }

    const match = await model.getLotPartNumber({
      org_id,
      vendor_id,
      spc_id,
      brand_id,
      model_id,
    });

    if (!match?.part_number) {
      return res.status(404).json({
        success: false,
        error: 'No part number found for the selected vendor, category, brand, and model',
      });
    }

    return res.status(200).json({ success: true, data: match });
  } catch (error) {
    console.error('Error fetching lot part number:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to fetch part number',
    });
  }
};

const getSparePartMasters = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess);
    const rows = await model.getSparePartMasters(org_id, branch_id, hasSuperAccess);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching spare part masters:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch spare parts',
    });
  }
};

const createSparePartMaster = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const branch_id = req.user.branch_id || null;
    const created_by = req.user.user_id;
    const {
      spc_id,
      brand_id,
      brand_name,
      model_id,
      model_name,
      part_number,
      properties,
    } = req.body;

    const result = await model.createSparePartMaster({
      org_id,
      branch_id,
      created_by,
      spc_id,
      brand_id: brand_id || null,
      brand_name: brand_name || null,
      model_id: model_id || null,
      model_name: model_name || null,
      part_number,
      properties: Array.isArray(properties) ? properties : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Spare part saved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error creating spare part master:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Failed to save spare part',
    });
  }
};

const getPropertyListValues = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const { prop_id } = req.params;
    if (!prop_id) {
      return res.status(400).json({ success: false, error: 'Property is required' });
    }

    const values = await model.getPropertyListValues(org_id, prop_id);
    return res.status(200).json({ success: true, data: values });
  } catch (error) {
    console.error('Error fetching property list values:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch property list values',
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  getSpBrands,
  createSpBrand,
  getSpModels,
  createSpModel,
  getCategoryMappings,
  createCategoryMapping,
  getModCatCategories,
  getProdServAssetTypes,
  getProdServBrands,
  getProdServModels,
  getIspModels,
  getLots,
  getLotById,
  createSparePartLot,
  updateSparePartLot,
  getLotIndividuals,
  getVendorSpareMappings,
  createVendorSpareMappings,
  getMaintenanceList,
  getMaintenanceDetail,
  getCategoriesByAssetType,
  createIssueRequests,
  getIssueApprovals,
  getIssueApprovalDetail,
  approveIssue,
  confirmIssue,
  getAvailableQty,
  getLotVendors,
  getLotCategoriesByVendor,
  getLotBrandsByCategory,
  getLotModelsByCategoryAndBrand,
  getLotPartNumber,
  getSparePartMasters,
  createSparePartMaster,
  getPropertyListValues,
};
