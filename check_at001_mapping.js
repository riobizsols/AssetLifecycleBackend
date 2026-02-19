const pool = require('./config/db');
require('dotenv').config();

async function check() {

    try {
        console.log('Checking asset types...');
        const assetTypes = await pool.query("SELECT asset_type_id, asset_type_name FROM \"tblAssetType\" WHERE asset_type_id = 'AT001'");
        console.log('Asset Type AT001:', assetTypes.rows);

        if (assetTypes.rows.length === 0) {
            console.log('Asset Type AT001 not found.');
        }

        console.log('\nChecking technical certificates...');
        const certificates = await pool.query("SELECT tc_id, certificate_name FROM \"tblTechCert\"");
        console.log('Certificates:', certificates.rows);

        console.log('\nChecking inspection certificate mappings (tblATInspCert)...');
        // Check if table exists first
        const tableCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tblATInspCert')");
        if (tableCheck.rows[0].exists) {
            const inspMappings = await pool.query("SELECT * FROM \"tblATInspCert\" WHERE asset_type_id = 'AT001' OR assettype_id = 'AT001'");
            console.log('Inspection Mappings for AT001:', inspMappings.rows);
        } else {
            console.log('tblATInspCert does not exist.');
        }

        console.log('\nChecking maintenance certificate mappings (tblATMaintCert)...');
        const maintTableCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tblATMaintCert')");
        if (maintTableCheck.rows[0].exists) {
            const maintMappings = await pool.query("SELECT * FROM \"tblATMaintCert\" WHERE asset_type_id = 'AT001' OR assettype_id = 'AT001'");
            console.log('Maintenance Mappings for AT001:', maintMappings.rows);
        } else {
            console.log('tblATMaintCert does not exist.');
        }

        console.log('\nChecking employees...');
        const employees = await pool.query("SELECT emp_int_id, employee_id, full_name, name FROM \"tblEmployees\" LIMIT 5");
        console.log('Sample Employees:', employees.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

check();
