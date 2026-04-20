const { getOrgSetting } = require('../utils/orgSettingsUtils');

/**
 * GET /api/org-settings/software-asset-type
 * Returns the configured software asset type id for the org (tblOrgSettings key: software_at_id)
 */
async function getSoftwareAssetType(req, res) {
  try {
    const orgId = req.user?.org_id || req.query.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: 'org_id is required' });
    }

    const softwareAtId = await getOrgSetting('software_at_id', orgId);

    return res.json({
      success: true,
      data: { software_at_id: softwareAtId || null },
    });
  } catch (error) {
    console.error('Error fetching software_at_id org setting:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch org settings' });
  }
}

module.exports = { getSoftwareAssetType };

