/**
 * Ensure every NGP (ORG003) and KMCH (ORG004) asset type in ngp_db has:
 *  - at least one product ProdServ (brand/model) linked to a product vendor
 *  - at least one service ProdServ linked to a service vendor
 *
 * Also upserts sensible vendor names and product_supply / service_supply flags
 * so Add Asset Product/Service Vendor dropdowns populate via /get-vendors?type=.
 *
 * Usage:
 *   node scripts/seed-ngp-kmch-asset-type-vendors.js
 *   node scripts/seed-ngp-kmch-asset-type-vendors.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const USER = 'USR001';

/** org → vendors to ensure (product + service capable) */
const ORG_VENDORS = {
  ORG003: {
    product: [
      {
        preferred_ids: ['V001'],
        vendor_name: 'NGP EduTech Supplies',
        company_name: 'NGP EduTech Supplies Pvt Ltd',
        city: 'Coimbatore',
      },
      {
        preferred_ids: ['V003'],
        vendor_name: 'NGP Lab Instruments',
        company_name: 'NGP Lab Instruments Pvt Ltd',
        city: 'Coimbatore',
      },
    ],
    service: [
      {
        preferred_ids: ['V007'],
        vendor_name: 'In-House Maintenance',
        company_name: 'NGP In-House Maintenance',
        city: 'Coimbatore',
      },
      {
        preferred_ids: [],
        vendor_name: 'NGP Campus Facility Services',
        company_name: 'NGP Campus Facility Services',
        city: 'Coimbatore',
      },
    ],
  },
  ORG004: {
    product: [
      {
        preferred_ids: ['V004'],
        vendor_name: 'KMCH MedSupply',
        company_name: 'KMCH MedSupply Pvt Ltd',
        city: 'Coimbatore',
      },
      {
        preferred_ids: ['V005'],
        vendor_name: 'KMCH BioEquip',
        company_name: 'KMCH BioEquip Systems',
        city: 'Coimbatore',
      },
      {
        preferred_ids: ['V006'],
        vendor_name: 'KMCH PharmaTech',
        company_name: 'KMCH PharmaTech Solutions',
        city: 'Coimbatore',
      },
    ],
    service: [
      {
        preferred_ids: ['V004'],
        vendor_name: 'KMCH MedSupply',
        company_name: 'KMCH MedSupply Pvt Ltd',
        city: 'Coimbatore',
      },
      {
        preferred_ids: ['V008'],
        vendor_name: 'KMCH Biomedical Services',
        company_name: 'KMCH Biomedical Services',
        city: 'Coimbatore',
      },
    ],
  },
};

/** Heuristic brand/model by asset-type name keywords */
function brandModelForType(typeName) {
  const t = String(typeName || '').toLowerCase();
  const rules = [
    [/laptop|tablet|toughbook|surface/, { brand: 'Dell', model: 'Latitude 5440' }],
    [/desktop|workstation|pc|prodesk|elitedesk|thinkcentre/, { brand: 'HP', model: 'EliteDesk 800' }],
    [/projector/, { brand: 'Epson', model: 'EB-L200SW' }],
    [/whiteboard|smart classroom|activpanel/, { brand: 'Promethean', model: 'ActivPanel 9' }],
    [/microscope/, { brand: 'Olympus', model: 'CX23' }],
    [/cnc/, { brand: 'Siemens', model: 'SINUMERIK Train' }],
    [/oscilloscope/, { brand: 'Keysight', model: 'DSOX1204G' }],
    [/pa system|amplifier/, { brand: 'Bosch', model: 'Plena 240W' }],
    [/science lab|balance|analytical/, { brand: 'Shimadzu', model: 'ATX224' }],
    [/tablet cart/, { brand: 'Bretford', model: 'Core36M' }],
    [/play equipment|sensory/, { brand: 'CommunityPlaythings', model: 'CP-KIT' }],
    [/printer|billing/, { brand: 'Epson', model: 'LQ-590II' }],
    [/network switch/, { brand: 'Cisco', model: 'C9200L' }],
    [/vernier|caliper/, { brand: 'Mitutoyo', model: '500-196-30' }],
    [/clicker/, { brand: 'TurningTech', model: 'QT2' }],
    [/doc camera/, { brand: 'IPEVO', model: 'V4K' }],
    [/cctv/, { brand: 'Hikvision', model: 'DS-2CD2143' }],
    [/water|dispensor|dispenser/, { brand: 'Voltas', model: 'Minicool' }],
    [/bus/, { brand: 'AshokLeyland', model: 'Sunshine' }],
    [/oxygen/, { brand: 'Philips', model: 'EverFlo' }],
    [/monitor|patient/, { brand: 'Philips', model: 'IntelliVue MX450' }],
    [/hospital bed/, { brand: 'Stryker', model: 'Secure II' }],
    [/wheelchair/, { brand: 'Karma', model: 'KM-2500' }],
    [/infusion/, { brand: 'BBraun', model: 'Infusomat Space' }],
    [/defibrillator/, { brand: 'Zoll', model: 'R Series' }],
    [/manikin|simulation/, { brand: 'Laerdal', model: 'NursingAnne' }],
    [/bp apparatus|pulse oximeter|goniometer|reflex/, { brand: 'Omron', model: 'HEM-7156' }],
    [/compression|capsule/, { brand: 'Cadmach', model: 'CMD4-16' }],
    [/ultrasound therapy/, { brand: 'EMS', model: 'Therasonic 450' }],
    [/treadmill/, { brand: 'TechnoGym', model: 'Run Artis' }],
    [/parallel bars/, { brand: 'Bailey', model: 'Parallel Bars' }],
    [/injection|wound care|micropipette/, { brand: '3BScientific', model: 'Trainer Kit' }],
    [/id card/, { brand: 'HID', model: 'FARGO DTC1250e' }],
    [/cup/, { brand: 'Generic', model: 'Steel Cup' }],
  ];
  for (const [re, bm] of rules) {
    if (re.test(t)) return bm;
  }
  return { brand: 'Generic', model: 'Standard' };
}

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function nextSeqId(prefix, maxId, seq) {
  const current =
    maxId && String(maxId).startsWith(prefix)
      ? parseInt(String(maxId).slice(prefix.length), 10)
      : 0;
  const width = Math.max(3, String(maxId || '').slice(prefix.length).length || 3);
  return `${prefix}${String(current + seq).padStart(width, '0')}`;
}

async function ensureVendor(client, orgId, spec, counters, now, dryRun) {
  // Prefer existing preferred id
  for (const id of spec.preferred_ids || []) {
    const found = await client.query(
      `SELECT vendor_id, vendor_name FROM "tblVendors" WHERE vendor_id = $1 AND org_id = $2`,
      [id, orgId],
    );
    if (found.rows[0]) {
      if (!dryRun) {
        await client.query(
          `UPDATE "tblVendors"
           SET vendor_name = $1,
               company_name = COALESCE($2, company_name),
               city = COALESCE($3, city),
               product_supply = true,
               service_supply = true,
               int_status = 1,
               changed_by = $4,
               changed_on = $5
           WHERE vendor_id = $6 AND org_id = $7`,
          [
            spec.vendor_name,
            spec.company_name,
            spec.city,
            USER,
            now,
            id,
            orgId,
          ],
        );
      }
      return id;
    }
  }

  // Match by name
  const byName = await client.query(
    `SELECT vendor_id FROM "tblVendors"
     WHERE org_id = $1 AND LOWER(TRIM(vendor_name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [orgId, spec.vendor_name],
  );
  if (byName.rows[0]) {
    const id = byName.rows[0].vendor_id;
    if (!dryRun) {
      await client.query(
        `UPDATE "tblVendors"
         SET product_supply = true, service_supply = true, int_status = 1,
             company_name = COALESCE($1, company_name),
             changed_by = $2, changed_on = $3
         WHERE vendor_id = $4`,
        [spec.company_name, USER, now, id],
      );
    }
    return id;
  }

  counters.vendorSeq += 1;
  const vendorId = nextSeqId('V', counters.maxVendor, counters.vendorSeq);
  if (!dryRun) {
    await client.query(
      `INSERT INTO "tblVendors" (
         vendor_id, org_id, vendor_name, int_status, company_name,
         address_line1, city, state, pincode, company_email,
         contact_person_name, contact_person_email, contact_person_number,
         product_supply, service_supply, spare_supply,
         created_by, created_on, changed_by, changed_on
       ) VALUES (
         $1,$2,$3,1,$4,
         $5,$6,$7,$8,$9,
         $10,$11,$12,
         true,true,false,
         $13,$14,$13,$14
       )`,
      [
        vendorId,
        orgId,
        spec.vendor_name,
        spec.company_name || spec.vendor_name,
        'Campus Road',
        spec.city || 'Coimbatore',
        'Tamil Nadu',
        '641014',
        `vendor.${vendorId.toLowerCase()}@example.com`,
        'Procurement Desk',
        `contact.${vendorId.toLowerCase()}@example.com`,
        '9000000000',
        USER,
        now,
      ],
    );
  }
  return vendorId;
}

async function ensureProdServ(client, { orgId, assetTypeId, psType, brand, model, description, counters, dryRun }) {
  const existing = await client.query(
    `SELECT prod_serv_id FROM "tblProdServs"
     WHERE org_id = $1 AND asset_type_id = $2 AND LOWER(TRIM(ps_type)) = $3
       AND (
         ($3 = 'service')
         OR (COALESCE(brand,'') = COALESCE($4,'') AND COALESCE(model,'') = COALESCE($5,''))
       )
     ORDER BY prod_serv_id
     LIMIT 1`,
    [orgId, assetTypeId, psType, brand, model],
  );
  if (existing.rows[0]) return existing.rows[0].prod_serv_id;

  // For product: reuse any product row for type if present
  if (psType === 'product') {
    const anyProd = await client.query(
      `SELECT prod_serv_id FROM "tblProdServs"
       WHERE org_id = $1 AND asset_type_id = $2 AND LOWER(TRIM(ps_type)) = 'product'
       ORDER BY prod_serv_id LIMIT 1`,
      [orgId, assetTypeId],
    );
    if (anyProd.rows[0]) return anyProd.rows[0].prod_serv_id;
  }

  counters.prodSeq += 1;
  const prodId = nextSeqId('PS', counters.maxProd, counters.prodSeq);
  if (!dryRun) {
    await client.query(
      `INSERT INTO "tblProdServs" (
         prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description
       ) VALUES ($1,$2,$3,$4,$5,1,$6,$7)`,
      [
        prodId,
        orgId,
        assetTypeId,
        psType === 'service' ? null : brand,
        psType === 'service' ? null : model,
        psType,
        description,
      ],
    );
  }
  return prodId;
}

async function ensureVendorLink(client, { orgId, prodServId, vendorId, counters, dryRun }) {
  const existing = await client.query(
    `SELECT ven_prod_serv_id FROM "tblVendorProdService"
     WHERE org_id = $1 AND prod_serv_id = $2 AND vendor_id = $3
     LIMIT 1`,
    [orgId, prodServId, vendorId],
  );
  if (existing.rows[0]) return existing.rows[0].ven_prod_serv_id;

  counters.vpsSeq += 1;
  const vpsId = nextSeqId('VPS', counters.maxVps, counters.vpsSeq);
  if (!dryRun) {
    await client.query(
      `INSERT INTO "tblVendorProdService" (ven_prod_serv_id, prod_serv_id, vendor_id, org_id)
       VALUES ($1,$2,$3,$4)`,
      [vpsId, prodServId, vendorId, orgId],
    );
  }
  return vpsId;
}

async function main() {
  const args = parseArgs(process.argv);
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false, max: 3 });
  const client = await pool.connect();
  const now = new Date();

  try {
    const caps = await client.query(`
      SELECT
        (SELECT MAX(vendor_id) FROM "tblVendors" WHERE vendor_id ~ '^V[0-9]+$') AS max_vendor,
        (SELECT MAX(prod_serv_id) FROM "tblProdServs" WHERE prod_serv_id ~ '^PS[0-9]+$') AS max_prod,
        (SELECT MAX(ven_prod_serv_id) FROM "tblVendorProdService"
           WHERE ven_prod_serv_id ~ '^(VPS|VPD|BNL)[0-9]+$') AS max_vps
    `);
    const counters = {
      maxVendor: caps.rows[0].max_vendor,
      maxProd: caps.rows[0].max_prod,
      maxVps: caps.rows[0].max_vps,
      vendorSeq: 0,
      prodSeq: 0,
      vpsSeq: 0,
    };

    // Prefer VPS prefix; if max is BNL/VPD keep numeric increment with VPS and pad 3
    if (!counters.maxVps || !/^VPS/i.test(counters.maxVps)) {
      const vpsOnly = await client.query(
        `SELECT MAX(ven_prod_serv_id) AS m FROM "tblVendorProdService" WHERE ven_prod_serv_id ~ '^VPS[0-9]+$'`,
      );
      counters.maxVps = vpsOnly.rows[0].m || 'VPS000';
    }

    console.log(
      `${args.dryRun ? '[DRY-RUN] ' : ''}Seeding product/service vendors for asset types in ${TENANT_DB}`,
    );
    console.log('ID caps', {
      vendor: counters.maxVendor,
      prod: counters.maxProd,
      vps: counters.maxVps,
    });

    if (!args.dryRun) await client.query('BEGIN');

    const summary = [];

    for (const [orgId, vendorCfg] of Object.entries(ORG_VENDORS)) {
      const productVendorIds = [];
      for (const spec of vendorCfg.product) {
        const id = await ensureVendor(client, orgId, spec, counters, now, args.dryRun);
        productVendorIds.push(id);
      }
      const serviceVendorIds = [];
      for (const spec of vendorCfg.service) {
        const id = await ensureVendor(client, orgId, spec, counters, now, args.dryRun);
        serviceVendorIds.push(id);
      }

      // Dedupe while preserving order
      const uniq = (arr) => [...new Set(arr)];
      const productVendors = uniq(productVendorIds);
      const serviceVendors = uniq(serviceVendorIds);

      console.log(`\n${orgId} product vendors: ${productVendors.join(', ')}`);
      console.log(`${orgId} service vendors: ${serviceVendors.join(', ')}`);

      const types = await client.query(
        `SELECT asset_type_id, text
         FROM "tblAssetTypes"
         WHERE org_id = $1 AND COALESCE(int_status,1) = 1
         ORDER BY asset_type_id`,
        [orgId],
      );

      let linked = 0;
      for (let i = 0; i < types.rows.length; i += 1) {
        const at = types.rows[i];
        const bm = brandModelForType(at.text);
        const productVendor = productVendors[i % productVendors.length];
        const serviceVendor = serviceVendors[i % serviceVendors.length];

        const productPs = await ensureProdServ(client, {
          orgId,
          assetTypeId: at.asset_type_id,
          psType: 'product',
          brand: bm.brand,
          model: bm.model,
          description: `${at.text} product catalog`,
          counters,
          dryRun: args.dryRun,
        });
        const servicePs = await ensureProdServ(client, {
          orgId,
          assetTypeId: at.asset_type_id,
          psType: 'service',
          brand: null,
          model: null,
          description: `${at.text} AMC / service`,
          counters,
          dryRun: args.dryRun,
        });

        await ensureVendorLink(client, {
          orgId,
          prodServId: productPs,
          vendorId: productVendor,
          counters,
          dryRun: args.dryRun,
        });
        await ensureVendorLink(client, {
          orgId,
          prodServId: servicePs,
          vendorId: serviceVendor,
          counters,
          dryRun: args.dryRun,
        });
        linked += 1;
      }

      summary.push({
        orgId,
        types: types.rows.length,
        linked,
        productVendors,
        serviceVendors,
      });
    }

    if (!args.dryRun) await client.query('COMMIT');

    console.log('\n=== Summary ===');
    for (const s of summary) {
      console.log(
        `${s.orgId}: ${s.linked}/${s.types} types linked | product=[${s.productVendors}] service=[${s.serviceVendors}]`,
      );
    }

    // Verification: /get-vendors style counts
    for (const orgId of Object.keys(ORG_VENDORS)) {
      const product = await client.query(
        `SELECT COUNT(DISTINCT v.vendor_id)::int AS n
         FROM "tblVendors" v
         INNER JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id AND vps.org_id = v.org_id
         INNER JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND LOWER(TRIM(ps.ps_type)) = 'product'
         WHERE v.org_id = $1 AND (v.int_status = 1 OR v.int_status IS NULL)`,
        [orgId],
      );
      const service = await client.query(
        `SELECT COUNT(DISTINCT v.vendor_id)::int AS n
         FROM "tblVendors" v
         INNER JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id AND vps.org_id = v.org_id
         INNER JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND LOWER(TRIM(ps.ps_type)) = 'service'
         WHERE v.org_id = $1 AND (v.int_status = 1 OR v.int_status IS NULL)`,
        [orgId],
      );
      const uncovered = await client.query(
        `SELECT at.asset_type_id, at.text
         FROM "tblAssetTypes" at
         WHERE at.org_id = $1 AND COALESCE(at.int_status,1)=1
           AND (
             NOT EXISTS (
               SELECT 1 FROM "tblProdServs" ps
               JOIN "tblVendorProdService" vps ON vps.prod_serv_id = ps.prod_serv_id
               WHERE ps.asset_type_id = at.asset_type_id AND ps.org_id = at.org_id
                 AND LOWER(TRIM(ps.ps_type)) = 'product'
             )
             OR NOT EXISTS (
               SELECT 1 FROM "tblProdServs" ps
               JOIN "tblVendorProdService" vps ON vps.prod_serv_id = ps.prod_serv_id
               WHERE ps.asset_type_id = at.asset_type_id AND ps.org_id = at.org_id
                 AND LOWER(TRIM(ps.ps_type)) = 'service'
             )
           )
         ORDER BY at.asset_type_id`,
        [orgId],
      );
      console.log(
        `${orgId} dropdown vendors → product=${product.rows[0].n} service=${service.rows[0].n}; uncovered types=${uncovered.rows.length}`,
      );
      if (uncovered.rows.length) {
        console.log(uncovered.rows.map((r) => `  ${r.asset_type_id} ${r.text}`).join('\n'));
      }
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('FAILED:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
