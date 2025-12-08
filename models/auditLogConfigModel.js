const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


class AuditLogConfigModel {
  // Get all audit log configurations for an organization
  static async getAll(orgId) {
    const query = `
      SELECT 
        alc_id,
        app_id,
        event_id,
        enabled,
        reporting_required,
        reporting_email,
        description,
        org_id
      FROM "tblAuditLogConfig"
      WHERE org_id = $1
      ORDER BY app_id, event_id
    `;
    
    try {
      const dbPool = getDb();

<<<<<<< HEAD
      const result = await dbPool.query(query, [orgId]);
=======
      const result = await dbPool.query(query);
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
      return result.rows;
    } catch (error) {
      console.error('Error fetching audit log configs:', error);
      throw error;
    }
  }

  // Get audit log configuration by ID
  static async getById(alcId) {
    const query = `
      SELECT 
        alc_id,
        app_id,
        event_id,
        enabled,
        reporting_required,
        reporting_email,
        description,
        org_id
      FROM "tblAuditLogConfig"
      WHERE alc_id = $1
    `;
    
    try {
      const dbPool = getDb();

      const result = await dbPool.query(query, [alcId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching audit log config by ID:', error);
      throw error;
    }
  }

  // Update reporting required status
  static async updateReportingRequired(alcId, reportingRequired) {
    const query = `
      UPDATE "tblAuditLogConfig"
      SET reporting_required = $1
      WHERE alc_id = $2
      RETURNING *
    `;
    
    try {
      const dbPool = getDb();

      const result = await dbPool.query(query, [reportingRequired, alcId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating reporting required:', error);
      throw error;
    }
  }

  // Update enabled status
  static async updateEnabled(alcId, enabled) {
    const query = `
      UPDATE "tblAuditLogConfig"
      SET enabled = $1
      WHERE alc_id = $2
      RETURNING *
    `;
    
    try {
      const dbPool = getDb();

      const result = await dbPool.query(query, [enabled, alcId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating enabled status:', error);
      throw error;
    }
  }

  // Update reporting email
  static async updateReportingEmail(alcId, reportingEmail) {
    const query = `
      UPDATE "tblAuditLogConfig"
      SET reporting_email = $1
      WHERE alc_id = $2
      RETURNING *
    `;
    
    try {
      const dbPool = getDb();

      const result = await dbPool.query(query, [reportingEmail, alcId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating reporting email:', error);
      throw error;
    }
  }

  // Get configurations by app ID for an organization
  static async getByAppId(appId, orgId) {
    const query = `
      SELECT 
        alc_id,
        app_id,
        event_id,
        enabled,
        reporting_required,
        reporting_email,
        description,
        org_id
      FROM "tblAuditLogConfig"
      WHERE app_id = $1 AND org_id = $2
      ORDER BY event_id
    `;
    
    try {
      const dbPool = getDb();

<<<<<<< HEAD
      const result = await dbPool.query(query, [appId, orgId]);
=======
      const result = await dbPool.query(query, [appId]);
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
      return result.rows;
    } catch (error) {
      console.error('Error fetching audit log configs by app ID:', error);
      throw error;
    }
  }
}

module.exports = AuditLogConfigModel;
