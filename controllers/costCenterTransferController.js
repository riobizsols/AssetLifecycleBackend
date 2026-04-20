const db = require("../config/db");
const { generateCustomId } = require("../utils/idGenerator");

const costCenterTransferController = {
  // Get all asset types
  getAssetTypes: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const org_id = req.user.org_id;
      
      const result = await dbPool.query(
        `SELECT asset_type_id, text 
         FROM "tblAssetTypes" 
         WHERE org_id = $1 AND int_status = 1
         ORDER BY text`,
        [org_id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching asset types:", error);
      res.status(500).json({ error: "Failed to fetch asset types" });
    }
  },

  // Get assets by asset type
  getAssetsByType: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const { asset_type_id } = req.params;
      const org_id = req.user.org_id;

      const result = await dbPool.query(
        `SELECT 
          a.asset_id,
          a.description as text,
          a.serial_number,
          a.cost_center_code,
          a.branch_id,
          b.text as branch_name,
          cc.cc_name as cost_center_name
         FROM "tblAssets" a
         LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
         LEFT JOIN "tblCostCenter" cc ON a.cost_center_code = cc.cc_id
         WHERE a.asset_type_id = $1 
           AND a.org_id = $2 
           AND a.current_status NOT IN ('SCRAPPED', 'DISPOSED')
         ORDER BY a.description`,
        [asset_type_id, org_id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching assets by type:", error);
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  },

  // Get asset details including cost center
  getAssetDetails: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const { asset_id } = req.params;
      const org_id = req.user.org_id;

      const result = await dbPool.query(
        `SELECT 
          a.asset_id,
          a.description as text,
          a.serial_number,
          a.cost_center_code,
          a.branch_id,
          b.text as branch_name,
          cc.cc_name as cost_center_name,
          cc.cc_no as cost_center_no
         FROM "tblAssets" a
         LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
         LEFT JOIN "tblCostCenter" cc ON a.cost_center_code = cc.cc_id
         WHERE a.asset_id = $1 AND a.org_id = $2`,
        [asset_id, org_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching asset details:", error);
      res.status(500).json({ error: "Failed to fetch asset details" });
    }
  },

  // Get all branches
  getBranches: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const org_id = req.user.org_id;

      const result = await dbPool.query(
        `SELECT branch_id, text, city, branch_code
         FROM "tblBranches"
         WHERE org_id = $1 AND int_status = 1
         ORDER BY text`,
        [org_id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  },

  // Get cost centers by branch
  getCostCentersByBranch: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const { branch_id } = req.params;
      const org_id = req.user.org_id;

      const result = await dbPool.query(
        `SELECT 
          cc.cc_id,
          cc.cc_no,
          cc.cc_name as text
         FROM "tblBranchCostCenter" bcc
         INNER JOIN "tblCostCenter" cc ON bcc.cc_id = cc.cc_id
         WHERE bcc.branch_id = $1 AND bcc.org_id = $2
         ORDER BY cc.cc_name`,
        [branch_id, org_id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      res.status(500).json({ error: "Failed to fetch cost centers" });
    }
  },

  // Transfer asset to branch and optionally update cost center
  transferAsset: async (req, res) => {
    const dbPool = req.db || db;
    const client = await dbPool.connect();
    
    try {
      const { asset_id, branch_id, cost_center_code } = req.body;
      const { user_id, org_id } = req.user;

      // Validate required fields
      if (!asset_id || !branch_id) {
        return res.status(400).json({ 
          error: "Missing required fields",
          message: "Asset ID and Branch ID are required" 
        });
      }

      await client.query('BEGIN');

      // Check if asset exists
      const assetCheck = await client.query(
        `SELECT asset_id, branch_id, cost_center_code 
         FROM "tblAssets" 
         WHERE asset_id = $1 AND org_id = $2`,
        [asset_id, org_id]
      );

      if (assetCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Asset not found" });
      }

      const oldBranchId = assetCheck.rows[0].branch_id;
      const oldCostCenter = assetCheck.rows[0].cost_center_code;

      // Check if branch exists
      const branchCheck = await client.query(
        `SELECT branch_id FROM "tblBranches" 
         WHERE branch_id = $1 AND org_id = $2`,
        [branch_id, org_id]
      );

      if (branchCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Branch not found" });
      }

      // If cost center provided, validate it belongs to the selected branch
      if (cost_center_code) {
        const costCenterCheck = await client.query(
          `SELECT bcc.bcc_id 
           FROM "tblBranchCostCenter" bcc
           WHERE bcc.cc_id = $1 AND bcc.branch_id = $2 AND bcc.org_id = $3`,
          [cost_center_code, branch_id, org_id]
        );

        if (costCenterCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: "Invalid cost center",
            message: "The selected cost center does not belong to the target branch" 
          });
        }
      }

      // Update asset with new branch and optionally new cost center
      const updateQuery = cost_center_code
        ? `UPDATE "tblAssets" 
           SET branch_id = $1, 
               cost_center_code = $2,
               changed_by = $3,
               changed_on = NOW()
           WHERE asset_id = $4 AND org_id = $5
           RETURNING *`
        : `UPDATE "tblAssets" 
           SET branch_id = $1,
               changed_by = $2,
               changed_on = NOW()
           WHERE asset_id = $3 AND org_id = $4
           RETURNING *`;

      const updateParams = cost_center_code
        ? [branch_id, cost_center_code, user_id, asset_id, org_id]
        : [branch_id, user_id, asset_id, org_id];

      const updateResult = await client.query(updateQuery, updateParams);

      // Save transfer history to tblCCTransfer
      const transferId = await generateCustomId('cc_transfer', 3);
      
      await client.query(
        `INSERT INTO "tblCCTransfer" 
         (cc_transfer_id, asset_id, current_branch_id, current_cost_center_code, 
          new_branch_id, new_cost_center_code, transferred_by, org_id, int_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
        [
          transferId,
          asset_id,
          oldBranchId,
          oldCostCenter,
          branch_id,
          cost_center_code || oldCostCenter, // Keep old if not changed
          user_id,
          org_id
        ]
      );

      await client.query('COMMIT');

      res.json({
        message: "Asset transferred successfully",
        asset: updateResult.rows[0],
        changes: {
          branch: { from: oldBranchId, to: branch_id },
          costCenter: cost_center_code 
            ? { from: oldCostCenter, to: cost_center_code }
            : { unchanged: oldCostCenter }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error transferring asset:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      res.status(500).json({ 
        error: "Failed to transfer asset",
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      client.release();
    }
  },

  // Get transfer history for an asset
  getTransferHistory: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const { asset_id } = req.params;
      const { org_id } = req.user;

      const result = await dbPool.query(
        `SELECT 
          cct.cc_transfer_id,
          cct.asset_id,
          a.description as asset_name,
          cb.branch_name as current_branch_name,
          nb.branch_name as new_branch_name,
          ccc.cc_name as current_cost_center_name,
          ncc.cc_name as new_cost_center_name,
          cct.transferred_at,
          u.user_name as transferred_by_name,
          cct.remarks
         FROM "tblCCTransfer" cct
         LEFT JOIN "tblAssets" a ON cct.asset_id = a.asset_id
         LEFT JOIN "tblBranches" cb ON cct.current_branch_id = cb.branch_id
         LEFT JOIN "tblBranches" nb ON cct.new_branch_id = nb.branch_id
         LEFT JOIN "tblCostCenter" ccc ON cct.current_cost_center_code = ccc.cc_id
         LEFT JOIN "tblCostCenter" ncc ON cct.new_cost_center_code = ncc.cc_id
         LEFT JOIN "tblUsers" u ON cct.transferred_by = u.user_id
         WHERE cct.asset_id = $1 AND cct.org_id = $2 AND cct.int_status = 1
         ORDER BY cct.transferred_at DESC`,
        [asset_id, org_id]
      );

      res.json({
        success: true,
        history: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch transfer history",
        message: error.message
      });
    }
  },

  // Get all transfer history with filters
  getAllTransferHistory: async (req, res) => {
    try {
      const dbPool = req.db || db;
      const { org_id } = req.user;
      const { start_date, end_date, branch_id, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT 
          cct.cc_transfer_id,
          cct.asset_id,
          a.description as asset_name,
          at.text as asset_type,
          cb.branch_name as current_branch_name,
          nb.branch_name as new_branch_name,
          ccc.cc_name as current_cost_center_name,
          ncc.cc_name as new_cost_center_name,
          cct.transferred_at,
          u.user_name as transferred_by_name,
          cct.remarks
         FROM "tblCCTransfer" cct
         LEFT JOIN "tblAssets" a ON cct.asset_id = a.asset_id
         LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
         LEFT JOIN "tblBranches" cb ON cct.current_branch_id = cb.branch_id
         LEFT JOIN "tblBranches" nb ON cct.new_branch_id = nb.branch_id
         LEFT JOIN "tblCostCenter" ccc ON cct.current_cost_center_code = ccc.cc_id
         LEFT JOIN "tblCostCenter" ncc ON cct.new_cost_center_code = ncc.cc_id
         LEFT JOIN "tblUsers" u ON cct.transferred_by = u.user_id
         WHERE cct.org_id = $1 AND cct.int_status = 1`;

      const params = [org_id];
      let paramCount = 1;

      if (start_date) {
        paramCount++;
        query += ` AND cct.transferred_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND cct.transferred_at <= $${paramCount}`;
        params.push(end_date);
      }

      if (branch_id) {
        paramCount++;
        query += ` AND (cct.current_branch_id = $${paramCount} OR cct.new_branch_id = $${paramCount})`;
        params.push(branch_id);
      }

      query += ` ORDER BY cct.transferred_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM "tblCCTransfer" cct
        WHERE cct.org_id = $1 AND cct.int_status = 1`;
      
      const countParams = [org_id];
      let countParamCount = 1;

      if (start_date) {
        countParamCount++;
        countQuery += ` AND cct.transferred_at >= $${countParamCount}`;
        countParams.push(start_date);
      }

      if (end_date) {
        countParamCount++;
        countQuery += ` AND cct.transferred_at <= $${countParamCount}`;
        countParams.push(end_date);
      }

      if (branch_id) {
        countParamCount++;
        countQuery += ` AND (cct.current_branch_id = $${countParamCount} OR cct.new_branch_id = $${countParamCount})`;
        countParams.push(branch_id);
      }

      const countResult = await dbPool.query(countQuery, countParams);

      res.json({
        success: true,
        history: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(countResult.rows[0].total) > parseInt(offset) + parseInt(limit)
        }
      });
    } catch (error) {
      console.error("Error fetching all transfer history:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch transfer history",
        message: error.message
      });
    }
  }
};

module.exports = costCenterTransferController;
