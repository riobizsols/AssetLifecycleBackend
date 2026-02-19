const db = require('./config/db');

(async () => {
  try {
    console.log('🔍 Checking Vendor Details for AT002\n');
    
    await db.connect();
    console.log('✅ Database connected\n');

    // 1. Check inspection frequency for AT002 (should be vendor)
    console.log('1️⃣ Checking AT002 Inspection Frequency:');
    const frequency = await db.query(`
      SELECT aif.aatif_id, aif.maintained_by, aif.freq, aif.uom, aif.emp_int_id,
             aaic.at_id
      FROM "tblAAT_Insp_Freq" aif
      INNER JOIN "tblAATInspCheckList" aaic ON aif.aatic_id = aaic.aatic_id
      WHERE aaic.at_id = 'AT002'
    `);
    
    if (frequency.rows.length > 0) {
      const freq = frequency.rows[0];
      console.log(`   ✅ Found: ${freq.aatif_id} - maintained_by: ${freq.maintained_by}`);
      console.log(`   Frequency: ${freq.freq} ${freq.uom}, Employee: ${freq.emp_int_id || 'NULL'}`);
    } else {
      console.log('   ❌ No frequency found for AT002');
    }

    // 2. Check specific workflow header
    console.log('\n2️⃣ Checking Workflow Header WFAIISH_401696_715:');
    const header = await db.query(`
      SELECT h.wfaiish_id, h.asset_id, h.vendor_id, h.emp_int_id,
             a.asset_type_id, a.text as asset_name,
             v.vendor_name, v.contact_person, v.email_id as vendor_email, v.phone_no as vendor_phone
      FROM "tblWFAATInspSch_H" h
      INNER JOIN "tblAssets" a ON h.asset_id = a.asset_id
      LEFT JOIN "tblVendors" v ON h.vendor_id = v.vendor_id
      WHERE h.wfaiish_id = 'WFAIISH_401696_715'
    `);
    
    if (header.rows.length > 0) {
      const h = header.rows[0];
      console.log(`   ✅ Found workflow: ${h.wfaiish_id}`);
      console.log(`   Asset: ${h.asset_id} (Type: ${h.asset_type_id})`);
      console.log(`   Vendor ID: ${h.vendor_id || 'NULL'}`);
      console.log(`   Employee ID: ${h.emp_int_id || 'NULL'}`);
      
      if (h.vendor_id) {
        console.log(`   Vendor Details: ${h.vendor_name || 'N/A'}`);
        console.log(`   Contact: ${h.contact_person || 'N/A'} (${h.vendor_email || 'N/A'})`);
      } else {
        console.log('   ❌ No vendor_id found in workflow header!');
      }
    } else {
      console.log('   ❌ Workflow header not found!');
    }

    // 3. Check available vendors
    console.log('\n3️⃣ Checking Available Vendors:');
    const vendors = await db.query(`
      SELECT vendor_id, vendor_name, contact_person, email_id, phone_no
      FROM "tblVendors" 
      WHERE org_id = 'ORG001'
      LIMIT 5
    `);
    
    console.log(`   Found ${vendors.rows.length} vendors:`);
    vendors.rows.forEach(vendor => {
      console.log(`   - ${vendor.vendor_id}: ${vendor.vendor_name} (${vendor.contact_person})`);
    });

    // 4. Check asset's original vendor assignment
    console.log('\n4️⃣ Checking Asset Vendor Assignment:');
    const assetVendor = await db.query(`
      SELECT asset_id, service_vendor_id, purchase_vendor_id
      FROM "tblAssets"
      WHERE asset_type_id = 'AT002'
    `);
    
    assetVendor.rows.forEach(asset => {
      console.log(`   Asset ${asset.asset_id}:`);
      console.log(`     Service Vendor: ${asset.service_vendor_id || 'NULL'}`);
      console.log(`     Purchase Vendor: ${asset.purchase_vendor_id || 'NULL'}`);
    });

    console.log('\n📋 VENDOR DETAILS REQUIREMENTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('For vendor details to show, you need:');
    console.log('1. 📊 maintained_by = "vendor" in tblAAT_Insp_Freq');
    console.log('2. 🏢 vendor_id in tblWFAATInspSch_H');
    console.log('3. 📇 Vendor record in tblVendors');
    console.log('4. 🎨 Frontend to display vendor information');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();