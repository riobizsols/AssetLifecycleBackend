const db = require("../config/db");

exports.generateCustomId = async (tableKey, padLength = 3) => {
    console.log(`🔢 Generating ID for tableKey: ${tableKey}`);
    
    const result = await db.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey]
    );

    if (result.rows.length === 0) {
        throw new Error("Invalid tableKey provided to ID generator");
    }

    const { prefix, last_number } = result.rows[0];
    const next = last_number + 1;
    
    console.log(`🔢 Current last_number: ${last_number}, Next number: ${next}`);

    // Update the last number
    await db.query(
        'UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = $2',
        [next, tableKey]
    );

    // Generate the ID
    const generatedId = `${prefix}${String(next).padStart(padLength, "0")}`;
    console.log(`🔢 Generated ID: ${generatedId}`);

    // Check if this ID already exists in the target table
    const tableMap = {
        'asset_type': 'tblAssetTypes',
        'dept_asset': 'tblDeptAssetTypes',
        'department': 'tblDepartments',
        'user': 'tblUsers',
        'vendor': 'tblVendors',
        'asset': 'tblAssets',
        'psnq': 'tblPrintSerialNoQueue',
        'dept_admin': 'tblDeptAdmins',
        'branch': 'tblBranches',
        'vendor_prod_serv': 'tblVendorProdService',
        'prod_serv': 'tblProdServs'
    };

    const targetTable = tableMap[tableKey];
    if (targetTable) {
        const columnMap = {
            'asset_type': 'asset_type_id',
            'dept_asset': 'dept_asset_type_id',
            'department': 'dept_id',
            'user': 'user_id',
            'vendor': 'vendor_id',
            'asset': 'asset_id',
            'psnq': 'psnq_id',
            'dept_admin': 'dept_admin_id',
            'branch': 'branch_id',
            'vendor_prod_serv': 'ven_prod_serv_id',
            'prod_serv': 'prod_serv_id'
        };

        const columnName = columnMap[tableKey];
        if (columnName) {
            const existingCheck = await db.query(
                `SELECT ${columnName} FROM "${targetTable}" WHERE ${columnName} = $1`,
                [generatedId]
            );

            if (existingCheck.rows.length > 0) {
                console.warn(`⚠️ Generated ID ${generatedId} already exists, generating new one...`);
                // If ID exists, recursively generate a new one
                return await exports.generateCustomId(tableKey, padLength);
            }
        }
    }

    console.log(`✅ Final ID generated: ${generatedId}`);
    // Return formatted ID, like DPT01 or USR001
    return generatedId;
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
  