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
    if (minimum_stock === undefined || minimum_stock === null || minimum_stock === '') {
      return res.status(400).json({ success: false, error: 'Minimum stock is required' });
    }
    if (reorder === undefined || reorder === null || reorder === '') {
      return res.status(400).json({ success: false, error: 'Reorder level is required' });
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

module.exports = {
  getCategories,
  createCategory,
  getCategoryMappings,
  createCategoryMapping,
  getIspModels,
  createSparePartLot,
  getLotIndividuals,
};
