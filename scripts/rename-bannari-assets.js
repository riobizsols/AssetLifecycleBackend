require('dotenv').config();

const { Client } = require('pg');

const PRODUCT_CATALOG = {
  'Laboratory Workstation': ['Lenovo', 'ThinkCentre M70q Gen 3'],
  'Network Switch': ['Cisco', 'CBS250-24T-4G'],
  'Multimedia Projector': ['Epson', 'EB-X49'],
  'Laser Printer': ['HP', 'LaserJet Pro M404dn'],
  'UPS System': ['APC', 'Smart-UPS SMT1000IC'],
  'Smart Display': ['BenQ', 'Board RE8604'],
  'CCTV Camera': ['Hikvision', 'DS-2CD2143G2-I'],
  'Cane Feeder': ['Fives Cail', 'CFC-1200'],
  'Mill Drive Motor': ['Siemens', '1LE1 355-4AA'],
  'Steam Boiler': ['Thermax', 'Revomax 10 TPH'],
  'Juice Clarifier': ['Fives Cail', 'RapiPol'],
  'Evaporator Pump': ['KSB', 'Etanorm 100-080-200'],
  'Sugar Centrifuge': ['BMA', 'K3300'],
  'Process Control Panel': ['Siemens', 'S7-1500'],
  'Fermentation Tank': ['GEA', 'VARITANK 50 m3'],
  'Distillation Column': ['Alfa Laval', 'PlatePak 300'],
  'Alcohol Storage Tank': ['CIMC', '100 m3 SS'],
  'Ethanol Transfer Pump': ['Grundfos', 'CR 32-4'],
  'Boiler Feed Pump': ['Sulzer', 'AHLSTAR APT'],
  'Process Analyzer': ['Anton Paar', 'Alcolyzer 3001'],
  'Safety Interlock Panel': ['Siemens', 'S7-1200'],
  'Wire Saw Machine': ['Breton', 'Wiresaw 800'],
  'Block Cutter': ['Pedrini', 'MTS 2000'],
  'Slab Polisher': ['Breton', 'Kappa 1500'],
  'Bridge Crane': ['Demag', 'DC-Com 5'],
  'Air Compressor': ['Atlas Copco', 'GA 30'],
  'Dust Collector': ['Donaldson Torit', 'DFO 3-6'],
  Forklift: ['Toyota', '8FG25'],
  'Warehouse Barcode Scanner': ['Zebra', 'DS3678'],
  'Pallet Forklift': ['Toyota', '8FG25'],
  'Shipping Label Printer': ['Zebra', 'ZT411'],
  'Office Workstation': ['Dell', 'OptiPlex 7010'],
  'Network Router': ['Cisco', 'ISR 4331'],
  'Industrial Weighing Scale': ['Avery Weigh-Tronix', 'ZM303'],
  'Laboratory Spectrometer': ['Thermo Scientific', 'GENESYS 180'],
  'Digital pH Meter': ['Mettler Toledo', 'SevenCompact S220'],
  'Moisture Analyzer': ['Sartorius', 'MA160'],
  'Precision Balance': ['Mettler Toledo', 'XPR205'],
  'Sample Refrigerator': ['Thermo Scientific', 'TSX Series'],
  'Calibration Kit': ['Fluke', '724'],
  'Maintenance Workstation': ['Dell', 'OptiPlex 7010'],
  'Welding Machine': ['Lincoln Electric', 'Power MIG 210 MP'],
  'Hydraulic Jack': ['Enerpac', 'RC-106'],
  'Portable Generator': ['Cummins', 'C20D5'],
  'Vibration Meter': ['Fluke', '805 FC'],
  'Tool Cabinet': ['Stanley', 'STST97595'],
  'Fire Alarm Panel': ['Honeywell NOTIFIER', 'NFS2-3030'],
  'Gas Detector': ['Dräger', 'X-am 2500'],
  'Emergency Shower': ['Haws', '8135'],
  'PPE Locker': ['Lista', '291-16'],
  'Safety Camera': ['Hikvision', 'DS-2CD2143G2-I'],
  'Environmental Meter': ['TSI', 'VelociCalc 9545'],
  'First Aid Cabinet': ['Cederroth', '2914'],
  'Desktop Workstation': ['Dell', 'OptiPlex 7010'],
  'Multifunction Printer': ['HP', 'LaserJet Pro MFP 4301fd'],
  'Document Scanner': ['Fujitsu', 'fi-8170'],
  'Video Conference Unit': ['Logitech', 'Rally Bar Mini'],
  'Access Control Panel': ['HID', 'VertX V1000'],
  Workstation: ['Dell', 'OptiPlex 7010'],
  'Barcode Scanner': ['Zebra', 'DS3678'],
  'Backup Power Unit': ['Cummins', 'C20D5'],
};

const trimText = (value, maxLength = 255) =>
  String(value || '').trim().slice(0, maxLength);

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const { rows: assets } = await client.query(`
      SELECT
        a.asset_id,
        a.prod_serv_id,
        at.text AS asset_type_name
      FROM "tblAssets" a
      JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE a.org_id IN (SELECT org_id FROM "tblOrgs" WHERE text ILIKE '%Bannari%')
      ORDER BY a.asset_id
    `);

    if (assets.length === 0) {
      throw new Error('No Bannari assets were found');
    }

    for (const asset of assets) {
      const catalog = PRODUCT_CATALOG[asset.asset_type_name];
      if (!catalog) {
        throw new Error(`Missing manufacturer/model catalog entry for ${asset.asset_type_name}`);
      }

      const [brand, model] = catalog;
      const displayName = trimText(`${brand} ${model}`, 50);
      const assetTypeDisplayName = trimText(
        `${asset.asset_type_name} - ${brand} ${model}`,
        50,
      );

      await client.query(
        `UPDATE "tblAssets"
         SET text = $1, description = $2
         WHERE asset_id = $3`,
        [assetTypeDisplayName, displayName, asset.asset_id],
      );

      if (asset.prod_serv_id) {
        await client.query(
          `UPDATE "tblProdServs"
           SET brand = $1, model = $2,
               description = $3
           WHERE prod_serv_id = $4`,
          [
            brand,
            model,
            `${asset.asset_type_name} supplied by ${brand}, model ${model}`,
            asset.prod_serv_id,
          ],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Renamed ${assets.length} Bannari assets with manufacturer and model names.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Bannari asset rename failed: ${error.message}`);
  process.exitCode = 1;
});
