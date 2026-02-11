const db = require("../config/db");
const { getDbFromContext } = require('./dbContext');

// Helper to get database (tenant or default)
const getDb = () => getDbFromContext();

exports.generateCustomId = async (tableKey, padLength = 3) => {
    console.log(`🔢 Generating ID for tableKey: ${tableKey}`);
    
    const dbPool = getDb();
    let result = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [tableKey]
    );

    // Auto-create entry if it doesn't exist
    if (result.rows.length === 0) {
        console.log(`⚠️ Entry for ${tableKey} not found in tblIDSequences, creating it...`);
        
        // Default prefix mapping for auto-creation
        const defaultPrefixes = {
            'vendor_sla_rec': 'VSLAR',
            'atmf': 'ATMF',
            'wfs': 'WFS',
            'wfas': 'WFAS',
            'wfjr': 'WFJR',
            'prop': 'PROP',
            'atbrrc': 'ATBRRC',
            'atmcl': 'ATMCL',
            'job_role_nav': 'JRN',
            'job_role': 'JR',
            // Scrap workflow tables
            'wfscrapseq': 'WFSCQ',
            'wfscrap_h': 'WFSCH',
            'wfscrap_d': 'WFSCD',
            'asset_scrap': 'ASCP',
            // Existing scrap details table (legacy, used by reports/UI)
            'asset_scrap_det': 'ASD'
        };
        
        const prefix = defaultPrefixes[tableKey] || tableKey.toUpperCase().substring(0, 5);
        
        // Insert new entry with last_number = 0 (or seed from existing table if needed)
        let initialLastNumber = 0;
        if (tableKey === 'asset_scrap_det') {
            // tblAssetScrapDet already has data in most DBs (ASD0001, ASD0002, ...).
            // Seed tblIDSequences to avoid generating duplicates and doing many retries.
            try {
                const r = await dbPool.query(
                    `
                      SELECT COALESCE(MAX(CAST(SUBSTRING(asd_id FROM 4) AS INTEGER)), 0) AS max_seq
                      FROM "tblAssetScrapDet"
                      WHERE asd_id LIKE 'ASD%'
                    `
                );
                initialLastNumber = Number(r.rows?.[0]?.max_seq || 0);
            } catch (e) {
                initialLastNumber = 0;
            }
        }

        await dbPool.query(
            'INSERT INTO "tblIDSequences" (table_key, prefix, last_number) VALUES ($1, $2, $3)',
            [tableKey, prefix, initialLastNumber]
        );
        
        console.log(`✅ Created new ID sequence entry: ${tableKey} with prefix ${prefix}`);
        
        // Query again to get the newly created entry
        result = await dbPool.query(
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
        'vendor_sla': 'tblVendorSLAs',
        'vendor_sla_rec': 'tblvendorslarecs',
        'atmf': 'tblATMaintFreq',
        'wfs': 'tblWFSteps',
        'wfas': 'tblWFATSeqs',
        'wfjr': 'tblWFJobRole',
        'prop': 'tblProps',
        'atbrrc': 'tblATBRReasonCodes',
        'atmcl': 'tblATMaintCheckList',
        'job_role_nav': 'tblJobRoleNav',
        'job_role': 'tblJobRoles',
        // Scrap workflow tables
        'wfscrapseq': 'tblWFScrapSeq',
        'wfscrap_h': 'tblWFScrap_H',
        'wfscrap_d': 'tblWFScrap_D',
        'asset_scrap': 'tblAssetScrap',
        // Existing scrap details table (legacy)
        'asset_scrap_det': 'tblAssetScrapDet'
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
            'vendor_sla': 'vsla_id',
            'vendor_sla_rec': 'vslar_id',
            'atmf': 'at_main_freq_id',
            'wfs': 'wf_steps_id',
            'wfas': 'wf_at_seqs_id',
            'wfjr': 'wf_job_role_id',
            'prop': 'prop_id',
            'atbrrc': 'atbrrc_id',
            'atmcl': 'at_main_checklist_id',
            'job_role_nav': 'job_role_nav_id',
            'job_role': 'job_role_id',
            // Scrap workflow tables
            'wfscrapseq': 'id',
            'wfscrap_h': 'id_d',
            'wfscrap_d': 'id',
            'asset_scrap': 'id',
            // Existing scrap details table (legacy)
            'asset_scrap_det': 'asd_id'
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
       ORDER BY CAST(SUBSTRING(${column} FROM '[0-9]+$') AS INTEGER) DESC 
       LIMIT 1`
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastId = result.rows[0][column];
        const match = lastId.match(/[0-9]+/g); // extract all numeric parts
        if (match) {
            // Pick the last numeric part for sequencing
            const lastPart = match[match.length - 1];
            nextNum = parseInt(lastPart) + 1;
        }
    }

    return `${prefix}${String(nextNum).padStart(padding, "0")}`;
};
  