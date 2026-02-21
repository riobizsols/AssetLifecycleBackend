#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

const table = process.argv[2];
if (!table) {
  console.error('Usage: node scripts/describe-table.js <table_name>');
  process.exit(2);
}

(async () => {
  try {
    const res = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (res.rows.length === 0) {
      console.log('Table not found or no columns');
      process.exit(0);
    }

    console.log(`Columns for table ${table}:`);
    res.rows.forEach(r => console.log(`  ${r.column_name} : ${r.data_type}`));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
