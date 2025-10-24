const db = require('../config/db');

// Generate SSH ID (Scrap Sales Header ID)
const generateSshId = async () => {
    const query = `
        SELECT COALESCE(MAX(CAST(SUBSTRING(ssh_id FROM 4) AS INTEGER)), 0) + 1 as next_seq
        FROM "tblScrapSales_H"
        WHERE ssh_id LIKE 'SSH%'
    `;
    
    const result = await db.query(query);
    const nextSeq = result.rows[0].next_seq;
    const sshId = `SSH${nextSeq.toString().padStart(4, '0')}`;
    
    console.log(`🔢 Generated SSH ID: ${sshId}`);
    return sshId;
};

// Generate SSD ID (Scrap Sales Detail ID)
const generateSsdId = async () => {
    const query = `
        SELECT COALESCE(MAX(CAST(SUBSTRING(ssd_id FROM 4) AS INTEGER)), 0) + 1 as next_seq
        FROM "tblScrapSales_D"
        WHERE ssd_id LIKE 'SSD%'
    `;
    
    const result = await db.query(query);
    const nextSeq = result.rows[0].next_seq;
    const ssdId = `SSD${nextSeq.toString().padStart(4, '0')}`;
    
    console.log(`🔢 Generated SSD ID: ${ssdId}`);
    return ssdId;
};

// Create scrap sales header
const createScrapSalesHeader = async (client, headerData) => {
    const {
        org_id,
        text,
        total_sale_value,
        buyer_name,
        buyer_company,
        buyer_phone,
        created_by,
        sale_date,
        collection_date,
        invoice_no,
        po_no
    } = headerData;

    const ssh_id = await generateSshId();

    const query = `
        INSERT INTO "tblScrapSales_H" (
            ssh_id,
            org_id,
            text,
            total_sale_value,
            buyer_name,
            buyer_company,
            buyer_phone,
            created_by,
            created_on,
            changed_by,
            changed_on,
            sale_date,
            collection_date,
            invoice_no,
            po_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $8, CURRENT_DATE, $9, $10, $11, $12)
        RETURNING *
    `;

    // Ensure all values are properly formatted (not arrays)
    const values = [
        ssh_id,
        org_id,
        text,
        total_sale_value,
        buyer_name,
        buyer_company,
        buyer_phone,
        created_by,
        sale_date,
        collection_date,
        invoice_no,
        po_no
    ];

    // Handle total_sale_value - check if column is ARRAY or NUMERIC
    const sanitizedValues = values.map((value, index) => {
        // total_sale_value is at index 3 (4th parameter)
        if (index === 3 && typeof value === 'number') {
            // For now, convert to array to handle ARRAY column type
            // This can be removed once the table structure is fixed
            console.log(`🔧 Converting total_sale_value to array: ${value} -> [${value}]`);
            return [value]; // Convert to array for ARRAY column
        }
        if (Array.isArray(value)) {
            console.warn(`⚠️ Warning: Value at index ${index} is an array:`, value);
            return value[0] || null; // Take first element or null
        }
        return value;
    });

    // Debug: Log values to check for arrays
    console.log('🔍 Header values:', sanitizedValues.map((v, i) => `${i}: ${typeof v} = ${JSON.stringify(v)}`));

    return await client.query(query, sanitizedValues);
};

// Create scrap sales detail records
const createScrapSalesDetails = async (client, ssh_id, scrapAssets) => {
    const detailResults = [];
    
    // Get the base SSD ID first
    const baseSsdId = await generateSsdId();
    const baseNumber = parseInt(baseSsdId.substring(3));
    
    console.log(`🔢 Base SSD ID: ${baseSsdId} (number: ${baseNumber})`);
    console.log(`📋 Creating ${scrapAssets.length} detail records...`);
    
    for (let i = 0; i < scrapAssets.length; i++) {
        const asset = scrapAssets[i];
        const ssd_id = `SSD${(baseNumber + i).toString().padStart(4, '0')}`;
        
        console.log(`🔢 Generated SSD ID for asset ${i + 1}: ${ssd_id}`);
        
        const query = `
            INSERT INTO "tblScrapSales_D" (
                ssd_id,
                ssh_id,
                asd_id,
                sale_value
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const values = [
            ssd_id,
            ssh_id,
            asset.asd_id,
            asset.sale_value
        ];

        try {
            const result = await client.query(query, values);
            detailResults.push(result);
            console.log(`✅ Successfully inserted detail record ${i + 1}: ${ssd_id}`);
        } catch (error) {
            console.error(`❌ Error inserting detail record ${i + 1}:`, error.message);
            throw error;
        }
    }

    console.log(`✅ All ${detailResults.length} detail records created successfully`);
    return detailResults;
};

// Create complete scrap sale (header + details)
const createScrapSale = async (saleData) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // Create header
        const headerResult = await createScrapSalesHeader(client, saleData.header);
        const ssh_id = headerResult.rows[0].ssh_id;

        // Create details
        const detailResults = await createScrapSalesDetails(client, ssh_id, saleData.scrapAssets);

        await client.query('COMMIT');

        return {
            header: headerResult.rows[0],
            details: detailResults.map(result => result.rows[0])
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Get all scrap sales
const getAllScrapSales = async () => {
    const query = `
        SELECT 
            ssh.ssh_id,
            ssh.org_id,
            ssh.text,
            ssh.total_sale_value,
            ssh.buyer_name,
            ssh.buyer_company,
            ssh.buyer_phone,
            ssh.created_by,
            ssh.created_on,
            ssh.sale_date,
            ssh.collection_date,
            ssh.invoice_no,
            ssh.po_no,
            COUNT(ssd.ssd_id) as total_assets
        FROM "tblScrapSales_H" ssh
        LEFT JOIN "tblScrapSales_D" ssd ON ssh.ssh_id = ssd.ssh_id
        GROUP BY ssh.ssh_id, ssh.org_id, ssh.text, ssh.total_sale_value, 
                 ssh.buyer_name, ssh.buyer_company, ssh.buyer_phone, 
                 ssh.created_by, ssh.created_on, ssh.sale_date, 
                 ssh.collection_date, ssh.invoice_no, ssh.po_no
        ORDER BY ssh.created_on DESC
    `;
    
    return await db.query(query);
};

// Get scrap sale by ID with details
const getScrapSaleById = async (ssh_id) => {
    // Get header
    const headerQuery = `
        SELECT * FROM "tblScrapSales_H" WHERE ssh_id = $1
    `;
    const headerResult = await db.query(headerQuery, [ssh_id]);

    if (headerResult.rows.length === 0) {
        return null;
    }

    // Get details with asset information
    const detailsQuery = `
        SELECT 
            ssd.ssd_id,
            ssd.ssh_id,
            ssd.asd_id,
            ssd.sale_value,
            asd.asset_id,
            a.text as asset_name,
            a.serial_number,
            at.text as asset_type_name
        FROM "tblScrapSales_D" ssd
        LEFT JOIN "tblAssetScrapDet" asd ON ssd.asd_id = asd.asd_id
        LEFT JOIN "tblAssets" a ON asd.asset_id = a.asset_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE ssd.ssh_id = $1
        ORDER BY ssd.ssd_id
    `;
    const detailsResult = await db.query(detailsQuery, [ssh_id]);

    return {
        header: headerResult.rows[0],
        details: detailsResult.rows
    };
};

// Validate scrap assets exist and are not already sold
const validateScrapAssets = async (asdIds) => {
    // Create placeholders for the IN clause
    const placeholders = asdIds.map((_, index) => `$${index + 1}`).join(',');
    
    const query = `
        SELECT 
            asd.asd_id,
            asd.asset_id,
            a.text as asset_name,
            a.serial_number,
            CASE 
                WHEN ssd.asd_id IS NOT NULL THEN true 
                ELSE false 
            END as already_sold
        FROM "tblAssetScrapDet" asd
        LEFT JOIN "tblAssets" a ON asd.asset_id = a.asset_id
        LEFT JOIN "tblScrapSales_D" ssd ON asd.asd_id = ssd.asd_id
        WHERE asd.asd_id IN (${placeholders})
    `;
    
    return await db.query(query, asdIds);
};

// Delete scrap sale (header, details, and documents)
const deleteScrapSale = async (ssh_id) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');

        // First, get the details to know which assets were sold
        const detailsQuery = `
            SELECT asd_id, ssd_id FROM "tblScrapSales_D" WHERE ssh_id = $1
        `;
        const detailsResult = await client.query(detailsQuery, [ssh_id]);
        
        // Delete documents first (foreign key constraint)
        const deleteDocsQuery = `
            DELETE FROM "tblScrapSalesDocs" WHERE ssh_id = $1
        `;
        await client.query(deleteDocsQuery, [ssh_id]);
        
        // Delete details
        const deleteDetailsQuery = `
            DELETE FROM "tblScrapSales_D" WHERE ssh_id = $1
        `;
        const detailsDeleteResult = await client.query(deleteDetailsQuery, [ssh_id]);
        
        // Delete header
        const deleteHeaderQuery = `
            DELETE FROM "tblScrapSales_H" WHERE ssh_id = $1
        `;
        const headerDeleteResult = await client.query(deleteHeaderQuery, [ssh_id]);
        
        await client.query('COMMIT');

        return {
            headerDeleted: headerDeleteResult.rowCount,
            detailsDeleted: detailsDeleteResult.rowCount,
            assetsAffected: detailsResult.rows.map(row => row.asd_id)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createScrapSale,
    createScrapSalesHeader,
    createScrapSalesDetails,
    getAllScrapSales,
    getScrapSaleById,
    validateScrapAssets,
    generateSshId,
    generateSsdId,
    deleteScrapSale
};
