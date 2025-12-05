-- ============================================================
-- CHECK MAINTENANCE RECORDS - Run this in DBeaver
-- ============================================================

-- 1. Check recent header records
SELECT 
  wfamsh_id,
  at_main_freq_id,
  maint_type_id,
  asset_id,
  group_id,
  vendor_id,
  pl_sch_date,
  act_sch_date,
  status,
  org_id,
  created_by,
  created_on,
  changed_by,
  changed_on
FROM "tblWFAssetMaintSch_H"
ORDER BY created_on DESC
LIMIT 20;

-- 2. Check detail records for recent headers
SELECT 
  wfamsd_id,
  wfamsh_id,
  job_role_id,
  user_id,
  dept_id,
  sequence,
  status,
  notes,
  org_id,
  created_by,
  created_on
FROM "tblWFAssetMaintSch_D"
WHERE wfamsh_id IN (
  SELECT wfamsh_id 
  FROM "tblWFAssetMaintSch_H" 
  ORDER BY created_on DESC 
  LIMIT 20
)
ORDER BY created_on DESC;

-- 3. Count records created today
SELECT 
  'Header' as type,
  COUNT(*) as count
FROM "tblWFAssetMaintSch_H"
WHERE DATE(created_on) = CURRENT_DATE
UNION ALL
SELECT 
  'Detail' as type,
  COUNT(*) as count
FROM "tblWFAssetMaintSch_D"
WHERE DATE(created_on) = CURRENT_DATE;

-- 4. Check for headers without details (orphaned)
SELECT 
  h.wfamsh_id,
  h.asset_id,
  h.status,
  h.created_on,
  COUNT(d.wfamsd_id) as detail_count
FROM "tblWFAssetMaintSch_H" h
LEFT JOIN "tblWFAssetMaintSch_D" d ON h.wfamsh_id = d.wfamsh_id
WHERE h.created_on >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY h.wfamsh_id, h.asset_id, h.status, h.created_on
HAVING COUNT(d.wfamsd_id) = 0
ORDER BY h.created_on DESC;

-- 5. Summary statistics
SELECT 
  (SELECT COUNT(*) FROM "tblWFAssetMaintSch_H") as total_headers,
  (SELECT COUNT(*) FROM "tblWFAssetMaintSch_D") as total_details,
  (SELECT COUNT(*) FROM "tblWFAssetMaintSch_H" WHERE DATE(created_on) = CURRENT_DATE) as headers_today,
  (SELECT COUNT(*) FROM "tblWFAssetMaintSch_D" WHERE DATE(created_on) = CURRENT_DATE) as details_today,
  (SELECT MAX(created_on) FROM "tblWFAssetMaintSch_H") as latest_header,
  (SELECT MAX(created_on) FROM "tblWFAssetMaintSch_D") as latest_detail;

