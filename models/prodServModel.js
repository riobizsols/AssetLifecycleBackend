// models/prodServModel.js
const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


async function addProdserv(data) {
  const {
    prod_serv_id,
    org_id,
    asset_type_id,
    brand,
    model,
    status,
    ps_type,
    description
  } = data;

  const isService = String(ps_type || '').toLowerCase() === 'service';
  let brandName = String(brand || '').trim();
  let modelName = String(model || '').trim();
  const descriptionText = String(description || '').trim();
  if (isService) {
    if (!descriptionText) {
      const err = new Error('Description is required');
      err.statusCode = 400;
      throw err;
    }
    if (!brandName) brandName = `S${String(Date.now()).slice(-8)}`;
    if (!modelName) modelName = 'S';
  } else {
    if (!brandName) {
      const err = new Error('Brand is required');
      err.statusCode = 400;
      throw err;
    }
    if (!modelName) {
      const err = new Error('Model is required');
      err.statusCode = 400;
      throw err;
    }
  }

  const dbPool = getDb();
  const dup = await dbPool.query(
    `
      SELECT prod_serv_id
      FROM "tblProdServs"
      WHERE org_id = $1
        AND asset_type_id = $2
        AND LOWER(BTRIM(brand)) = LOWER($3)
        AND LOWER(BTRIM(model)) = LOWER($4)
        AND COALESCE(ps_type, '') = COALESCE($5, '')
        AND status = 1
      LIMIT 1
    `,
    [org_id, asset_type_id, brandName, modelName, ps_type || null]
  );
  if (dup.rows.length) {
    const err = new Error('This brand and model already exist for the selected asset type');
    err.statusCode = 400;
    throw err;
  }

  const query = `
    INSERT INTO "tblProdServs"
    (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;
  const values = [prod_serv_id, org_id, asset_type_id, brandName, modelName, status, ps_type, descriptionText || null];

  const result = await dbPool.query(query, values);
  return result.rows[0];
}

async function deleteProdserv(prod_serv_id) {
  const query = `
    DELETE FROM "tblProdServs"
    WHERE prod_serv_id = $1
    RETURNING *;
  `;
  const dbPool = getDb();

  const result = await dbPool.query(query, [prod_serv_id]);
  return result.rows[0];
}

async function deleteMultipleProdserv(prod_serv_ids) {
  if (!Array.isArray(prod_serv_ids) || prod_serv_ids.length === 0) {
    throw new Error('Invalid or empty array of prod_serv_ids');
  }

  // Create placeholders for the IN clause
  const placeholders = prod_serv_ids.map((_, index) => `$${index + 1}`).join(',');
  
  const query = `
    DELETE FROM "tblProdServs"
    WHERE prod_serv_id IN (${placeholders})
    RETURNING *;
  `;
  
  const dbPool = getDb();

  
  const result = await dbPool.query(query, prod_serv_ids);
  return result.rows;
}

module.exports = {
  addProdserv,
  deleteProdserv,
  deleteMultipleProdserv,
  // ...other methods
};