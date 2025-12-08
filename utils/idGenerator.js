const db = require("../config/db");
const { getDbFromContext } = require('./dbContext');

// Helper to get database (tenant or default)
const getDb = () => getDbFromContext();

exports.generateCustomId = async (tableKey, padLength = 3) => {
    console.log(`🔢 Generating ID for tableKey: ${tableKey}`);
    
    const dbPool = getDb();
<<<<<<< HEAD
    let result = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey]
    );

    // Auto-create entry if it doesn't exist
    if (result.rows.length === 0) {
        console.log(`⚠️ Entry for ${tableKey} not found in tblIDSequences, creating it...`);
        
        // Default prefix mapping for auto-creation
        const defaultPrefixes = {
            'vendor_sla_rec': 'VSLAR'
        };
        
        const prefix = defaultPrefixes[tableKey] || tableKey.toUpperCase().substring(0, 5);
        
        // Insert new entry with last_number = 0
        await dbPool.query(
            'INSERT INTO "tblIDSequences" (table_key, prefix, last_number) VALUES ($1, $2, $3)',
            [tableKey, prefix, 0]
        );
        
        console.log(`✅ Created new ID sequence entry: ${tableKey} with prefix ${prefix}`);
        
        // Query again to get the newly created entry
        result = await dbPool.query(
=======
    const result = await dbPool.query(
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey]
    );

    if (result.rows.length === 0) {
            throw new Error(`Failed to create ID sequence entry for ${tableKey}`);
        }
    }

    const { prefix, last_number } = result.rows[0];
    const next = last_number + 1;
    
    console.log(`🔢 Current last_number: ${last_number}, Next number: ${next}`);

    // Update the last number
    await dbPool.query(
        'UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = $2',
        [next, tableKey]
    );

    // Generate the ID
    const generatedId = `${prefix}${String(next).padStart(padLength, "0")}`;
    console.log(`🔢 Generated ID: ${generatedId}`);

    // Check if this ID already exists in the target table
    const tableMap = {
        'asset_type': 'tblAssetTypes',
        'asset_type_prop': 'tblAssetTypeProps',
        'dept_asset': 'tblDeptAssetTypes',
        'department': 'tblDepartments',
        'user': 'tblUsers',
        'vendor': 'tblVendors',
        'asset': 'tblAssets',
        'psnq': 'tblPrintSerialNoQueue',
        'dept_admin': 'tblDeptAdmins',
        'branch': 'tblBranches',
        'vendor_prod_serv': 'tblVendorProdService',
        'prod_serv': 'tblProdServs',
        'asset_group_h': 'tblAssetGroup_H',
        'asset_group_d': 'tblAssetGroup_D',
        'asset_doc': 'tblAssetDocs',
        'asset_type_doc': 'tblATDocs',
        'asset_group_doc': 'tblAssetGroupDocs',
        'aplv': 'tblAssetPropListValues',
        'vendor_doc': 'tblVendorDocs',
        'asset_maint_doc': 'tblAssetMaintDocs',
        'atp': 'tblAssetTypeProps',
        'userjobrole': 'tblUserJobRoles',
        'asset_usage': 'tblAssetUsageReg',
<<<<<<< HEAD
        'vendor_sla': 'tblVendorSLAs',
        'vendor_sla_rec': 'tblvendorslarecs'
=======
        'vendor_sla': 'tblVendorSLAs'
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
    };

    const targetTable = tableMap[tableKey];
    if (targetTable) {
        const columnMap = {
            'asset_type': 'asset_type_id',
            'asset_type_prop': 'asset_type_prop_id',
            'dept_asset': 'dept_asset_type_id',
            'department': 'dept_id',
            'user': 'user_id',
            'vendor': 'vendor_id',
            'asset': 'asset_id',
            'psnq': 'psnq_id',
            'dept_admin': 'dept_admin_id',
            'branch': 'branch_id',
            'vendor_prod_serv': 'ven_prod_serv_id',
            'prod_serv': 'prod_serv_id',
            'asset_group_h': 'assetgroup_h_id',
            'asset_group_d': 'assetgroup_d_id',
            'asset_doc': 'a_d_id',
            'asset_type_doc': 'atd_id',
            'asset_group_doc': 'agd_id',
            'vendor_doc': 'vd_id',
            'asset_maint_doc': 'amd_id',
            'atp': 'asset_type_prop_id',
            'userjobrole': 'user_job_role_id',
            'asset_usage': 'aug_id',
<<<<<<< HEAD
            'vendor_sla': 'vsla_id',
            'vendor_sla_rec': 'vslar_id'
=======
            'vendor_sla': 'vsla_id'
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
        };

        const columnName = columnMap[tableKey];
        if (columnName) {
            const existingCheck = await dbPool.query(
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
    const dbPool = getDb();
    const result = await dbPool.query(
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
  