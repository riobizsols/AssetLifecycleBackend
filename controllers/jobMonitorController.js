const {
  listJobs,
  updateJob,
  executeJob,
  getJobHistory,
  addHistory,
  cleanupOldestWarrantyNotifications,
} = require('../models/jobMonitorModel');

const getJobs = async (req, res) => {
  try {
    const jobs = await listJobs();
    return res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Error in getJobs:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateJobConfig = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { frequency, status } = req.body;
    const normalizedStatus = status ? String(status).toUpperCase() : null;

    if (normalizedStatus && !['ENABLED', 'DISABLED'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Use ENABLED or DISABLED.' });
    }

    const updated = await updateJob(jobId, {
      frequency: frequency ?? null,
      status: normalizedStatus,
      changed_by: req.user?.user_id || 'SYSTEM',
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in updateJobConfig:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const runJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await executeJob(
      jobId,
      req.user?.user_id || 'SYSTEM',
      req.user?.org_id || 'ORG001',
    );
    return res.json({
      success: true,
      message: 'Job executed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error in runJob:', error);
    return res.status(400).json({
      success: false,
      message: error.message,
      output: error.output || null,
      durationMs: error.durationMs || null,
    });
  }
};

const getHistory = async (req, res) => {
  try {
    const { jobId } = req.params;
    const rows = await getJobHistory(jobId, 100);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error in getHistory:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const cleanupWarrantyNotifications = async (req, res) => {
  try {
    const limit = Number(req.body?.limit || 100);
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 100;
    const deleted = await cleanupOldestWarrantyNotifications(safeLimit);

    await addHistory({
      job_id: 'JOB006',
      executed_by: req.user?.user_id || 'SYSTEM',
      duration_ms: 0,
      is_error: false,
      output_json: {
        action: 'cleanup_oldest_warranty_notifications',
        limit: safeLimit,
        deletedCount: deleted.deletedCount,
      },
    });

    return res.json({
      success: true,
      message: `Deleted oldest ${deleted.deletedCount} warranty notifications`,
      data: deleted,
    });
  } catch (error) {
    console.error('Error in cleanupWarrantyNotifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getJobs,
  updateJobConfig,
  runJob,
  getHistory,
  cleanupWarrantyNotifications,
};

