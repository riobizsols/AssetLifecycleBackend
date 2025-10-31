ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS insurer TEXT;
ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS insured_value NUMERIC(18,2);
ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS insurance_start_date DATE;
ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS insurance_end_date DATE;
ALTER TABLE "tblAssets" ADD COLUMN IF NOT EXISTS comprehensive_insurance TEXT;
