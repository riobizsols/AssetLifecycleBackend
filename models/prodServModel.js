// models/prodServModel.js
const db = require('../config/db');

async function addProdserv(data) {
  const {
    prod_serv_id,
    ext_id,
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
    (prod_serv_id, ext_id, org_id, asset_type_id, brand, model, status, ps_type, description)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `;
  const values = [prod_serv_id, ext_id, org_id, asset_type_id, brand, model, status, ps_type, description];
  const result = await db.query(query, values);
  return result.rows[0];
}

module.exports = {
  addProdserv,
  // ...other methods
};