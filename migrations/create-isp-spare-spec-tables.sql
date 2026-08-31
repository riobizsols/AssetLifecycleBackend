-- Individual Spare Part spec tables (brand / model / properties / part numbers)
-- Source: spreadsheet (ISP brand-model-spec). Red column tblISPPartNumberSpec.spbm_id is excluded.
-- Column names: camelCase (quoted). Table names match the sheet.

BEGIN;

-- 1) tblISPBrand
CREATE TABLE IF NOT EXISTS "tblISPBrand" (
    "spbId"       VARCHAR(20)  PRIMARY KEY,
    "brandName"   VARCHAR(100) NOT NULL,
    int_status    INTEGER NOT NULL DEFAULT 1,
    org_id        VARCHAR(10) NOT NULL,
    branch_id     VARCHAR(10),
    created_by    VARCHAR(50),
    created_on    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by    VARCHAR(50),
    changed_on    TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_ispbrand_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_ispbrand_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ispbrand_org ON "tblISPBrand"(org_id);
CREATE INDEX IF NOT EXISTS idx_ispbrand_name ON "tblISPBrand"("brandName");

-- 2) tblISPModel
CREATE TABLE IF NOT EXISTS "tblISPModel" (
    "spbmId"      VARCHAR(20)  PRIMARY KEY,
    "spbId"       VARCHAR(20)  NOT NULL,
    "modelName"   VARCHAR(100) NOT NULL,
    int_status    INTEGER NOT NULL DEFAULT 1,
    org_id        VARCHAR(10) NOT NULL,
    branch_id     VARCHAR(10),
    created_by    VARCHAR(50),
    created_on    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by    VARCHAR(50),
    changed_on    TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_ispmodel_brand
        FOREIGN KEY ("spbId") REFERENCES "tblISPBrand"("spbId"),
    CONSTRAINT fk_ispmodel_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_ispmodel_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ispmodel_brand ON "tblISPModel"("spbId");
CREATE INDEX IF NOT EXISTS idx_ispmodel_org ON "tblISPModel"(org_id);

-- 3) tblISPPropDet  (sheet header typo: tblISPPropDEt)
CREATE TABLE IF NOT EXISTS "tblISPPropDet" (
    "sppdId"      VARCHAR(20)  PRIMARY KEY,
    "spbmId"      VARCHAR(20)  NOT NULL,
    "propId"      VARCHAR(20)  NOT NULL,
    "propName"    VARCHAR(100) NOT NULL,
    int_status    INTEGER NOT NULL DEFAULT 1,
    org_id        VARCHAR(10) NOT NULL,
    branch_id     VARCHAR(10),
    created_by    VARCHAR(50),
    created_on    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by    VARCHAR(50),
    changed_on    TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_isppropdet_model
        FOREIGN KEY ("spbmId") REFERENCES "tblISPModel"("spbmId"),
    CONSTRAINT fk_isppropdet_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_isppropdet_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
);

CREATE INDEX IF NOT EXISTS idx_isppropdet_model ON "tblISPPropDet"("spbmId");
CREATE INDEX IF NOT EXISTS idx_isppropdet_prop ON "tblISPPropDet"("propId");

-- 4) tblISPPartNumberSpec  — red column spbm_id omitted (model is via sppdId → tblISPPropDet)
CREATE TABLE IF NOT EXISTS "tblISPPartNumberSpec" (
    sppns_id        VARCHAR(20)  PRIMARY KEY,
    sppart_ext_id    VARCHAR(50),
    sppd_id         VARCHAR(20)  NOT NULL,
    aplv_id         VARCHAR(100),
    int_status       INTEGER NOT NULL DEFAULT 1,
    org_id           VARCHAR(10) NOT NULL,
    branch_id        VARCHAR(10),
    created_by       VARCHAR(50),
    created_on       TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by       VARCHAR(50),
    changed_on       TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_isppartnumberspec_prop
        FOREIGN KEY (sppd_id) REFERENCES "tblISPPropDet"("sppdId"),
    CONSTRAINT fk_isppartnumberspec_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_isppartnumberspec_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
);

CREATE INDEX IF NOT EXISTS idx_isppartnumberspec_sppd ON "tblISPPartNumberSpec"(sppd_id);
CREATE INDEX IF NOT EXISTS idx_isppartnumberspec_ext ON "tblISPPartNumberSpec"(sppart_ext_id);

-- 5) tblISPModCat
CREATE TABLE IF NOT EXISTS "tblISPModCat" (
    "spbmcId"     VARCHAR(20) PRIMARY KEY,
    "spbmId"      VARCHAR(20) NOT NULL,
    "spcId"       VARCHAR(20) NOT NULL,
    int_status    INTEGER NOT NULL DEFAULT 1,
    org_id        VARCHAR(10) NOT NULL,
    branch_id     VARCHAR(10),
    created_by    VARCHAR(50),
    created_on    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by    VARCHAR(50),
    changed_on    TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_ispmodcat_model
        FOREIGN KEY ("spbmId") REFERENCES "tblISPModel"("spbmId"),
    CONSTRAINT fk_ispmodcat_category
        FOREIGN KEY ("spcId") REFERENCES "tblSPCategory"(spc_id),
    CONSTRAINT fk_ispmodcat_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_ispmodcat_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id),
    CONSTRAINT uq_ispmodcat_model_cat_org
        UNIQUE ("spbmId", "spcId", org_id)
);

CREATE INDEX IF NOT EXISTS idx_ispmodcat_model ON "tblISPModCat"("spbmId");
CREATE INDEX IF NOT EXISTS idx_ispmodcat_spc ON "tblISPModCat"("spcId");

-- 6) tblISPPNVPNMap
CREATE TABLE IF NOT EXISTS "tblISPPNVPNMap" (
    "spvpnId"             VARCHAR(20) PRIMARY KEY,
    sppns_id             VARCHAR(20) NOT NULL,
    "vendorPartNumber"    VARCHAR(50),
    "vendorId"            VARCHAR(50) NOT NULL,
    int_status            INTEGER NOT NULL DEFAULT 1,
    org_id                VARCHAR(10) NOT NULL,
    branch_id             VARCHAR(10),
    created_by            VARCHAR(50),
    created_on            TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    changed_by            VARCHAR(50),
    changed_on            TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT fk_isppnvpnmap_spec
        FOREIGN KEY (sppns_id) REFERENCES "tblISPPartNumberSpec"(sppns_id),
    CONSTRAINT fk_isppnvpnmap_vendor
        FOREIGN KEY ("vendorId") REFERENCES "tblVendors"(vendor_id),
    CONSTRAINT fk_isppnvpnmap_org
        FOREIGN KEY (org_id) REFERENCES "tblOrgs"(org_id),
    CONSTRAINT fk_isppnvpnmap_branch
        FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
);

CREATE INDEX IF NOT EXISTS idx_isppnvpnmap_spec ON "tblISPPNVPNMap"(sppns_id);
CREATE INDEX IF NOT EXISTS idx_isppnvpnmap_vendor ON "tblISPPNVPNMap"("vendorId");

COMMIT;
