const assetUsageModel = require("../models/assetUsageModel");

const getAssetsForUsageRecording = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId } = req.user || {};

    if (!orgId || !employeeIntId) {
      return res.status(400).json({
        message: "User is not linked to an employee or organization.",
      });
    }

    const assetTypeIds = await assetUsageModel.getUsageEligibleAssetTypeIds(orgId);

    if (!assetTypeIds.length) {
      return res.json({
        assetTypes: [],
        assets: [],
      });
    }

    const assets = await assetUsageModel.getAssignedAssetsForUser(
      employeeIntId,
      orgId,
      assetTypeIds,
      deptId
    );

    return res.json({
      assetTypes: assetTypeIds,
      assets,
    });
  } catch (error) {
    console.error("Error fetching assets for usage recording:", error);
    return res.status(500).json({
      message: "Failed to fetch assets for usage recording.",
      error: error.message,
    });
  }
};

const getUsageHistory = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId } = req.user || {};
    const { assetId } = req.params;

    if (!assetId) {
      return res.status(400).json({ message: "assetId is required." });
    }

    const hasAccess = await assetUsageModel.isAssetAccessibleByUser(
      assetId,
      employeeIntId,
      orgId,
      deptId
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this asset or it is not assigned to you.",
      });
    }

    const history = await assetUsageModel.getUsageHistoryByAsset(assetId);

    return res.json({
      assetId,
      history,
    });
  } catch (error) {
    console.error("Error fetching usage history:", error);
    return res.status(500).json({
      message: "Failed to fetch usage history.",
      error: error.message,
    });
  }
};

const recordUsage = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId, user_id: userId } = req.user || {};
    const { asset_id: assetId, usage_counter: usageCounter } = req.body || {};

    if (!assetId || usageCounter === undefined || usageCounter === null) {
      return res.status(400).json({
        message: "asset_id and usage_counter are required.",
      });
    }

    const parsedUsage = Number(usageCounter);
    if (!Number.isInteger(parsedUsage) || parsedUsage < 0) {
      return res.status(400).json({
        message: "usage_counter must be a non-negative integer.",
      });
    }

    const hasAccess = await assetUsageModel.isAssetAccessibleByUser(
      assetId,
      employeeIntId,
      orgId,
      deptId
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this asset or it is not assigned to you.",
      });
    }

    const record = await assetUsageModel.createUsageRecord({
      asset_id: assetId,
      usage_counter: parsedUsage,
      created_by: userId,
    });

    return res.status(201).json({
      message: "Usage recorded successfully.",
      record,
    });
  } catch (error) {
    console.error("Error recording asset usage:", error);
    return res.status(500).json({
      message: "Failed to record asset usage.",
      error: error.message,
    });
  }
};

module.exports = {
  getAssetsForUsageRecording,
  getUsageHistory,
  recordUsage,
};

