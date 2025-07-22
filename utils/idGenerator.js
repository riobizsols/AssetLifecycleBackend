const db = require("../config/db");

exports.generateCustomId = async (tableKey, padLength = 3) => {
    const result = await db.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey]
    );

    if (result.rows.length === 0) {
        throw new Error("Invalid tableKey provided to ID generator");
    }

    const { prefix, last_number } = result.rows[0];
    const next = last_number + 1;

    // Update the last number
    await db.query(
        'UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = $2',
        [next, tableKey]
    );

    // Return formatted ID, like DPT01 or USR001
    return `${prefix}${String(next).padStart(padLength, "0")}`;
};


exports.peekNextId = async (prefix, table, column, padding = 3) => {
    const result = await db.query(
        `SELECT ${column} FROM ${table} 
       ORDER BY CAST(SUBSTRING(${column} FROM '\\d+$') AS INTEGER) DESC 
       LIMIT 1`
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastId = result.rows[0][column];
        const match = lastId.match(/\d+/); // extract numeric part
        if (match) {
            nextNum = parseInt(match[0]) + 1;
        }
    }

    return `${prefix}${String(nextNum).padStart(padding, "0")}`;
};
  