const db = require("../config/db");
const { getDbFromContext } = require('./dbContext');
const { DEFAULT_ID_SEQUENCES } = require('../constants/setupDefaults');

// Helper to get database (tenant or default)
const getDb = () => getDbFromContext();

const defaultPrefixesFromSetup = Object.fromEntries(
    DEFAULT_ID_SEQUENCES.map((entry) => [entry.tableKey, entry.prefix])
);

/** tblIDSequences keys in DB vs keys used in generateCustomId() */
const SEQUENCE_KEY_ALIASES = {
    job_role_nav: 'jobrolenav',
    job_role: 'jobrole',
};

function resolveSequenceKey(tableKey) {
    return SEQUENCE_KEY_ALIASES[tableKey] || tableKey;
}

async function syncJobRoleNavSequence(dbPool) {
    try {
        const result = await dbPool.query(`
            SELECT COALESCE(MAX(
                CASE
                    WHEN job_role_nav_id ~ '^JRN[0-9]+$'
                    THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
                    ELSE 0
                END
            ), 0) AS max_seq
            FROM "tblJobRoleNav"
        `);
        const maxSeq = Number(result.rows?.[0]?.max_seq || 0);
        if (maxSeq <= 0) return;

        await dbPool.query(
            `
                INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
                VALUES ('jobrolenav', 'JRN', $1)
                ON CONFLICT (table_key) DO UPDATE
                SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
            `,
            [maxSeq],
        );
    } catch (error) {
        console.warn('[idGenerator] Could not sync jobrolenav sequence:', error.message);
    }
}

const defaultPrefixes = {
    ...defaultPrefixesFromSetup,
    'vendor_sla_rec': 'VSLAR',
    'atmf': 'ATMF',
    'wfs': 'WFS',
    'wfas': 'WFAS',
    'wfjr': 'WFJR',
    'amsbr': 'AMSBR',
    'prop': 'PROP',
    'atbrrc': 'ATBRRC',
    'atmcl': 'ATMCL',
    'aat_insp_checklist': 'AATIC',
    'job_role_nav': 'JRN',
    'job_role': 'JR',
    // Scrap workflow tables
    'wfscrapseq': 'WFSCQ',
    'wfscrap_h': 'WFSCH',
    'wfscrap_d': 'WFSCD',
    'asset_scrap': 'ASCP',
    // Existing scrap details table (legacy, used by reports/UI)
    'asset_scrap_det': 'ASD',
    'etc': 'ETC',
};

async function generateCustomIdWithDb(dbPool, tableKey, padLength = 3) {
    const sequenceKey = resolveSequenceKey(tableKey);
    console.log(`🔢 Generating ID for tableKey: ${tableKey} (sequence: ${sequenceKey})`);

    if (sequenceKey === 'jobrolenav') {
        await syncJobRoleNavSequence(dbPool);
    }
    
    let result = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [sequenceKey]
    );

    // Auto-create entry if it doesn't exist
    if (result.rows.length === 0) {
        console.log(`⚠️ Entry for ${sequenceKey} not found in tblIDSequences, creating it...`);

        const prefix = defaultPrefixes[tableKey] || defaultPrefixes[sequenceKey] || sequenceKey.toUpperCase().substring(0, 5);
        
        // Insert new entry with last_number = 0 (or seed from existing table if needed)
        let initialLastNumber = 0;
        if (sequenceKey === 'jobrolenav') {
            try {
                const r = await dbPool.query(`
                    SELECT COALESCE(MAX(
                        CASE
                            WHEN job_role_nav_id ~ '^JRN[0-9]+$'
                            THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
                            ELSE 0
                        END
                    ), 0) AS max_seq
                    FROM "tblJobRoleNav"
                `);
                initialLastNumber = Number(r.rows?.[0]?.max_seq || 0);
            } catch (e) {
                initialLastNumber = 0;
            }
        } else if (tableKey === 'asset_scrap_det') {
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
            [sequenceKey, prefix, initialLastNumber]
        );
        
        console.log(`✅ Created new ID sequence entry: ${sequenceKey} with prefix ${prefix}`);
        
        // Query again to get the newly created entry
        result = await dbPool.query(
        'SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = $1',
        [sequenceKey]
    );

    if (result.rows.length === 0) {
            throw new Error(`Failed to create ID sequence entry for ${sequenceKey}`);
        }
    }

    const { prefix, last_number } = result.rows[0];
    const next = last_number + 1;
    
    console.log(`🔢 Current last_number: ${last_number}, Next number: ${next}`);

    // Update the last number
    await dbPool.query(
        'UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = $2',
        [next, sequenceKey]
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
        'amsbr': 'tblAssetMaintSch_BR_Hist',
        'prop': 'tblProps',
        'atbrrc': 'tblATBRReasonCodes',
        'aat_insp_checklist': 'tblAATInspCheckList',
        'atmcl': 'tblATMaintCheckList',
        'IC': 'tblInspCheckList',
        'job_role_nav': 'tblJobRoleNav',
        'job_role': 'tblJobRoles',
        // Scrap workflow tables
        'wfscrapseq': 'tblWFScrapSeq',
        'wfscrap_h': 'tblWFScrap_H',
        'wfscrap_d': 'tblWFScrap_D',
        'asset_scrap': 'tblAssetScrap',
        'scrap_asset_hist': 'tblScrapAssetHist',
        // Existing scrap details table (legacy)
        'asset_scrap_det': 'tblAssetScrapDet',
        'etc': 'tblEmpTechCert'
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
            'amsbr': 'amsbr_id',
            'prop': 'prop_id',
            'atbrrc': 'atbrrc_id',
            'aat_insp_checklist': 'aatic_id',
            'atmcl': 'at_main_checklist_id',
            'IC': 'insp_check_id',
            'job_role_nav': 'job_role_nav_id',
            'job_role': 'job_role_id',
            // Scrap workflow tables
            'wfscrapseq': 'id',
            'wfscrap_h': 'id_d',
            'wfscrap_d': 'id',
            'asset_scrap': 'id',
            'scrap_asset_hist': 'scraphis_id',
            // Existing scrap details table (legacy)
              'asset_scrap_det': 'asd_id',
              'etc': 'etc_id'
        };

        const columnName = columnMap[tableKey];
        if (columnName) {
            try {
                const existingCheck = await dbPool.query(
                    `SELECT ${columnName} FROM "${targetTable}" WHERE ${columnName} = $1`,
                    [generatedId]
                );

                if (existingCheck.rows.length > 0) {
                    console.warn(`⚠️ Generated ID ${generatedId} already exists, generating new one...`);
                    return await generateCustomIdWithDb(dbPool, tableKey, padLength);
                }
            } catch (e) {
                if (e.code === '42P01') {
                    console.warn(
                        `[idGenerator] Table "${targetTable}" missing; skip duplicate check for ${tableKey}`
                    );
                } else {
                    throw e;
                }
            }
        }
    }

    console.log(`✅ Final ID generated: ${generatedId}`);
    // Return formatted ID, like DPT01 or USR001
    return generatedId;
}

exports.generateCustomId = async (tableKey, padLength = 3) => {
    return generateCustomIdWithDb(getDb(), tableKey, padLength);
};

exports.generateCustomIdForClient = async (client, tableKey, padLength = 3) => {
    return generateCustomIdWithDb(client, tableKey, padLength);
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
  