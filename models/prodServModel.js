// models/prodServModel.js
const db = require('../config/db');

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

  const query = `
    INSERT INTO "tblProdServs"
    (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;
  const values = [prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description];
  const result = await db.query(query, values);
  return result.rows[0];
}

async function deleteProdserv(prod_serv_id) {
  const query = `
    DELETE FROM "tblProdServs"
    WHERE prod_serv_id = $1
    RETURNING *;
  `;
  const result = await db.query(query, [prod_serv_id]);
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
  
  const result = await db.query(query, prod_serv_ids);
  return result.rows;
}

module.exports = {
  addProdserv,
  deleteProdserv,
  deleteMultipleProdserv,
  // ...other methods
};