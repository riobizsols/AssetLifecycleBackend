const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const columnCache = new Map();

const getDb = () => getDbFromContext();

const getTableColumns = async (tableName) => {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  const columnMap = result.rows.reduce((acc, row) => {
    acc[row.column_name.toLowerCase()] = row.column_name;
    return acc;
  }, {});

  columnCache.set(tableName, columnMap);
  return columnMap;
};

const pickColumn = (columnMap, candidates) => {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (columnMap[key]) {
      return columnMap[key];
    }
  }
  return null;
};

const getTechCertColumns = async () => {
  const columnMap = await getTableColumns('tblTechCert');

  return {
    id: pickColumn(columnMap, ['tc_id']),
    name: pickColumn(columnMap, ['certificate_name']),
    number: pickColumn(columnMap, ['certificate_no']),
    org: pickColumn(columnMap, ['org_id', 'orgid']),
    createdBy: pickColumn(columnMap, ['created_by', 'createdby']),
    createdOn: pickColumn(columnMap, ['created_on', 'createdon'])
  };
};

const getMappingColumns = async () => {
  const columnMap = await getTableColumns('tblATMaintCert');

  return {
    id: pickColumn(columnMap, ['atmc_id']),
    assetTypeId: pickColumn(columnMap, ['asset_type_id', 'assettype_id']),
    certId: pickColumn(columnMap, ['tc_id']),
    org: pickColumn(columnMap, ['org_id', 'orgid']),
    createdBy: pickColumn(columnMap, ['created_by', 'createdby']),
    createdOn: pickColumn(columnMap, ['created_on', 'createdon']),
    maintTypeId: pickColumn(columnMap, ['maint_type_id', 'maintenance_type_id'])
  };
};

const getInspectionMappingColumns = async () => {
  try {
    const columnMap = await getTableColumns('tblATInspCert');
    
    if (!columnMap || Object.keys(columnMap).length === 0) {
      throw new Error('tblATInspCert table does not exist or is empty');
    }

    return {
      id: pickColumn(columnMap, ['atic_id']),
      assetTypeId: pickColumn(columnMap, ['asset_type_id', 'assettype_id']),
      certId: pickColumn(columnMap, ['tc_id']),
      org: pickColumn(columnMap, ['org_id', 'orgid']),
      createdBy: pickColumn(columnMap, ['created_by', 'createdby']),
      createdOn: pickColumn(columnMap, ['created_on', 'createdon'])
    };
  } catch (error) {
    throw new Error(`Failed to get inspection mapping columns: ${error.message}`);
  }
};

class TechCertModel {
  static async getAllCertificates(orgId) {
    const columns = await getTechCertColumns();
    if (!columns.id || !columns.name || !columns.number) {
      throw new Error('tblTechCert does not contain required columns');
    }

    const whereClause = columns.org ? `WHERE ${columns.org} = $1` : '';
    const params = columns.org ? [orgId] : [];
    const query = `
      SELECT
        ${columns.id} AS tech_cert_id,
        ${columns.name} AS cert_name,
        ${columns.number} AS cert_number
      FROM "tblTechCert"
      ${whereClause}
      ORDER BY ${columns.name}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows;
  }

  static async createCertificate({ name, number, orgId, createdBy }) {
    const columns = await getTechCertColumns();
    if (!columns.id || !columns.name || !columns.number) {
      throw new Error('tblTechCert does not contain required columns');
    }

    const dbPool = getDb();
    let attempt = 0;
    while (attempt < 5) {
      const techCertId = await generateCustomId('tcert', 3);
      const insertColumns = [columns.id, columns.name, columns.number];
      const values = [techCertId, name, number];
      const valueTokens = values.map((_, idx) => `$${idx + 1}`);

      if (columns.org) {
        insertColumns.push(columns.org);
        values.push(orgId);
        valueTokens.push(`$${values.length}`);
      }

      if (columns.createdBy) {
        insertColumns.push(columns.createdBy);
        values.push(createdBy);
        valueTokens.push(`$${values.length}`);
      }

      if (columns.createdOn) {
        insertColumns.push(columns.createdOn);
        valueTokens.push('NOW()');
      }

      const query = `
        INSERT INTO "tblTechCert" (${insertColumns.join(', ')})
        VALUES (${valueTokens.join(', ')})
        RETURNING ${columns.id} AS tech_cert_id,
                  ${columns.name} AS cert_name,
                  ${columns.number} AS cert_number
      `;
      try {
        const result = await dbPool.query(query, values);
        return result.rows[0];
      } catch (err) {
        // If duplicate key error, retry with a new ID
        if (err.code === '23505' && String(err.detail || '').includes('tblTechCert_pkey')) {
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate unique certificate ID after multiple attempts');
  }

  static async updateCertificate({ id, name, number }) {
    const columns = await getTechCertColumns();
    if (!columns.id || !columns.name || !columns.number) {
      throw new Error('tblTechCert does not contain required columns');
    }

    const query = `
      UPDATE "tblTechCert"
      SET ${columns.name} = $1,
          ${columns.number} = $2
      WHERE ${columns.id} = $3
      RETURNING ${columns.id} AS tech_cert_id,
                ${columns.name} AS cert_name,
                ${columns.number} AS cert_number
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, [name, number, id]);
    return result.rows[0];
  }

  static async deleteCertificate(id) {
    const columns = await getTechCertColumns();
    if (!columns.id) {
      throw new Error('tblTechCert does not contain required columns');
    }

    const query = `
      DELETE FROM "tblTechCert"
      WHERE ${columns.id} = $1
      RETURNING ${columns.id} AS tech_cert_id
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, [id]);
    return result.rows[0];
  }

  static async getMappedCertificates(assetTypeId, orgId) {
    const certColumns = await getTechCertColumns();
    const mapColumns = await getMappingColumns();

    if (!certColumns.id || !certColumns.name || !certColumns.number) {
      throw new Error('tblTechCert does not contain required columns');
    }

    if (!mapColumns.assetTypeId || !mapColumns.certId) {
      throw new Error('tblATMaintCert does not contain required columns');
    }

    const params = [assetTypeId];
    const orgClause = mapColumns.org ? `AND m.${mapColumns.org} = $2` : '';
    if (mapColumns.org) {
      params.push(orgId);
    }

    const query = `
      SELECT
        m.${mapColumns.certId} AS tech_cert_id,
        ${mapColumns.maintTypeId ? `m.${mapColumns.maintTypeId} AS maint_type_id,` : ''}
        c.${certColumns.name} AS cert_name,
        c.${certColumns.number} AS cert_number
      FROM "tblATMaintCert" m
      LEFT JOIN "tblTechCert" c
        ON m.${mapColumns.certId} = c.${certColumns.id}
      WHERE m.${mapColumns.assetTypeId} = $1
        ${orgClause}
      ORDER BY c.${certColumns.name}
    `;

    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows;
  }

  static async replaceAssetTypeCertificates(assetTypeId, certificateIds, orgId, createdBy, maintTypeId) {
    const mapColumns = await getMappingColumns();

    if (!mapColumns.assetTypeId || !mapColumns.certId) {
      throw new Error('tblATMaintCert does not contain required columns');
    }

    const dbPool = getDb();
    await dbPool.query('BEGIN');

    try {
      const deleteQuery = `
        DELETE FROM "tblATMaintCert"
        WHERE ${mapColumns.assetTypeId} = $1
        ${mapColumns.org ? `AND ${mapColumns.org} = $2` : ''}
      `;
      const deleteParams = mapColumns.org ? [assetTypeId, orgId] : [assetTypeId];
      await dbPool.query(deleteQuery, deleteParams);

      if (certificateIds.length === 0) {
        await dbPool.query('COMMIT');
        return [];
      }

      const inserted = [];

      for (const certId of certificateIds) {
        const insertColumns = [mapColumns.assetTypeId, mapColumns.certId];
        const values = [assetTypeId, certId];

        if (mapColumns.id) {
          const mappingId = await generateCustomId('atmc', 3);
          insertColumns.unshift(mapColumns.id);
          values.unshift(mappingId);
        }

        if (mapColumns.org) {
          insertColumns.push(mapColumns.org);
          values.push(orgId);
        }

        const valueTokens = values.map((_, idx) => `$${idx + 1}`);

        if (mapColumns.createdBy) {
          insertColumns.push(mapColumns.createdBy);
          values.push(createdBy);
          valueTokens.push(`$${values.length}`);
        }

        if (mapColumns.createdOn) {
          insertColumns.push(mapColumns.createdOn);
          valueTokens.push('NOW()');
        }

        if (mapColumns.maintTypeId) {
          insertColumns.push(mapColumns.maintTypeId);
          values.push(maintTypeId);
          valueTokens.push(`$${values.length}`);
        }

        const insertQuery = `
          INSERT INTO "tblATMaintCert" (${insertColumns.join(', ')})
          VALUES (${valueTokens.join(', ')})
          RETURNING ${mapColumns.certId} AS tech_cert_id
        `;

        const result = await dbPool.query(insertQuery, values);
        inserted.push(result.rows[0]);
      }

      await dbPool.query('COMMIT');
      return inserted;
    } catch (error) {
      await dbPool.query('ROLLBACK');
      throw error;
    }
  }

  static async replaceAssetTypeInspectionCertificates(assetTypeId, certificateIds, orgId, createdBy) {
    const mapColumns = await getInspectionMappingColumns();

    if (!mapColumns.assetTypeId || !mapColumns.certId) {
      throw new Error('tblATInspCert does not contain required columns');
    }

    const dbPool = getDb();
    await dbPool.query('BEGIN');

    try {
      const deleteQuery = `
        DELETE FROM "tblATInspCert"
        WHERE ${mapColumns.assetTypeId} = $1
        ${mapColumns.org ? `AND ${mapColumns.org} = $2` : ''}
      `;
      const deleteParams = mapColumns.org ? [assetTypeId, orgId] : [assetTypeId];
      await dbPool.query(deleteQuery, deleteParams);

      if (certificateIds.length === 0) {
        await dbPool.query('COMMIT');
        return [];
      }

      const inserted = [];

      for (const certId of certificateIds) {
        const insertColumns = [mapColumns.assetTypeId, mapColumns.certId];
        const values = [assetTypeId, certId];

        if (mapColumns.id) {
          const mappingId = await generateCustomId('atic', 3);
          insertColumns.unshift(mapColumns.id);
          values.unshift(mappingId);
        }

        if (mapColumns.org) {
          insertColumns.push(mapColumns.org);
          values.push(orgId);
        }

        const valueTokens = values.map((_, idx) => `$${idx + 1}`);

        if (mapColumns.createdBy) {
          insertColumns.push(mapColumns.createdBy);
          values.push(createdBy);
          valueTokens.push(`$${values.length}`);
        }

        if (mapColumns.createdOn) {
          insertColumns.push(mapColumns.createdOn);
          valueTokens.push('NOW()');
        }

        const insertQuery = `
          INSERT INTO "tblATInspCert" (${insertColumns.join(', ')})
          VALUES (${valueTokens.join(', ')})
          RETURNING ${mapColumns.certId} AS tech_cert_id
        `;

        const result = await dbPool.query(insertQuery, values);
        inserted.push(result.rows[0]);
      }

      await dbPool.query('COMMIT');
      return inserted;
    } catch (error) {
      await dbPool.query('ROLLBACK');
      throw error;
    }
  }

  static async getInspectionCertificates(assetTypeId, orgId) {
    try {
      const mapColumns = await getInspectionMappingColumns();
      const certColumns = await getTechCertColumns();

      if (!mapColumns.assetTypeId || !mapColumns.certId) {
        throw new Error('tblATInspCert does not contain required columns');
      }

      const params = [assetTypeId];
      const orgClause = mapColumns.org ? `AND m.${mapColumns.org} = $2` : '';
      if (mapColumns.org) {
        params.push(orgId);
      }

      const query = `
        SELECT
          m.${mapColumns.id} AS id,
          m.${mapColumns.certId} AS tech_cert_id,
          c.${certColumns.name} AS cert_name,
          c.${certColumns.number} AS cert_number,
          at.asset_type_id,
          at.text AS asset_type_name
        FROM "tblATInspCert" m
        LEFT JOIN "tblTechCert" c
          ON m.${mapColumns.certId} = c.${certColumns.id}
        LEFT JOIN "tblAssetTypes" at
          ON m.${mapColumns.assetTypeId} = at.asset_type_id
        WHERE m.${mapColumns.assetTypeId} = $1
          ${orgClause}
        ORDER BY c.${certColumns.name}
      `;

      const dbPool = getDb();
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error in getInspectionCertificates:', error);
      // Return empty array if table doesn't exist yet
      if (error.message && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  static async getAllInspectionCertificates(orgId) {
    try {
      const mapColumns = await getInspectionMappingColumns();
      const certColumns = await getTechCertColumns();

      const params = [];
      const orgClause = mapColumns.org ? `WHERE m.${mapColumns.org} = $1` : '';
      if (mapColumns.org) {
        params.push(orgId);
      }

      const query = `
        SELECT
          m.${mapColumns.id} AS id,
          m.${mapColumns.assetTypeId} AS asset_type_id,
          at.text AS asset_type_name,
          m.${mapColumns.certId} AS tech_cert_id,
          c.${certColumns.name} AS cert_name,
          c.${certColumns.number} AS cert_number
        FROM "tblATInspCert" m
        LEFT JOIN "tblTechCert" c
          ON m.${mapColumns.certId} = c.${certColumns.id}
        LEFT JOIN "tblAssetTypes" at
          ON m.${mapColumns.assetTypeId} = at.asset_type_id
        ${orgClause}
        ORDER BY at.text, c.${certColumns.name}
      `;

      const dbPool = getDb();
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error in getAllInspectionCertificates:', error);
      // Return empty array if table doesn't exist yet
      if (error.message && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  static async deleteInspectionCertificate(aticId, orgId) {
    try {
      const mapColumns = await getInspectionMappingColumns();
      const params = [aticId];
      const orgClause = mapColumns.org ? `AND ${mapColumns.org} = $2` : '';
      if (mapColumns.org) {
        params.push(orgId);
      }

      const query = `
        DELETE FROM "tblATInspCert"
        WHERE ${mapColumns.id} = $1
          ${orgClause}
      `;

      const dbPool = getDb();
      await dbPool.query(query, params);
      return true;
    } catch (error) {
      console.error('Error in deleteInspectionCertificate:', error);
      throw error;
    }
  }
}

module.exports = TechCertModel;
