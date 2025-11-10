--
-- PostgreSQL database dump
--

\restrict pXPRz1syk4nspBaGOjL0Una7RnNRMUa5okrig1xOdcvkQs3yMTTKSGB3iRWlNb6

-- Dumped from database version 17.4 (Ubuntu 17.4-1.pgdg22.04+2)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: enum_assets_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enum_assets_status AS ENUM (
    'active',
    'inactive',
    'maintenance',
    'retired'
);


ALTER TYPE public.enum_assets_status OWNER TO postgres;

--
-- Name: update_technical_log_config_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_technical_log_config_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_technical_log_config_timestamp() OWNER TO postgres;

--
-- Name: update_updated_on_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_on_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_on_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: tblATBRReasonCodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblATBRReasonCodes" (
    atbrrc_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL,
    instatus character varying(1) NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblATBRReasonCodes" OWNER TO postgres;

--
-- Name: tblATDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblATDocs" (
    atd_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    dto_id character varying(20) NOT NULL,
    doc_type_name character varying(50),
    doc_path character varying(200) NOT NULL,
    is_archived boolean,
    archived_path character varying(200),
    org_id character varying(10) NOT NULL
);


ALTER TABLE public."tblATDocs" OWNER TO postgres;

--
-- Name: tblATMaintCheckList; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblATMaintCheckList" (
    at_main_checklist_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL,
    at_main_freq_id character varying(20) NOT NULL
);


ALTER TABLE public."tblATMaintCheckList" OWNER TO postgres;

--
-- Name: tblATMaintFreq; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblATMaintFreq" (
    at_main_freq_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    frequency integer NOT NULL,
    uom character varying(15) NOT NULL,
    text character varying(50) NOT NULL,
    maintained_by character varying(20) NOT NULL,
    maint_type_id character varying(20) NOT NULL,
    int_status integer NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblATMaintFreq" OWNER TO postgres;

--
-- Name: tblApps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblApps" (
    app_id character varying(50) NOT NULL,
    text character varying(50) NOT NULL,
    int_status boolean NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblApps" OWNER TO postgres;

--
-- Name: tblAssetAssignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetAssignments" (
    asset_assign_id character varying(20) NOT NULL,
    dept_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    employee_int_id character varying(20),
    action character varying(2) NOT NULL,
    action_on timestamp without time zone NOT NULL,
    action_by character varying(20) NOT NULL,
    latest_assignment_flag boolean NOT NULL
);


ALTER TABLE public."tblAssetAssignments" OWNER TO postgres;

--
-- Name: tblAssetBRDet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetBRDet" (
    abr_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    atbrrc_id character varying(20) NOT NULL,
    reported_by character varying(20) NOT NULL,
    is_create_maintenance boolean NOT NULL,
    status character varying(2) NOT NULL,
    description character varying(50) NOT NULL,
    org_id character varying(20) NOT NULL,
    decision_code character varying NOT NULL,
    created_on timestamp without time zone
);


ALTER TABLE public."tblAssetBRDet" OWNER TO postgres;

--
-- Name: tblAssetDepHist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetDepHist" (
    depreciation_id character varying NOT NULL,
    asset_id character varying NOT NULL,
    org_id character varying NOT NULL,
    depreciation_amount numeric(15,2) NOT NULL,
    book_value_before numeric(15,2) NOT NULL,
    book_value_after numeric(15,2) NOT NULL,
    depreciation_rate numeric(5,2) NOT NULL,
    useful_life_years integer NOT NULL,
    created_by character varying NOT NULL,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblAssetDepHist" OWNER TO postgres;

--
-- Name: tblAssetDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetDocs" (
    a_d_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    dto_id character varying(50) NOT NULL,
    doc_type_name character varying(50),
    doc_path character varying(200) NOT NULL,
    is_archived boolean,
    archived_path character varying(200),
    org_id character varying(10) NOT NULL
);


ALTER TABLE public."tblAssetDocs" OWNER TO postgres;

--
-- Name: tblAssetGroupDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetGroupDocs" (
    agd_id character varying(20) NOT NULL,
    asset_group_id character varying(20) NOT NULL,
    dto_id character varying(20) NOT NULL,
    doc_type_name character varying(50),
    doc_path character varying(200) NOT NULL,
    is_archived boolean,
    archived_path character varying(200),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAssetGroupDocs" OWNER TO postgres;

--
-- Name: tblAssetGroup_D; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetGroup_D" (
    assetgroup_d_id character varying(20) NOT NULL,
    assetgroup_h_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAssetGroup_D" OWNER TO postgres;

--
-- Name: tblAssetGroup_H; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetGroup_H" (
    assetgroup_h_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    text character varying(100),
    created_by character varying(50),
    created_on date,
    changed_by character varying(50),
    changed_on date,
    branch_code character varying(10)
);


ALTER TABLE public."tblAssetGroup_H" OWNER TO postgres;

--
-- Name: tblAssetMaintDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetMaintDocs" (
    amd_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    dto_id character varying(10) NOT NULL,
    doc_type_name character varying(50),
    doc_path character varying(200) NOT NULL,
    is_archived boolean,
    archived_path character varying(200),
    org_id character varying(10) NOT NULL
);


ALTER TABLE public."tblAssetMaintDocs" OWNER TO postgres;

--
-- Name: tblAssetMaintSch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetMaintSch" (
    ams_id character varying(20) NOT NULL,
    wfamsh_id character varying(20),
    asset_id character varying(20) NOT NULL,
    maint_type_id character varying(20),
    vendor_id character varying(20) NOT NULL,
    at_main_freq_id character varying(20),
    maintained_by character varying(20),
    notes character varying(100),
    status character varying(2) NOT NULL,
    act_maint_st_date timestamp without time zone NOT NULL,
    act_main_end_date timestamp without time zone,
    po_number character varying(30),
    invoice character varying(30),
    technician_name character varying(50),
    technician_email character varying(50),
    technician_phno character varying(20),
    created_by character varying(20) NOT NULL,
    created_on time without time zone NOT NULL,
    changed_by character varying(20),
    changed_on timestamp without time zone,
    org_id character varying(20) NOT NULL,
    wo_id character varying,
    branch_code character varying(10),
    cost numeric(12,2)
);


ALTER TABLE public."tblAssetMaintSch" OWNER TO postgres;

--
-- Name: COLUMN "tblAssetMaintSch".cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblAssetMaintSch".cost IS 'Maintenance cost in decimal format';


--
-- Name: tblAssetPropListValues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetPropListValues" (
    aplv_id character varying(20) NOT NULL,
    prop_id character varying(20) NOT NULL,
    value character varying(20) NOT NULL,
    int_status integer NOT NULL,
    org_id character varying(20)
);


ALTER TABLE public."tblAssetPropListValues" OWNER TO postgres;

--
-- Name: tblAssetPropValues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetPropValues" (
    apv_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    asset_type_prop_id character varying(20) NOT NULL,
    value character varying(50) NOT NULL
);


ALTER TABLE public."tblAssetPropValues" OWNER TO postgres;

--
-- Name: tblAssetScrapDet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetScrapDet" (
    asd_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    scrapped_date timestamp without time zone NOT NULL,
    scrapped_by character varying(20) NOT NULL,
    location character varying(50),
    notes character varying(100),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAssetScrapDet" OWNER TO postgres;

--
-- Name: tblAssetTypeProps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetTypeProps" (
    asset_type_prop_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    prop_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAssetTypeProps" OWNER TO postgres;

--
-- Name: tblAssetTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetTypes" (
    org_id character varying(10) NOT NULL,
    asset_type_id character varying(10) NOT NULL,
    int_status integer NOT NULL,
    assignment_type character varying(10) NOT NULL,
    inspection_required boolean NOT NULL,
    group_required boolean NOT NULL,
    created_by character varying(10) NOT NULL,
    created_on date NOT NULL,
    changed_by character varying(10) NOT NULL,
    changed_on date NOT NULL,
    text character varying(50) NOT NULL,
    is_child boolean,
    parent_asset_type_id character varying(20),
    maint_required boolean NOT NULL,
    maint_type_id character varying(20),
    maint_lead_type character varying(20),
    serial_num_format integer,
    last_gen_seq_no bigint,
    depreciation_type character varying(2)
);


ALTER TABLE public."tblAssetTypes" OWNER TO postgres;

--
-- Name: COLUMN "tblAssetTypes".last_gen_seq_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblAssetTypes".last_gen_seq_no IS 'Last generated sequence number for serial number generation per asset type';


--
-- Name: tblAssetUsageReg; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssetUsageReg" (
    aug_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    usage_counter integer DEFAULT 0,
    created_by character varying(20),
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblAssetUsageReg" OWNER TO postgres;

--
-- Name: tblAssets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAssets" (
    asset_type_id character varying(20),
    asset_id character varying(20) NOT NULL,
    text character varying(50),
    serial_number character varying(15),
    description character varying(100),
    branch_id character varying(20),
    purchase_vendor_id character varying(20) NOT NULL,
    prod_serv_id character varying(20),
    maintsch_id character varying(20),
    purchased_cost character varying(10),
    purchased_on timestamp without time zone,
    purchased_by character varying(20),
    current_status character varying,
    warranty_period character varying,
    parent_asset_id character varying(20),
    group_id character varying,
    org_id character varying(20) NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying(20) NOT NULL,
    changed_on timestamp without time zone NOT NULL,
    service_vendor_id character varying(20),
    expiry_date timestamp without time zone,
    current_book_value real,
    salvage_value real,
    accumulated_depreciation real,
    useful_life_years integer,
    last_depreciation_calc_date timestamp without time zone,
    invoice_no character varying(20),
    commissioned_date timestamp without time zone,
    depreciation_start_date timestamp without time zone,
    project_code character varying(20),
    grant_code character varying(20),
    insurance_policy_no character varying(20),
    gl_account_code character varying(20),
    cost_center_code character varying(20),
    depreciation_rate real DEFAULT 0.00,
    location text,
    insurer text,
    insured_value numeric(18,2),
    insurance_start_date date,
    insurance_end_date date,
    comprehensive_insurance text
);


ALTER TABLE public."tblAssets" OWNER TO postgres;

--
-- Name: tblAuditLogConfig; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAuditLogConfig" (
    alc_id character varying(20) NOT NULL,
    app_id character varying(20) NOT NULL,
    event_id character varying(20) NOT NULL,
    enabled boolean NOT NULL,
    reporting_required boolean NOT NULL,
    reporting_email character varying(50) NOT NULL,
    description character varying(50),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAuditLogConfig" OWNER TO postgres;

--
-- Name: tblAuditLogs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblAuditLogs" (
    al_id character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    app_id character varying(20) NOT NULL,
    event_id character varying(20) NOT NULL,
    text character varying(100),
    created_on timestamp without time zone NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblAuditLogs" OWNER TO postgres;

--
-- Name: tblBranches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblBranches" (
    branch_id character varying(10) NOT NULL,
    org_id character varying(10) NOT NULL,
    int_status integer DEFAULT 1 NOT NULL,
    text character varying(100) NOT NULL,
    city character varying(50) NOT NULL,
    branch_code character varying(10) NOT NULL,
    created_by character varying(50) NOT NULL,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    changed_by character varying(50),
    changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."tblBranches" OWNER TO postgres;

--
-- Name: tblDepartments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblDepartments" (
    org_id character varying(10) NOT NULL,
    dept_id character varying(10) NOT NULL,
    int_status integer,
    text character varying(50),
    parent_id character varying(10),
    created_on date,
    changed_on date,
    changed_by character varying(10),
    created_by character varying(10),
    branch_id character varying(50)
);


ALTER TABLE public."tblDepartments" OWNER TO postgres;

--
-- Name: tblDepreciationSettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblDepreciationSettings" (
    setting_id character varying NOT NULL,
    org_id character varying NOT NULL,
    fiscal_year_start_month integer DEFAULT 1,
    fiscal_year_start_day integer DEFAULT 1,
    depreciation_calculation_frequency character varying(20) DEFAULT 'MONTHLY'::character varying,
    auto_calculate_depreciation boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    changed_by character varying,
    changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblDepreciationSettings" OWNER TO postgres;

--
-- Name: tblDeptAdmins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblDeptAdmins" (
    dept_admin_id character varying(10) NOT NULL,
    org_id character varying NOT NULL,
    dept_id character varying NOT NULL,
    user_id character varying NOT NULL,
    created_by character varying NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying,
    changed_on timestamp without time zone,
    branch_id character varying(10)
);


ALTER TABLE public."tblDeptAdmins" OWNER TO postgres;

--
-- Name: tblDeptAssetTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblDeptAssetTypes" (
    dept_asset_type_id character varying(20) NOT NULL,
    dept_id character varying(20) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    int_status integer NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying(20) NOT NULL,
    changed_on timestamp without time zone NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblDeptAssetTypes" OWNER TO postgres;

--
-- Name: tblDocTypeObjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblDocTypeObjects" (
    dto_id character varying(20) NOT NULL,
    object_type character varying(20) NOT NULL,
    doc_type character varying(20) NOT NULL,
    doc_type_text character varying(50) NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblDocTypeObjects" OWNER TO postgres;

--
-- Name: tblEmployees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblEmployees" (
    emp_int_id character varying(20) NOT NULL,
    employee_id character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    middle_name character varying(50),
    full_name character varying(100),
    email_id character varying(50) NOT NULL,
    dept_id character varying(20) NOT NULL,
    phone_number character varying(20) NOT NULL,
    employee_type character varying(20) NOT NULL,
    joining_date timestamp without time zone NOT NULL,
    releiving_date timestamp without time zone,
    language_code character varying(2) NOT NULL,
    int_status integer NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying(20) NOT NULL,
    changed_on timestamp without time zone NOT NULL,
    org_id character varying(20),
    branch_id character varying(10)
);


ALTER TABLE public."tblEmployees" OWNER TO postgres;

--
-- Name: tblEvents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblEvents" (
    event_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL
);


ALTER TABLE public."tblEvents" OWNER TO postgres;

--
-- Name: tblFCMTokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblFCMTokens" (
    token_id character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    device_token text NOT NULL,
    device_type character varying(20) DEFAULT 'mobile'::character varying,
    platform character varying(20),
    app_version character varying(20),
    device_info jsonb,
    is_active boolean DEFAULT true,
    last_used timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblFCMTokens" OWNER TO postgres;

--
-- Name: tblIDSequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblIDSequences" (
    table_key character varying(50) NOT NULL,
    prefix character varying(10),
    last_number integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."tblIDSequences" OWNER TO postgres;

--
-- Name: tblJobRoleNav; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblJobRoleNav" (
    job_role_nav_id character varying(20) NOT NULL,
    org_id character varying NOT NULL,
    int_status integer NOT NULL,
    job_role_id character varying(20) NOT NULL,
    parent_id character varying(20),
    app_id character varying(50) NOT NULL,
    label character varying(50) NOT NULL,
    sub_menu character varying(20),
    sequence integer NOT NULL,
    access_level character varying(10) NOT NULL,
    is_group boolean NOT NULL,
    mob_desk character(1) NOT NULL
);


ALTER TABLE public."tblJobRoleNav" OWNER TO postgres;

--
-- Name: COLUMN "tblJobRoleNav".app_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblJobRoleNav".app_id IS 'GROUPASSET - Group Asset Management';


--
-- Name: tblJobRoles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblJobRoles" (
    org_id character varying(10) NOT NULL,
    job_role_id character varying(20) NOT NULL,
    text character varying(50),
    job_function character varying(50),
    int_status integer DEFAULT 1
);


ALTER TABLE public."tblJobRoles" OWNER TO postgres;

--
-- Name: tblMaintStatus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblMaintStatus" (
    maint_status_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL,
    int_status numeric NOT NULL
);


ALTER TABLE public."tblMaintStatus" OWNER TO postgres;

--
-- Name: tblMaintTypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblMaintTypes" (
    maint_type_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL,
    int_status numeric NOT NULL
);


ALTER TABLE public."tblMaintTypes" OWNER TO postgres;

--
-- Name: tblNotificationHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblNotificationHistory" (
    notification_id character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    token_id character varying(20),
    notification_type character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    data jsonb,
    status character varying(20) DEFAULT 'sent'::character varying,
    fcm_response jsonb,
    sent_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    delivered_on timestamp without time zone,
    clicked_on timestamp without time zone
);


ALTER TABLE public."tblNotificationHistory" OWNER TO postgres;

--
-- Name: tblNotificationPreferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblNotificationPreferences" (
    preference_id character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    notification_type character varying(50) NOT NULL,
    is_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT true,
    push_enabled boolean DEFAULT true,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblNotificationPreferences" OWNER TO postgres;

--
-- Name: tblOrgSettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblOrgSettings" (
    os_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    key character varying(20) NOT NULL,
    value character varying(10) NOT NULL
);


ALTER TABLE public."tblOrgSettings" OWNER TO postgres;

--
-- Name: tblOrgs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblOrgs" (
    org_id character varying(10) NOT NULL,
    text character varying(50),
    valid_from date,
    valid_to date,
    int_status integer,
    org_code character varying(50) DEFAULT ''::character varying NOT NULL,
    org_city character varying(100) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public."tblOrgs" OWNER TO postgres;

--
-- Name: tblPrintSerialNoQueue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblPrintSerialNoQueue" (
    psnq_id character varying(20) NOT NULL,
    serial_no character varying(12) NOT NULL,
    status character varying(10) NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    org_id character varying(20) NOT NULL,
    reason character varying(50)
);


ALTER TABLE public."tblPrintSerialNoQueue" OWNER TO postgres;

--
-- Name: tblProdServs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblProdServs" (
    prod_serv_id character varying NOT NULL,
    org_id character varying NOT NULL,
    asset_type_id character varying NOT NULL,
    brand character varying,
    model character varying,
    status character varying NOT NULL,
    ps_type character varying NOT NULL,
    description character varying
);


ALTER TABLE public."tblProdServs" OWNER TO postgres;

--
-- Name: tblProps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblProps" (
    prop_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    property character varying(50) NOT NULL,
    int_status numeric NOT NULL
);


ALTER TABLE public."tblProps" OWNER TO postgres;

--
-- Name: tblScrapSalesDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblScrapSalesDocs" (
    ssdoc_id character varying(20) NOT NULL,
    ssh_id character varying(20) NOT NULL,
    dto_id character varying(20) NOT NULL,
    doc_type_name character varying(20),
    doc_path character varying(50) NOT NULL,
    is_archived boolean,
    archived_path character varying(50),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblScrapSalesDocs" OWNER TO postgres;

--
-- Name: tblScrapSales_D; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblScrapSales_D" (
    ssd_id character varying(20) NOT NULL,
    ssh_id character varying(20) NOT NULL,
    asd_id character varying(20) NOT NULL,
    sale_value bigint NOT NULL
);


ALTER TABLE public."tblScrapSales_D" OWNER TO postgres;

--
-- Name: tblScrapSales_H; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblScrapSales_H" (
    ssh_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL,
    total_sale_value bigint[] NOT NULL,
    buyer_name character varying(20) NOT NULL,
    buyer_company character varying(20) NOT NULL,
    buyer_phone character varying(15) NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying(20) NOT NULL,
    changed_on timestamp without time zone NOT NULL,
    sale_date timestamp without time zone NOT NULL,
    collection_date timestamp without time zone NOT NULL,
    invoice_no character varying(20),
    po_no character varying(20),
    branch_code character varying(10)
);


ALTER TABLE public."tblScrapSales_H" OWNER TO postgres;

--
-- Name: tblTableFilterColumns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblTableFilterColumns" (
    id integer NOT NULL,
    tablename character varying(255) NOT NULL,
    columns_csv text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."tblTableFilterColumns" OWNER TO postgres;

--
-- Name: tblTechnicalLogConfig; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblTechnicalLogConfig" (
    id integer NOT NULL,
    app_id character varying(50) NOT NULL,
    log_level character varying(20) DEFAULT 'ERROR'::character varying NOT NULL,
    enabled boolean DEFAULT true,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_log_level CHECK (((log_level)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'ERROR'::character varying, 'CRITICAL'::character varying, 'NONE'::character varying])::text[])))
);


ALTER TABLE public."tblTechnicalLogConfig" OWNER TO postgres;

--
-- Name: TABLE "tblTechnicalLogConfig"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."tblTechnicalLogConfig" IS 'Configuration table for technical event logging system';


--
-- Name: COLUMN "tblTechnicalLogConfig".app_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblTechnicalLogConfig".app_id IS 'Application/module identifier';


--
-- Name: COLUMN "tblTechnicalLogConfig".log_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblTechnicalLogConfig".log_level IS 'Log level name: INFO, WARNING, ERROR, CRITICAL, NONE (numeric code derived when needed)';


--
-- Name: tblTechnicalLogConfig_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."tblTechnicalLogConfig_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."tblTechnicalLogConfig_id_seq" OWNER TO postgres;

--
-- Name: tblTechnicalLogConfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."tblTechnicalLogConfig_id_seq" OWNED BY public."tblTechnicalLogConfig".id;


--
-- Name: tblUserJobRoles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblUserJobRoles" (
    user_job_role_id character varying(20) NOT NULL,
    user_id character varying(20) NOT NULL,
    job_role_id character varying(20) NOT NULL
);


ALTER TABLE public."tblUserJobRoles" OWNER TO postgres;

--
-- Name: tblUsers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblUsers" (
    org_id character varying(10) NOT NULL,
    user_id character varying(20) NOT NULL,
    full_name character varying(50),
    email character varying(50),
    phone character varying(20),
    job_role_id character varying(20),
    password text,
    created_by character varying(20),
    created_on date DEFAULT CURRENT_DATE,
    changed_by character varying(20),
    changed_on date DEFAULT CURRENT_DATE,
    reset_token text,
    reset_token_expiry timestamp without time zone,
    last_accessed date DEFAULT CURRENT_DATE,
    time_zone character varying(10) DEFAULT 'IST'::character varying,
    date_format character varying(20) DEFAULT 'YYYY-MM-DD'::character varying,
    language_code character varying(10) DEFAULT 'EN'::character varying,
    int_status integer DEFAULT 1,
    dept_id text,
    emp_int_id character varying(20),
    branch_id character varying(10)
);


ALTER TABLE public."tblUsers" OWNER TO postgres;

--
-- Name: tblVendorDocs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblVendorDocs" (
    vd_id character varying(20) NOT NULL,
    vendor_id character varying(20) NOT NULL,
    dto_id character varying(20) NOT NULL,
    doc_type_name character varying(50),
    doc_path character varying(200) NOT NULL,
    is_archived boolean,
    archived_path character varying(200),
    org_id character varying(10) NOT NULL
);


ALTER TABLE public."tblVendorDocs" OWNER TO postgres;

--
-- Name: tblVendorProdService; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblVendorProdService" (
    ven_prod_serv_id character varying(10) NOT NULL,
    prod_serv_id character varying NOT NULL,
    vendor_id character varying NOT NULL,
    org_id character varying NOT NULL
);


ALTER TABLE public."tblVendorProdService" OWNER TO postgres;

--
-- Name: tblVendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblVendors" (
    vendor_id character varying(50) NOT NULL,
    org_id character varying(50) NOT NULL,
    vendor_name character varying(50) NOT NULL,
    int_status integer NOT NULL,
    company_name character varying(50) NOT NULL,
    address_line1 character varying(500) NOT NULL,
    address_line2 character varying(500),
    city character varying(50) NOT NULL,
    state character varying(50) NOT NULL,
    pincode character varying(10) NOT NULL,
    company_email character varying(50) NOT NULL,
    gst_number character varying(50),
    cin_number character varying(50),
    contact_person_name character varying(50) NOT NULL,
    contact_person_email character varying(50) NOT NULL,
    contact_person_number character varying(50) NOT NULL,
    created_by character varying(50) NOT NULL,
    created_on timestamp without time zone NOT NULL,
    changed_by character varying(50) NOT NULL,
    changed_on timestamp without time zone NOT NULL,
    branch_code character varying(10)
);


ALTER TABLE public."tblVendors" OWNER TO postgres;

--
-- Name: tblWFATSeqs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFATSeqs" (
    wf_at_seqs_id character varying(10) NOT NULL,
    asset_type_id character varying(20) NOT NULL,
    wf_steps_id character varying(20),
    seqs_no character varying(20),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblWFATSeqs" OWNER TO postgres;

--
-- Name: tblWFATSeqs_wf_at_seqs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."tblWFATSeqs_wf_at_seqs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."tblWFATSeqs_wf_at_seqs_id_seq" OWNER TO postgres;

--
-- Name: tblWFATSeqs_wf_at_seqs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."tblWFATSeqs_wf_at_seqs_id_seq" OWNED BY public."tblWFATSeqs".wf_at_seqs_id;


--
-- Name: tblWFAssetMaintHist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFAssetMaintHist" (
    wfamhis_id character varying(20) NOT NULL,
    wfamsh_id character varying(20) NOT NULL,
    wfamsd_id character varying(20) NOT NULL,
    action_by character varying(20) NOT NULL,
    action_on timestamp without time zone NOT NULL,
    action character varying(2) NOT NULL,
    notes character varying(100),
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblWFAssetMaintHist" OWNER TO postgres;

--
-- Name: tblWFAssetMaintSch_D; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFAssetMaintSch_D" (
    wfamsd_id character varying(20) NOT NULL,
    wfamsh_id character varying(20) NOT NULL,
    job_role_id character varying(20) NOT NULL,
    dept_id character varying(20) NOT NULL,
    sequence integer NOT NULL,
    status character varying(2) NOT NULL,
    notes character varying(100),
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone,
    changed_by character varying(20),
    changed_on timestamp without time zone[],
    org_id character varying(20) NOT NULL,
    user_id character varying(50)
);


ALTER TABLE public."tblWFAssetMaintSch_D" OWNER TO postgres;

--
-- Name: tblWFAssetMaintSch_H; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFAssetMaintSch_H" (
    wfamsh_id character varying(20) NOT NULL,
    at_main_freq_id character varying(20) NOT NULL,
    maint_type_id character varying(20) NOT NULL,
    asset_id character varying(20) NOT NULL,
    group_id character varying(20),
    vendor_id character varying(20),
    pl_sch_date timestamp without time zone NOT NULL,
    act_sch_date timestamp without time zone,
    status character varying(2) NOT NULL,
    created_by character varying(20) NOT NULL,
    created_on timestamp without time zone,
    changed_by character varying(20),
    changed_on timestamp without time zone,
    org_id character varying(20),
    existing_ams_id character varying(50),
    branch_code character varying(10)
);


ALTER TABLE public."tblWFAssetMaintSch_H" OWNER TO postgres;

--
-- Name: COLUMN "tblWFAssetMaintSch_H".existing_ams_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."tblWFAssetMaintSch_H".existing_ams_id IS 'References existing maintenance schedule (ams_id) that should be updated instead of creating new one. Used for BF01 breakdown prepone scenarios.';


--
-- Name: tblWFJobRole; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFJobRole" (
    wf_job_role_id character varying(20) NOT NULL,
    wf_steps_id character varying(20) NOT NULL,
    job_role_id character varying(20) NOT NULL,
    emp_int_id character varying(20),
    dept_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL
);


ALTER TABLE public."tblWFJobRole" OWNER TO postgres;

--
-- Name: tblWFSteps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."tblWFSteps" (
    wf_steps_id character varying(20) NOT NULL,
    org_id character varying(20) NOT NULL,
    text character varying(50) NOT NULL
);


ALTER TABLE public."tblWFSteps" OWNER TO postgres;

--
-- Name: tbltablefiltercolumns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tbltablefiltercolumns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tbltablefiltercolumns_id_seq OWNER TO postgres;

--
-- Name: tbltablefiltercolumns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tbltablefiltercolumns_id_seq OWNED BY public."tblTableFilterColumns".id;


--
-- Name: tblTableFilterColumns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblTableFilterColumns" ALTER COLUMN id SET DEFAULT nextval('public.tbltablefiltercolumns_id_seq'::regclass);


--
-- Name: tblTechnicalLogConfig id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblTechnicalLogConfig" ALTER COLUMN id SET DEFAULT nextval('public."tblTechnicalLogConfig_id_seq"'::regclass);


--
-- Data for Name: tblATBRReasonCodes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblATBRReasonCodes" (atbrrc_id, asset_type_id, text, instatus, org_id) FROM stdin;
ATB003	AT001	Port & Hinge Damage	1	ORG001
ATB004	AT002	Power Supply & Electrical Damage	1	ORG001
ATB005	AT002	Internal Component Damage	1	ORG001
ATB006	AT002	External & Peripheral Damage	1	ORG001
ATB007	AT003	Screen Damage	1	ORG001
ATB008	AT003	Port & Cable Damage	1	ORG001
ATB009	AT003	Internal Component Damage	1	ORG001
ATB010	AT009	Port & Antenna Damage	1	ORG001
ATB011	AT009	Power Supply Damage	1	ORG001
ATB012	AT009	Overheating & Dust Damage	1	ORG001
ATB013	AT010	Cylinder Damage	1	ORG001
ATB014	AT010	Hose & Nozzle Damage	1	ORG001
ATB015	AT010	Handle & Pin Damage	1	ORG001
ATB016	AT011	Lens & Glass Damage	1	ORG001
ATB017	AT011	Cable & Connector Damage	1	ORG001
ATB018	AT011	Housing & Mount Damage	1	ORG001
ATB001	AT001	Display Flicker	1	ORG001
ATB002	AT001	Keyboard & Touchpad Damage	1	ORG001
ATB019	AT052	water leakage	1	ORG001
ATB020	AT052	cap damage 	1	ORG001
ATB021	AT008	Wire damaged	1	ORG001
\.


--
-- Data for Name: tblATDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblATDocs" (atd_id, asset_type_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
ATD004	AT001	DTO017	\N	assetlifecyclemanagement/ORG001/asset-types/AT001/1756979554357_44ae97a47608311a.png	t	assetlifecyclemanagement/asset-types/Archived Asset Type Document/AT001/1756979554357_44ae97a47608311a.png	ORG001
ATD010	AT001	DTO017	Test Custom Document	assetlifecyclemanagement/ORG001/asset-types/AT001/1757063887266_c72479fe1f7ac5fc.txt	f	\N	ORG001
ATD011	AT001	DTO017	Test Document for AT001	assetlifecyclemanagement/ORG001/asset-types/AT001/1757064577729_fb2d9498649cf2b9.txt	f	\N	ORG001
ATD012	AT033	DTO017	\N	assetlifecyclemanagement/ORG001/asset-types/AT033/1757064636260_708992143c4202b8.pdf	f	\N	ORG001
ATD013	AT001	DTO001	Custom Test Document	assetlifecyclemanagement/ORG001/asset-types/AT001/1757064792113_0822adc51c781045.txt	f	\N	ORG001
ATD014	AT034	DTO001	other	assetlifecyclemanagement/ORG001/asset-types/AT034/1757064900170_5ca8ecd4822f9a2e.pdf	f	\N	ORG001
ATD015	AT036	DTO017	\N	assetlifecyclemanagement/ORG001/asset-types/AT036/1757579524091_4daa70477cfe1660.pdf	t	assetlifecyclemanagement/asset-types/Archived Asset Type Document/AT036/1757579524091_4daa70477cfe1660.pdf	ORG001
\.


--
-- Data for Name: tblATMaintCheckList; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblATMaintCheckList" (at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id) FROM stdin;
ATMCL001	ORG001	AT001	Battery health check	ATMF001
ATMCL002	ORG001	AT001	OS & software installed	ATMF001
ATMCL003	ORG001	AT001	Physical damage inspection	ATMF001
ATMCL004	ORG001	AT010	Physical Condition Check	ATMF014
ATMCL005	ORG001	AT010	Accessibility & Labeling	ATMF014
ATMCL006	ORG001	AT010	Pressure Gauge & Seal Verification	ATMF014
ATMCL007	ORG001	AT053	Renewal Check	ATMF018
\.


--
-- Data for Name: tblATMaintFreq; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblATMaintFreq" (at_main_freq_id, asset_type_id, frequency, uom, text, maintained_by, maint_type_id, int_status, org_id) FROM stdin;
ATMF002	AT002	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF003	AT006	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF004	AT007	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF006	AT011	90	days	Quarterly 	vendor	MT002	1	ORG001
ATMG007	AT013	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF008	AT014	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF009	AT017	90	days	Quarterly	vendor	MT002	1	ORG001
ATMF010	AT004	180	days	Half yearly 	vendor	MT002	1	ORG001
ATMF011	AT005	180	days	Half Yearly	vendor	MT002	1	ORG001
ATMF012	AT003	180	days	Yearly	vendor	MT002	1	ORG001
ATMF013	AT008	108	days	Yearly	vendor	MT002	1	ORG001
ATMF014	AT010	180	days	Yearly	vendor	MT002	1	ORG001
ATMF015	AT015	180	days	Yearly	vendor	MT001	1	ORG001
ATMF016	AT016	180	days	Yearly	vendor	MT001	1	ORG001
ATMF001	AT001	30	days	Monthly 	vendor	MT002	1	ORG001
ATMF005	AT009	90	days	Quarterly	vendor	MT003	1	ORG001
ATMF018	AT053	30	days	Monthly	vendor	MT001	1	ORG001
ATMF019	AT008	7	days	weekly	vendor	MT002	1	ORG001
ATMF020	AT054	10000	kms	Daily	vendor	MT003	1	ORG001
\.


--
-- Data for Name: tblApps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblApps" (app_id, text, int_status, org_id) FROM stdin;
BULKUPLOAD	Bulk Upload 	t	ORG001
DEPARTMENTSASSET	Departments AssetType	t	ORG001
MAINTENANCEAPPROVAL	Maintenance Approval	t	ORG001
DEPARTMENTSADMIN	Department Admin	t	ORG001
MAINTENANCESCHEDULE	Maintenance Schedule	t	ORG001
WORKORDERMANAGEMENT	Workorder Management	t	ORG001
SUPERVISORAPPROVAL_M	Supervisor Approval Mobile 	t	ORG001
REPORTBREAKDOWN	Report Breakdown	t	ORG001
REPORTBREAKDOWN_M	Report Breakdown_M	t	ORG001
REPORTS	Reports	t	ORG001
ADMINSETTINGS	Admin Settings 	t	ORG001
AUDITLOGCONFIG	Audit Log Config	t	ORG001
ASSETS	Assets	t	ORG001
DEPTASSIGNMENT	Department Assignment	t	ORG001
AUDITLOGS	Audit Logs	t	ORG001
PRODSERV	Products/Services	t	ORG001
DEPARTMENTS	Department	t	ORG001
VENDORS	Vendors	t	ORG001
USERS	User	t	ORG001
ASSETTYPES	Asset Types	t	ORG001
ORGANIZATIONS	Organization	t	ORG001
BRANCHES	Branch	t	ORG001
EMPASSIGNMENT	Employee Assignment	t	ORG001
GROUPASSET	Group Asset	t	ORG001
LOGIN	Login	t	ORG001
LOGOUT	Logout	t	ORG001
RESETPASSWORD	Reset Password	t	ORG001
SCRAPSALES	Scrap Sales	t	ORG001
SCRAPASSETS	Scrap Assets	t	ORG001
FORGETPASSWORD	Forget Password 	t	ORG001
DASHBOARD	Dashboard 	t	ORG001
USERROLES	User Roles	t	ORG001
ALCREPORT	Asset Lifecycle Report	t	ORG001
AREPORT	Asset Report	t	ORG001
AVREPORT	Asset Valuation Report	t	ORG001
AWFHREPORT	Asset Workflow History Report	t	ORG001
BHREPORT	Breakdown History Report	t	ORG001
MHREPORT	Maintenance History Report 	t	ORG001
ASSETASSIGNMENT	Assert Assignment 	t	ORG001
DEPTASSIGNMENT_M	Department Assert Assignment Mobile 	t	ORG001
EMPASSIGNMENT_M	Employee Assert Assignment Mobile 	t	ORG001
ASSETASSIGNMENT_M	Asset Assignment Mobile 	t	ORG001
SNOPRINT	Serial Number Print 	t	ORG001
SUPERVISORAPPROVAL	Supervisor Approval	t	ORG001
MASTERDATA	Master Data	t	ORG001
\.


--
-- Data for Name: tblAssetAssignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetAssignments" (asset_assign_id, dept_id, asset_id, org_id, employee_int_id, action, action_on, action_by, latest_assignment_flag) FROM stdin;
AA1757676031111	DPT201	ASS075	ORG001	\N	C	2025-09-12 11:21:06.949156	USR002	f
AA1754306674282	DPT201	ASS004	ORG001	EMP_INT_0005	C	2025-08-04 11:24:35.485921	EMP006	f
AA1754306690383	DPT205	ASS004	ORG001	EMP_INT_0012	A	2025-08-04 11:24:51.586345	EMP006	f
AA1754306734727	DPT205	ASS004	ORG001	EMP_INT_0012	C	2025-08-04 11:25:35.937282	EMP006	f
AA1756305604484	DPT201	ASS005	ORG001	EMP_INT_0004	C	2025-09-12 11:32:53.252374	USR002	f
AA1757679322251	DPT201	ASS071	ORG001	\N	C	2025-09-12 12:15:36.381592	USR002	f
AA1754306740687	DPT202	ASS004	ORG001	EMP_INT_0001	A	2025-08-04 11:25:41.905542	EMP006	f
AA1754310672230	DPT202	ASS004	ORG001	EMP_INT_0001	C	2025-08-04 12:31:13.468712	EMP006	f
AA1757676803051	DPT201	ASS004	ORG001	EMP_INT_0004	C	2025-09-12 12:16:14.988991	USR002	f
AA008	DPT202	ASS001	ORG001	EMP_INT_0001	A	2025-08-04 12:50:26.589602	EMP006	f
AA1754390608313	DPT202	ASS001	ORG001	EMP_INT_0001	C	2025-08-05 10:43:27.930671	USR002	f
AA1757679410438	DPT201	ASS004	ORG001	EMP_INT_0004	C	2025-09-12 13:07:25.853152	USR002	f
AA1757999314375	DPT201	ASS071	ORG001	\N	C	2025-09-16 05:09:03.525327	USR002	f
AA1757999426892	DPT201	ASS071	ORG001	\N	C	2025-09-16 05:10:53.116599	USR002	f
AA1757999647412	DPT201	ASS079	ORG001	EMP_INT_0004	C	2025-09-16 05:14:21.560887	USR002	f
AA1758020925838	DPT201	ASS071	ORG001	\N	C	2025-09-16 11:10:08.962291	USR002	f
AA1755606028488	DPT201	ASS020	ORG001	\N	C	2025-09-18 07:45:30.961112	USR003	f
AA1758181591190	DPT201	ASS020	ORG001	\N	A	2025-09-18 07:46:31.314262	USR003	t
AA1758183541932	DPT203	ASS013	ORG001	EMP_INT_0007	A	2025-09-18 08:19:02.14996	USR003	t
AA1758021028151	DPT201	ASS071	ORG001	\N	C	2025-09-18 09:35:08.25897	USR001	f
AA1754396205877	DPT202	ASS018	ORG001	\N	A	2025-08-05 13:02:22.711182	USR002	t
AA1758189224898	DPT201	ASS070	ORG001	\N	C	2025-09-18 10:05:07.323861	USR001	f
AA1754306786516	DPT202	ASS005	ORG001	EMP_INT_0001	A	2025-08-04 11:26:27.733959	EMP006	f
AA1754477109238	DPT202	ASS005	ORG001	EMP_INT_0001	C	2025-08-06 10:45:08.053003	USR002	f
AA1754477181012	DPT203	ASS005	ORG001	EMP_INT_0008	A	2025-08-06 10:46:19.822818	USR002	f
AA1754477337901	DPT203	ASS005	ORG001	EMP_INT_0008	C	2025-08-06 10:48:56.720307	USR002	f
AA1754396182328	DPT202	ASS028	ORG001	\N	A	2025-08-06 10:54:12.04869	USR002	f
AA1754477354187	DPT202	ASS005	ORG001	EMP_INT_0001	A	2025-08-06 10:49:13.008273	USR002	f
AA1754561978441	DPT202	ASS005	ORG001	EMP_INT_0001	C	2025-08-07 10:19:39.08784	USR002	f
AA1754561995946	DPT202	ASS005	ORG001	EMP_INT_0002	A	2025-08-07 10:19:56.588787	USR002	f
AA1754562083268	DPT202	ASS005	ORG001	EMP_INT_0002	C	2025-08-07 10:21:23.920101	USR002	f
AA1755605896102	DPT203	ASS011	ORG001	EMP_INT_0007	A	2025-08-19 12:18:16.460277	USR001	t
AA1755606235917	DPT203	ASS041	ORG001	EMP_INT_0009	A	2025-08-19 12:23:56.223901	USR001	t
AA1756304332733	DPT201	ASS017	ORG001	\N	A	2025-08-27 14:18:53.478395	USR001	t
AA1756304481153	DPT201	ASS016	ORG001	\N	A	2025-08-27 14:21:21.997132	USR001	t
AA1757659954498	DPT201	ASS025	ORG001	\N	A	2025-09-12 06:52:34.716201	USR003	t
AA1757671637964	DPT201	ASS076	ORG001	\N	C	2025-09-12 10:07:55.655126	USR002	f
AA1757671846145	DPT201	ASS070	ORG001	\N	C	2025-09-12 10:21:49.04402	USR002	f
AA1757672756247	DPT201	ASS071	ORG001	\N	C	2025-09-12 10:50:14.980305	USR002	f
AA1757674698422	DPT201	ASS071	ORG001	\N	C	2025-09-12 11:06:38.464449	USR002	f
AA1757675606382	DPT202	ASS071	ORG001	\N	C	2025-09-12 11:13:47.182026	USR002	f
AA1758190141287	DPT201	ASS079	ORG001	EMP_INT_0004	C	2025-09-18 10:09:14.261808	USR001	f
AA1755864798011	DPT203	ASS001	ORG001	EMP_INT_0008	A	2025-08-22 12:13:17.530459	USR003	f
AA1758693960704	DPT203	ASS001	ORG001	EMP_INT_0008	C	2025-09-24 06:06:02.11449	USR002	f
AA1758693994825	DPT201	ASS001	ORG001	EMP_INT_0004	A	2025-09-24 06:06:36.270089	USR002	f
AA1758694105308	DPT201	ASS001	ORG001	EMP_INT_0004	C	2025-09-24 06:08:26.744751	USR002	f
AA1758694157520	DPT201	ASS001	ORG001	EMP_INT_0004	A	2025-09-24 06:09:18.936351	USR002	f
AA1758708012155	DPT201	ASS001	ORG001	EMP_INT_0004	C	2025-09-24 10:00:13.657571	USR002	f
AA1758708421984	DPT201	ASS001	ORG001	EMP_INT_0004	A	2025-09-24 10:07:03.43978	USR002	f
AA1758708568002	DPT201	ASS001	ORG001	EMP_INT_0004	C	2025-09-24 10:09:29.465238	USR002	f
AA1758709242408	DPT201	ASS001	ORG001	EMP_INT_0004	A	2025-09-24 10:20:43.863128	USR002	f
AA1758709471074	DPT201	ASS001	ORG001	EMP_INT_0004	C	2025-09-24 10:24:32.536669	USR002	f
AA1758716100146	DPT202	ASS001	ORG001	EMP_INT_0001	A	2025-09-24 12:15:01.586527	USR002	f
AA1758871550402	DPT202	ASS001	ORG001	EMP_INT_0001	C	2025-09-26 07:25:48.785269	USR002	f
AA1754477480422	DPT202	ASS010	ORG001	EMP_INT_0001	A	2025-08-06 10:51:19.259979	USR002	f
AA1758872387443	DPT202	ASS010	ORG001	EMP_INT_0001	C	2025-09-26 07:39:45.878413	USR002	f
AA1758871581241	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-09-26 07:26:19.620517	USR002	f
AA1758872793653	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-09-26 07:46:32.009577	USR002	f
AA1758877994290	DPT201	AST002	ORG001	EMP_INT_0044	A	2025-09-26 09:13:16.23426	USR001	t
AA1758878004606	DPT201	AST001	ORG001	EMP_INT_0044	A	2025-09-26 09:13:26.475348	USR001	t
AA1758872810416	DPT202	ASS001	ORG001	EMP_INT_0001	A	2025-09-26 07:46:48.783203	USR002	f
AA1758879622890	DPT202	ASS001	ORG001	EMP_INT_0001	C	2025-09-26 09:40:21.24516	USR002	f
AA1758882737313	DPT201	ASS001	ORG001	EMP_INT_0004	A	2025-09-26 10:32:15.727345	USR002	f
AA1758882964731	DPT201	ASS001	ORG001	EMP_INT_0004	C	2025-09-26 10:36:03.166535	USR002	f
AA1758884297437	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-09-26 10:58:15.829951	USR002	f
AA1758884316540	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-09-26 10:58:34.942649	USR002	f
AA1758884840123	DPT202	ASS001	ORG001	EMP_INT_0001	A	2025-09-26 11:07:21.078195	USR002	f
AA1758884999171	DPT202	ASS001	ORG001	EMP_INT_0001	C	2025-09-26 11:09:57.618271	USR002	f
AA1759238850999	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-09-30 13:27:32.092083	USR002	f
AA1759835653291	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-07 11:14:13.885507	USR002	f
AA1759835674202	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-07 11:14:34.799491	USR002	f
AA1759839744803	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-07 12:22:25.40564	USR002	f
AA1759918243867	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-08 10:10:43.757503	USR002	f
AA1759918267906	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-08 10:11:07.808836	USR002	f
AA1758877973164	DPT201	ASS096	ORG001	EMP_INT_0044	A	2025-09-26 09:12:55.221742	USR001	f
AA1759918333888	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-08 10:12:13.78626	USR002	f
AA1759920612921	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-08 10:50:12.839163	USR002	f
AA1759920745154	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-08 10:52:25.010946	USR002	f
AA1759920794382	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-08 10:53:14.288854	USR002	f
AA1759920819287	DPT201	ASS001	ORG001	EMP_INT_0044	A	2025-10-08 10:53:39.188637	USR002	f
AA1759922162959	DPT201	ASS001	ORG001	EMP_INT_0044	C	2025-10-08 11:16:02.823614	USR002	f
AA1759922181998	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-08 11:16:21.888342	USR002	f
AA1759923780533	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-08 11:43:00.419159	USR002	f
AA1760003804065	DPT202	ASS001	ORG001	EMP_INT_0002	A	2025-10-09 09:56:44.870722	USR002	f
AA1760006468315	DPT202	ASS001	ORG001	EMP_INT_0002	C	2025-10-09 10:41:09.12262	USR002	f
AA1760008066619	DPT201	ASS023	ORG001	\N	C	2025-10-09 11:08:01.54328	USR003	f
AA1760010196245	DPT201	ASS096	ORG001	EMP_INT_0044	C	2025-10-09 11:43:17.028085	USR002	f
AA1760006520262	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-09 10:42:01.068441	USR002	f
AA1760010557828	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-09 11:49:18.603927	USR002	f
AA1760015431596	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-09 13:10:32.731326	USR002	f
AA1760015612084	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-09 13:13:33.169892	USR002	f
AA1760015673162	DPT201	ASS001	ORG001	EMP_INT_0003	A	2025-10-09 13:14:34.265192	USR002	f
AA1760016616567	DPT201	ASS001	ORG001	EMP_INT_0003	C	2025-10-09 13:30:17.679453	USR002	f
AA1760081920179	DPT202	ASS014	ORG001	EMP_INT_0002	A	2025-10-10 07:38:40.115943	USR002	t
AA1760090684612	DPT201	ASS001	ORG001	EMP_INT_0044	A	2025-10-10 10:04:44.632201	USR002	f
AA1760090684844	DPT201	ASS001	ORG001	EMP_INT_0044	A	2025-10-10 10:04:44.8372	USR002	f
AA1760090700522	DPT201	ASS001	ORG001	EMP_INT_0044	C	2025-10-10 10:05:00.506935	USR002	f
AA1760343491592	DPT201	ASS096	ORG001	EMP_INT_0003	A	2025-10-13 08:18:13.594975	USR003	t
AA1760343515423	DPT201	AST087	ORG001	EMP_INT_0003	A	2025-10-13 08:18:37.407605	USR003	f
AA1760344139566	DPT201	AST087	ORG001	EMP_INT_0003	C	2025-10-13 08:29:01.543574	USR003	f
AA1761117784209	DPT201	ASS029	ORG001	\N	A	2025-10-22 07:23:04.821902	USR001	t
AA1760090711263	DPT201	ASS001	ORG001	EMP_INT_0044	C	2025-10-22 07:24:32.513262	USR001	f
AA1761733962214	DPT202	ASS092	ORG001	EMP_INT_0002	C	2025-10-29 10:33:04.17952	USR002	f
AA1761734030598	DPT202	ASS002	ORG001	EMP_INT_0002	C	2025-10-29 12:23:44.006185	USR002	f
AA1761740650199	DPT202	ASS002	ORG001	EMP_INT_0002	C	2025-11-04 09:52:27.01567	USR001	f
AA1762253231836	DPT202	ASS081	ORG001	\N	C	2025-11-04 11:59:34.538048	USR001	f
AA1762253228262	DPT202	ASS081	ORG001	\N	C	2025-11-04 17:48:47.749498	EMP_INT_0001	f
AA1760080806761	DPT202	ASS033	ORG001	EMP_INT_0002	C	2025-11-04 17:54:56.034458	EMP_INT_0001	f
AA1762407536361	DPT201	ASS098	ORG001	EMP_INT_0003	A	2025-11-06 05:38:57.551951	USR002	t
AA018	DPT201	ASS001	ORG001	\N	A	2025-11-06 13:21:17.226617	USR002	t
AA1762498598474	DPT201	ASS023	ORG001	\N	A	2025-11-07 07:03:48.592352	USR002	f
AA1762250191668	DPT201	ASS002	ORG001	EMP_INT_0044	A	2025-11-07 07:05:52.016079	USR002	f
AA1760440570922	DPT201	AST004	ORG001	EMP_INT_0003	A	2025-10-14 11:16:10.687933	USR003	f
AA1762499264223	DPT201	AST004	ORG001	EMP_INT_0003	C	2025-11-07 07:07:44.96806	USR002	f
AA1762500416428	DPT201	ASS022	ORG001	\N	A	2025-11-07 07:26:57.585149	USR002	f
AA1762500509207	DPT201	ASS022	ORG001	\N	C	2025-11-07 07:28:30.021103	USR002	f
AA1762500816211	DPT201	ASS022	ORG001	\N	A	2025-11-07 07:33:37.337842	USR002	f
AA1762501160566	DPT201	ASS022	ORG001	\N	C	2025-11-07 07:39:21.745634	USR002	f
AA1762501572429	DPT201	ASS022	ORG001	\N	A	2025-11-07 07:46:13.601153	USR002	f
AA1762511897620	DPT201	ASS022	ORG001	\N	C	2025-11-07 10:38:18.81686	USR002	f
\.


--
-- Data for Name: tblAssetBRDet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetBRDet" (abr_id, asset_id, atbrrc_id, reported_by, is_create_maintenance, status, description, org_id, decision_code, created_on) FROM stdin;
ABR001	ASS023	ATB013	USR001	f	CR	Fell down by mistake	ORG001	BF02	2025-11-06 12:33:19.577097
\.


--
-- Data for Name: tblAssetDepHist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetDepHist" (depreciation_id, asset_id, org_id, depreciation_amount, book_value_before, book_value_after, depreciation_rate, useful_life_years, created_by, created_on) FROM stdin;
ORG001-20250813-903	ASS065	ORG001	3333.33	100000.00	96666.67	40.00	5	USR001	2025-08-13 17:19:04.025454
ORG001-20251029-536	AST085	ORG001	20.00	1500.00	1480.00	20.00	5	USR001	2025-10-29 10:45:36.20973
ORG001-20251029-537	AST087	ORG001	15.63	1000.00	984.38	25.00	4	USR001	2025-10-29 10:45:36.494007
\.


--
-- Data for Name: tblAssetDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetDocs" (a_d_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
AD006	ASS003	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS003/1757052024671_0076f26a45a6f92d.png	f	\N	ORG001
AD007	ASS003	DTO007	\N	asset-documents/ORG001/ASSET DOCUMENT/ASS003/1757052315525_2e3cb2085d3411a5.png	f	\N	ORG001
AD008	ASS003	DTO007	\N	asset-documents/ORG001/ASSET DOCUMENT/ASS003/1757052702538_ce97f4aba5c9cce9.png	f	\N	ORG001
AD009	ASS003	DTO007	\N	asset-documents/ORG001/ASSET DOCUMENT/ASS003/1757052747267_de6a94f514f257e6.png	f	\N	ORG001
AD010	ASS003	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS003/1757052810733_3aff5c6355b90cec.png	f	\N	ORG001
AD011	ASS003	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS003/1757052883055_edc733540fbebcbe.png	f	\N	ORG001
AD024	ASS079	DTO008	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS079/1757681443291_8bb383342f7db731.png	t	assetlifecyclemanagement/ASSET DOCUMENT/Archived Asset Document/ASS079/1757681443291_8bb383342f7db731.png	ORG001
AD023	ASS078	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS078/1757666127709_b68e28698bf7902e.png	f	\N	ORG001
AD027	ASS092	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS092/1758520322127_9f515d3123fe31eb.csv	f	\N	ORG001
AD028	ASS092	DTO008	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS092/1758546827568_71b0736d7632ee77.csv	f	\N	ORG001
AD029	ASS094	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS094/1758625959738_7540b377dc809657.csv	f	\N	ORG001
AD030	ASS074	DTO018	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS074/1758803268255_2646216a64278ec1.csv	f	\N	ORG001
AD031	ASS023	DTO018	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS023/1759224855955_19cd93eb12266c36.pdf	f	\N	ORG001
AD033	ASS101	DTO008	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS101/1760705194401_884792168fb95374.csv	f	\N	ORG001
AD032	ASS101	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS101/1760704646013_aabe30c9053ef814.csv	t	assetlifecyclemanagement/ASSET DOCUMENT/Archived Asset Document/ASS101/1760704646013_aabe30c9053ef814.csv	ORG001
AD034	AST101	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/AST101/1760857506374_e696a3f97e307c19.pdf	f	\N	ORG001
AD004	ASS002	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS002/1756977960889_9983cc0ba9f832b2.png	f	\N	ORG001
AD005	ASS003	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS003/1757050591971_b604f5611947f2da.png	f	\N	ORG001
AD016	ASS071	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS071/1757053941862_de426944589796b7.pdf	f	\N	ORG001
AD017	ASS075	DTO008	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS075/1757058132974_bf75cde0611d4df1.csv	f	\N	ORG001
AD018	ASS075	DTO001	Custom Asset Document	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS075/1757065114856_d1f9b1625b8562be.txt	f	\N	ORG001
AD020	ASS001	DTO001	manual	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS001/1757075370572_d5dd5102b208abf1.pdf	f	\N	ORG001
AD019	ASS076	DTO001	Other	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS076/1757065161084_f769d9766f1eaa60.pdf	f	\N	ORG001
AD021	ASS076	DTO001	ALM	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS076/1757080126929_dcda4eed60413afe.pdf	f	\N	ORG001
AD022	ASS001	DTO018	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS001/1757083370155_58930b146033cd19.pdf	f	\N	ORG001
AD025	ASS079	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS079/1757793938341_ad1737af57cc622b.xlsx	f	\N	ORG001
AD026	ASS079	DTO007	\N	assetlifecyclemanagement/ORG001/ASSET DOCUMENT/ASS079/1757795843063_81b8c90cddd7ffbf.xlsx	f	\N	ORG001
\.


--
-- Data for Name: tblAssetGroupDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetGroupDocs" (agd_id, asset_group_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
AGD004	AGH001	DTO011	\N	assetlifecyclemanagement/ORG001/asset-groups/AGH001/1756987470298_0b5f2ec46e0796bf.png	t	assetlifecyclemanagement/asset-groups/Archived Asset Group Document/AGH001/1756987470298_0b5f2ec46e0796bf.png	ORG001
AGD005	AGH008	DTO011	\N	assetlifecyclemanagement/ORG001/asset-groups/AGH008/1757074088378_2efe6bd717b8623c.pdf	f	\N	ORG001
AGD006	AGH008	DTO001	other	assetlifecyclemanagement/ORG001/asset-groups/AGH008/1757074102890_fae097b2eed5edbe.pdf	f	\N	ORG001
AGD007	AGH012	DTO001	Other	assetlifecyclemanagement/ORG001/asset-groups/AGH012/1757074599003_3440dcffbf938a69.pdf	t	assetlifecyclemanagement/asset-groups/Archived Asset Group Document/AGH012/1757074599003_3440dcffbf938a69.pdf	ORG001
AGD008	AGH013	DTO011	\N	assetlifecyclemanagement/ORG001/asset-groups/AGH013/1757914964875_b90af4d55b4b4e8b.xlsx	t	assetlifecyclemanagement/asset-groups/Archived Asset Group Document/AGH013/1757914964875_b90af4d55b4b4e8b.xlsx	ORG001
\.


--
-- Data for Name: tblAssetGroup_D; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetGroup_D" (assetgroup_d_id, assetgroup_h_id, asset_id) FROM stdin;
AGD043	AGH013	ASS010
AGD050	AGH019	ASS019
AGD051	AGH019	ASS018
AGD001	AGH001	ASS014
AGD002	AGH001	ASS015
AGD026	AGH008	ASS014
AGD027	AGH008	ASS015
AGD028	AGH008	ASS006
AGD029	AGH008	ASS007
AGD034	AGH012	ASS059
\.


--
-- Data for Name: tblAssetGroup_H; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetGroup_H" (assetgroup_h_id, org_id, text, created_by, created_on, changed_by, changed_on, branch_code) FROM stdin;
AGH001	ORG001	CPU Components Group	USR002	2025-08-11	USR002	2025-08-11	101
AGH008	ORG001	Computer Group	USR001	2025-08-12	USR001	2025-08-12	101
AGH012	ORG001	Test Group	USR001	2025-09-05	USR001	2025-09-05	101
AGH013	ORG001	Monitor groups	USR001	2025-09-15	USR001	2025-10-23	101
AGH019	ORG001	projectors	USR001	2025-11-06	USR001	2025-11-06	101
\.


--
-- Data for Name: tblAssetMaintDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetMaintDocs" (amd_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
AMD004	ASS001	DTO004	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1756989173928_8daf99920d3e99f9.png	t	assetlifecyclemanagement/asset-maintenance/Archived Asset Maintenance Document/ASS001/1756989173928_8daf99920d3e99f9.png	ORG001
AMD005	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757075730098_cd231dd8a8fb20b3.pdf	f	\N	ORG001
AMD006	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757075740851_a14f3fe86ac79edb.pdf	f	\N	ORG001
AMD007	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757075750169_0438bf245b9a81b1.pdf	f	\N	ORG001
AMD008	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757075759272_f9c46a1a518d9b23.pdf	f	\N	ORG001
AMD009	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757075771160_a0466a035659a10a.pdf	f	\N	ORG001
AMD010	ASS001	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757076504649_d6871fbc0a957570.pdf	t	assetlifecyclemanagement/asset-maintenance/Archived Asset Maintenance Document/ASS001/1757076504649_d6871fbc0a957570.pdf	ORG001
AMD011	ASS001	DTO004	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS001/1757077708787_2acbf6bc42c850bd.png	f	\N	ORG001
AMD012	ASS074	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS074/1758804268666_087adf50e1436ce1.pdf	f	\N	ORG001
AMD013	ASS018	DTO006	\N	assetlifecyclemanagement/ORG001/asset-maintenance/ASS018/1762431312297_56bc666e2998c0ec.pdf	f	\N	ORG001
\.


--
-- Data for Name: tblAssetMaintSch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetMaintSch" (ams_id, wfamsh_id, asset_id, maint_type_id, vendor_id, at_main_freq_id, maintained_by, notes, status, act_maint_st_date, act_main_end_date, po_number, invoice, technician_name, technician_email, technician_phno, created_by, created_on, changed_by, changed_on, org_id, wo_id, branch_code, cost) FROM stdin;
\.


--
-- Data for Name: tblAssetPropListValues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetPropListValues" (aplv_id, prop_id, value, int_status, org_id) FROM stdin;
APLV001	PROP001	Wood	1	ORG001
APLV002	PROP001	Metal	1	ORG001
APLV003	PROP001	Glass	1	ORG001
APLV004	PROP002	4x2 ft	1	ORG001
APLV005	PROP002	5x3 ft	1	ORG001
APLV006	PROP002	6x4 ft	1	ORG001
APLV007	PROP003	Black	1	ORG001
APLV008	PROP003	Brown	1	ORG001
APLV009	PROP003	White	1	ORG001
APLV010	PROP004	Dell	1	ORG001
APLV011	PROP004	HP	1	ORG001
APLV012	PROP004	Lenovo	1	ORG001
APLV013	PROP005	intel i5	1	ORG001
APLV014	PROP005	intel i7	1	ORG001
APLV015	PROP005	AMD Ryzen 7	1	ORG001
APLV016	PROP006	8 GB	1	ORG001
APLV017	PROP006	16 GB	1	ORG001
APLV018	PROP006	32 GB	1	ORG001
APLV019	PROP007	21.5 inch	1	ORG001
APLV020	PROP007	24 inch	1	ORG001
APLV021	PROP007	27 inch	1	ORG001
APLV022	PROP008	Full HD	1	ORG001
APLV023	PROP008	2K	1	ORG001
APLV024	PROP008	4K	1	ORG001
APLV025	PROP009	IPS	1	ORG001
APLV026	PROP009	TN	1	ORG001
APLV027	PROP009	VA	1	ORG001
APLV028	PROP010	Wired	1	ORG001
APLV029	PROP010	Wireless	1	ORG001
APLV030	PROP010	Bluetooth	1	ORG001
APLV031	PROP011	QWERTY	1	ORG001
APLV032	PROP011	AZERTY	1	ORG001
APLV033	PROP012	Optical	1	ORG001
APLV034	PROP012	Laser	1	ORG001
APLV035	PROP012	Trackball	1	ORG001
APLV036	PROP012	CO2	1	ORG001
APLV037	PROP012	Dry Powder	1	ORG001
APLV038	PROP012	Foam	1	ORG001
APLV039	PROP012	Split	1	ORG001
APLV040	PROP012	Window	1	ORG001
APLV041	PROP012	Inverter	1	ORG001
APLV042	PROP012	Inkjet	1	ORG001
APLV043	PROP012	Laser	1	ORG001
APLV044	PROP012	Dot Matrix	1	ORG001
APLV045	PROP013	600 VA	1	ORG001
APLV046	PROP013	1000 VA	1	ORG001
APLV047	PROP013	1500 VA	1	ORG001
APLV048	PROP014	10 mins	1	ORG001
APLV049	PROP014	20 mins	1	ORG001
APLV050	PROP014	30 mins	1	ORG001
APLV051	PROP016	2000	1	ORG001
APLV052	PROP016	3500	1	ORG001
APLV053	PROP016	5000	1	ORG001
APLV054	PROP017	Short	1	ORG001
APLV055	PROP017	Medium	1	ORG001
APLV056	PROP017	Long	1	ORG001
APLV057	PROP018	Single Band	1	ORG001
APLV058	PROP018	Dual Band	1	ORG001
APLV059	PROP019	150 Mbps	1	ORG001
APLV060	PROP019	300 Mbps	1	ORG001
APLV061	PROP019	1 Gbps	1	ORG001
APLV062	PROP022	Fixed	1	ORG001
APLV063	PROP022	Varifocal	1	ORG001
APLV064	PROP022	PTZ	1	ORG001
APLV065	PROP024	3 Star	1	ORG001
APLV066	PROP024	4 Star	1	ORG001
APLV067	PROP024	5 Star	1	ORG001
APLV068	PROP025	Diesel	1	ORG001
APLV069	PROP025	Petrol	1	ORG001
APLV070	PROP025	Gas	1	ORG001
APLV071	PROP026	Single Phase	1	ORG001
APLV072	PROP026	Double Phase	1	ORG001
APLV073	PROP027	Personal	1	ORG001
APLV074	PROP027	Business	1	ORG001
APLV075	PROP027	Enterprise	1	ORG001
APLV076	PROP028	USB	1	ORG001
APLV077	PROP028	 Wi-Fi	1	ORG001
APLV078	PROP028	Bluetooth	1	ORG001
APLV079	PROP030	Laser Printer	1	ORG001
APLV080	PROP031	Small Label	1	ORG001
APLV081	PROP031	Medium Label	1	ORG001
APLV082	PROP031	Large Label	1	ORG001
APL000001	PROP032	192.83.98.1	1	ORG001
APLV086	PROP004	Asus	1	ORG001
APLV087	PROP004	Sony	1	ORG001
APLV088	PROP004	JBL	1	ORG001
APLV089	PROP003	Blue	1	ORG001
APLV090	PROP004	Boss	1	ORG001
APLV091	PROP003	Silver	1	ORG001
APLV092	PROP006	17 GB	1	ORG001
APLV093	PROP006	18 GB	1	ORG001
APLV094	PROP006	19 GB	1	ORG001
APLV095	PROP006	20 GB	1	ORG001
\.


--
-- Data for Name: tblAssetPropValues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetPropValues" (apv_id, asset_id, org_id, asset_type_prop_id, value) FROM stdin;
APV515492786	AST001	ORG001	PROP031	Large Label
APV516611552	AST002	ORG001	PROP004	Asus
APV516812278	AST002	ORG001	PROP030	Laser Printer
APV516962504	AST002	ORG001	PROP006	16 GB
APV517154268	AST002	ORG001	PROP031	Large Label
APV413404337	ASS004	ORG001	PROP004	Lenovo
APV413480997	ASS004	ORG001	PROP005	intel i7
APV413609520	ASS004	ORG001	PROP006	8 GB
APV795254692	ASS005	ORG001	PROP004	Dell
APV206983707	ASS041	ORG001	PROP003	Black
APV207033079	ASS041	ORG001	PROP002	5x3 ft
APV207083451	ASS041	ORG001	PROP001	Glass
APV484632295	ASS059	ORG001	PROP007	27 inch
APV484673137	ASS059	ORG001	PROP008	4K
APV596392890	ASS077	ORG001	PROP004	HP
APV596551618	ASS077	ORG001	PROP030	Laser Printer
APV596596552	ASS077	ORG001	PROP006	16 GB
APV596722193	ASS077	ORG001	PROP031	Small Label
APV098601696	ASS078	ORG001	PROP012	Inkjet
APV098645053	ASS078	ORG001	PROP032	192.83.98.1
APV098689085	ASS078	ORG001	PROP010	Wireless
APV417365250	ASS079	ORG001	PROP004	Dell
APV417404629	ASS079	ORG001	PROP030	Laser Printer
APV417443934	ASS079	ORG001	PROP006	16 GB
APV417482684	ASS079	ORG001	PROP031	Large Label
APV980945429	ASS081	ORG001	PROP010	Wired
APV980948681	ASS081	ORG001	PROP032	192.83.98.1
APV980951429	ASS081	ORG001	PROP012	Laser
APV125960302	AST003	ORG001	PROP004	Dell
APV126238847	AST003	ORG001	PROP030	Laser Printer
APV126418114	AST003	ORG001	PROP006	32 GB
APV126657080	AST003	ORG001	PROP031	Large Label
APV061975601	AST004	ORG001	PROP004	Dell
APV062118499	AST004	ORG001	PROP030	Laser Printer
APV062276414	AST004	ORG001	PROP006	32 GB
APV062432328	AST004	ORG001	PROP031	Large Label
APV063571752	AST005	ORG001	PROP004	Dell
APV063716960	AST005	ORG001	PROP030	Laser Printer
APV063876485	AST005	ORG001	PROP006	32 GB
APV114557695	ASS092	ORG001	PROP004	Dell
APV114595069	ASS092	ORG001	PROP030	Laser Printer
APV114655928	ASS092	ORG001	PROP006	8 GB
APV114706492	ASS092	ORG001	PROP031	Small Label
APV064058492	AST005	ORG001	PROP031	Large Label
APV298083766	ASS099	ORG001	PROP013	600 VA
APV746758318	AST087	ORG001	PROP004	Boss
APV746759335	AST087	ORG001	PROP003	Silver
APV746760661	AST087	ORG001	PROP010	Bluetooth
APV463955312	ASS098	ORG001	PROP003	Black
APV463956323	ASS098	ORG001	PROP010	Bluetooth
APV515049046	AST001	ORG001	PROP004	Dell
APV515206238	AST001	ORG001	PROP030	Laser Printer
APV515351289	AST001	ORG001	PROP006	32 GB
\.


--
-- Data for Name: tblAssetScrapDet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetScrapDet" (asd_id, asset_id, scrapped_date, scrapped_by, location, notes, org_id) FROM stdin;
ASD0001	ASS032	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0002	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0003	ASS029	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0004	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0005	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0006	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0007	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0008	ASS004	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0009	ASS028	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0010	ASS028	2025-08-12 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0011	ASS002	2025-08-12 16:05:07.477	EMP_INT_0002	\N	\N	ORG001
ASD0012	ASS001	2025-08-18 00:00:00	EMP_INT_0001	\N	scrap	ORG001
ASD0013	ASS005	2025-08-18 00:00:00	EMP_INT_0001	\N	scraped	ORG001
ASD0014	ASS025	2025-08-18 00:00:00	EMP_INT_0001	\N	scrap	ORG001
ASD0015	ASS014	2025-08-18 00:00:00	EMP_INT_0001	\N	scrap	ORG001
ASD0016	ASS065	2025-08-22 00:00:00	EMP_INT_0001	\N	scrapped	ORG001
ASD0017	ASS070	2025-08-22 00:00:00	EMP_INT_0003	\N	c	ORG001
ASD0018	ASS071	2025-08-22 00:00:00	EMP_INT_0003	\N	not required 	ORG001
ASD0019	ASS036	2025-09-22 00:00:00	EMP_INT_0003	\N	\N	ORG001
ASD0020	ASS024	2025-09-22 00:00:00	EMP_INT_0003	\N	Nothing	ORG001
ASD0021	ASS092	2025-09-23 00:00:00	EMP_INT_0003	\N	\N	ORG001
ASD0022	AST086	2025-10-17 00:00:00	EMP_INT_0003	\N	\N	ORG001
ASD0023	ASS098	2025-10-17 00:00:00	EMP_INT_0003	\N	\N	ORG001
ASD0024	ASS078	2025-10-23 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0025	ASS022	2025-10-23 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0026	ASS101	2025-10-28 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0027	ASS099	2025-11-04 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0028	AST001	2025-11-04 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0029	ASS081	2025-11-04 00:00:00	EMP_INT_0001	\N	\N	ORG001
ASD0030	ASS033	2025-11-04 00:00:00	EMP_INT_0001	\N	\N	ORG001
\.


--
-- Data for Name: tblAssetTypeProps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetTypeProps" (asset_type_prop_id, org_id, asset_type_id, prop_id) FROM stdin;
ATP081	ORG001	AT048	PROP005
ATP082	ORG001	AT048	PROP006
ATP083	ORG001	AT048	PROP007
ATP084	ORG001	AT049	PROP003
ATP085	ORG001	AT049	PROP002
ATP086	ORG001	AT051	PROP004
ATP087	ORG001	AT051	PROP010
ATP088	ORG001	AT051	PROP003
ATP089	ORG001	AT052	PROP013
ATP090	ORG001	AT054	PROP025
ATP091	ORG001	AT054	PROP003
ATP007	ORG001	AT002	PROP007
ATP008	ORG001	AT002	PROP008
ATP009	ORG001	AT003	PROP009
ATP010	ORG001	AT003	PROP010
ATP001	ORG001	AT018	PROP001
ATP002	ORG001	AT018	PROP002
ATP003	ORG001	AT018	PROP003
ATP011	ORG001	AT004	PROP010
ATP012	ORG001	AT004	PROP011
ATP013	ORG001	AT004	PROP012
ATP014	ORG001	AT005	PROP012
ATP015	ORG001	AT006	PROP005
ATP016	ORG001	AT006	PROP006
ATP017	ORG001	AT007	PROP013
ATP018	ORG001	AT007	PROP014
ATP019	ORG001	AT008	PROP016
ATP020	ORG001	AT008	PROP008
ATP021	ORG001	AT008	PROP017
ATP022	ORG001	AT009	PROP018
ATP023	ORG001	AT009	PROP019
ATP024	ORG001	AT009	PROP020
ATP025	ORG001	AT010	PROP012
ATP026	ORG001	AT010	PROP013
ATP027	ORG001	AT011	PROP008
ATP028	ORG001	AT011	PROP021
ATP029	ORG001	AT011	PROP027
ATP030	ORG001	AT012	PROP023
ATP031	ORG001	AT012	PROP006
ATP032	ORG001	AT013	PROP012
ATP033	ORG001	AT013	PROP024
ATP034	ORG001	AT014	PROP025
ATP035	ORG001	AT014	PROP013
ATP036	ORG001	AT014	PROP026
ATP037	ORG001	AT015	PROP027
ATP038	ORG001	AT016	PROP027
ATP039	ORG001	AT017	PROP012
ATP040	ORG001	AT017	PROP010
ATP052	ORG001	AT001	PROP030
ATP053	ORG001	AT001	PROP031
ATP055	ORG001	AT001	PROP004
ATP056	ORG001	AT001	PROP006
ATP057	ORG001	AT017	PROP032
\.


--
-- Data for Name: tblAssetTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetTypes" (org_id, asset_type_id, int_status, assignment_type, inspection_required, group_required, created_by, created_on, changed_by, changed_on, text, is_child, parent_asset_type_id, maint_required, maint_type_id, maint_lead_type, serial_num_format, last_gen_seq_no, depreciation_type) FROM stdin;
ORG001	AT001	1	user	t	f		2025-08-01	USR001	2025-10-13	Laptop	f	\N	t	MT002		1	23492	\N
ORG001	AT051	1	user	f	f	USR003	2025-09-29	USR003	2025-09-29	head phones	f	\N	t	MT002	internal	\N	4	SL
ORG001	AT053	1	department	f	f	USR003	2025-10-08	USR003	2025-10-09	Software	f	\N	t	MT001	5	\N	3	\N
ORG001	AT005	1	user	t	t		2025-08-01	USR001	2025-11-02	Mouse	t	AT002	t	MT002	5	\N	0	\N
ORG001	AT034	1	user	t	t	USR001	2025-09-05	USR002	2025-09-16	test2	f	\N	t	MT004	5	\N	0	\N
ORG001	AT017	1	department	t	f	USR001	2025-08-04	USR003	2025-08-22	Printer	f	\N	t	\N	\N	\N	3	\N
ORG001	AT030	1	department	f	f	USR003	2025-08-22	USR003	2025-08-22	Mirror	f	\N	f	\N	\N	\N	7	ND
ORG001	AT036	1	department	t	t	USR001	2025-09-11	USR001	2025-09-18	Server	f	\N	t	MT002	5	\N	0	\N
ORG001	AT009	1	department	t	f		2025-08-01	USR001	2025-09-18	Router	f	\N	t	MT003		\N	0	\N
ORG001	AT052	1	department	t	f	USR003	2025-09-29	USR001	2025-11-03	water dispenser	f	\N	f	\N	\N	\N	1	\N
ORG001	AT054	1	department	t	f	USR001	2025-11-08	USR001	2025-11-08	Vehicle	f	\N	t	MT003	5	\N	1	ND
ORG001	AT033	1	user	t	t	USR001	2025-09-05	USR001	2025-09-05	test	f	\N	t	MT004	5	\N	1	ND
ORG001	AT018	1	user	t	f	ADMIN1	2025-07-04	ADMIN1	2025-07-04	Table	f	\N	t	MT002	\N	\N	1	\N
ORG001	AT003	1	user	t	t		2025-08-01		2025-08-01	Monitor	t	AT002	t	MT002	\N	\N	0	\N
ORG001	AT004	1	user	t	t		2025-08-01		2025-08-01	Key Board	t	AT002	t	MT002	\N	\N	0	\N
ORG001	AT006	1	user	t	t		2025-08-01		2025-08-01	CPU	t	AT002	t	MT002	\N	\N	0	\N
ORG001	AT007	1	department	t	f		2025-08-01		2025-08-01	UPS	f	\N	t	MT002	\N	\N	0	\N
ORG001	AT008	1	department	t	t		2025-08-01		2025-08-01	Projector	t	AT002, AT001	t	MT002	\N	\N	0	\N
ORG001	AT010	1	department	t	f		2025-08-01		2025-08-01	Fire Extinguisher	f	\N	t	MT002	\N	\N	0	\N
ORG001	AT011	1	department	t	f		2025-08-01		2025-08-01	CCTV Camera	f	\N	t	MT002	\N	\N	0	\N
ORG001	AT012	1	user	t	f		2025-08-01		2025-08-01	Mobile Phone	f	\N	t	MT003	\N	\N	0	\N
ORG001	AT013	1	department	t	f		2025-08-01		2025-08-01	AC Unit	f	\N	t	MT002	\N	\N	0	\N
ORG001	AT014	1	department	t	f		2025-08-01		2025-08-01	Generator	f	\N	t	MT002	\N	\N	0	\N
ORG001	AT015	1	user	t	f		2025-08-01		2025-08-01	MicroSoft 365 license	f	\N	t	MT001	\N	\N	0	\N
ORG001	AT016	1	user	t	f		2025-08-01		2025-08-01	Anti-virus Subscription 	f	\N	t	MT001	\N	\N	0	\N
ORG001	AT002	1	user	t	t		2025-08-01		2025-08-01	Desktop	f	\N	t	MT002	\N	\N	4	\N
ORG001	AT026	1	department	t	f	USR001	2025-08-05	USR001	2025-08-05	Fan	f	\N	t	MT002	5	\N	9	RB
ORG001	AT035	1	user	f	f	USR003	2025-09-08	USR003	2025-09-08	remote	f	\N	f	\N	\N	\N	2	ND
ORG001	AT048	1	user	f	f	USR001	2025-09-24	USR001	2025-09-24	Gaming Laptops	t	AT001	t	MT001	5	\N	0	SL
ORG001	AT049	1	department	t	t	USR001	2025-09-24	USR001	2025-09-24	Office Chairs	f	\N	f	\N	\N	\N	0	ND
\.


--
-- Data for Name: tblAssetUsageReg; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssetUsageReg" (aug_id, asset_id, usage_counter, created_by, created_on) FROM stdin;
AUG001	ASS106	8000	USR001	2025-11-07 23:46:20.179507
\.


--
-- Data for Name: tblAssets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAssets" (asset_type_id, asset_id, text, serial_number, description, branch_id, purchase_vendor_id, prod_serv_id, maintsch_id, purchased_cost, purchased_on, purchased_by, current_status, warranty_period, parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on, service_vendor_id, expiry_date, current_book_value, salvage_value, accumulated_depreciation, useful_life_years, last_depreciation_calc_date, invoice_no, commissioned_date, depreciation_start_date, project_code, grant_code, insurance_policy_no, gl_account_code, cost_center_code, depreciation_rate, location, insurer, insured_value, insurance_start_date, insurance_end_date, comprehensive_insurance) FROM stdin;
AT009	ASS020	TP-Link Archer C6	RTR-TPLC6-001	NULL	BR002	V005	NULL	NULL	2500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V004	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT016	ASS033	Quick Heal Total Security	AVS-QHTS-002	NULL	BR002	V005	PS007	NULL	3500	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0001	2025-11-04 17:54:56.034458	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT003	ASS008	Samsung 24 inch	MON-SMG24-001	NULL	BR002	V002	PS004	NULL	55000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-08-04 09:56:53.217984	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT004	ASS011	Redgear Blaze	KBD-RGB-002	NULL	BR002	V002	PS004	NULL	1500	2025-07-31 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-08-04 09:56:53.217984	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS004	Laptop	01520800001	Lenevo ThinkPad	BR002	V002	V005	\N	36000	2025-09-01 00:00:00	USR004	SCRAPPED	09-12-25	\N	\N	ORG001	USR001	2025-08-04 09:56:53.217984	EMP_INT_0001	2025-08-12 13:45:56.548365	V005	2024-11-22 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT002	ASS006	Dell OptiPlex 7090	DSP-D7090-001	NULL	BR002	V002	PS001	NULL	55000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	AGH008	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-10-29 11:48:37.966111	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT002	ASS007	HP ProDesk 400 G7	DSP-HPG7-002	NULL	BR002	V002	PS004	NULL	55000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	AGH008	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-10-29 11:48:37.966111	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT004	ASS010	Logitech MX Keys	KBD-LMXK-001	NULL	BR002	V002	PS004	NULL	3000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	AGH013	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-10-29 11:48:38.211116	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT030	ASS094	Mirror	30520900006	Mirror Convex	BR001	V002	V005	\N	2500	2025-09-23 00:00:00	USR023	Active	2 years 	\N	\N	ORG001	USR001	2025-09-23 11:12:37.549493	USR001	2025-09-29 07:53:27.327604	V005	2025-09-23 00:00:00	2500	500	0	5	\N	\N	\N	2025-09-23 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT005	ASS013	HP Wireless 200	MSE-HPW2-002	NULL	BR001	V003	PS004	NULL	1500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	\N	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-11-06 07:00:35.10686	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS001	Apple Laptop	LAP00001	MacBook Pro	BR002	V002	PS001	\N	1200	2025-08-04 00:00:00	EMP_INT_0026	SCRAPPED	3 years	\N	\N	ORG001	EMP006	2025-08-04 12:48:06.437701	EMP_INT_0001	2025-09-29 08:04:00.976622	V002	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT003	ASS009	LG UltraWide 29WL50S	MON-LG29-002	NULL	BR002	V002	PS004	NULL	55000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-08-04 09:56:53.217984	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT010	ASS023	Minimax CO2 4.5kg	FEX-MMCO2-002	Minimax CO2 4.5kg	BR001	V006	PS004	NULL	25000	2025-05-07 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V006	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS002	Dell XPS 13	LTP-DX13-001	Dell Laptop	BR001	V002	\N	\N	45000	2025-07-28 00:00:00	\N	Active	\N	\N	\N	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-10-30 09:10:09.680269	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT010	ASS022	SafePro 6kg ABC	FEX-SF6A-001	SafePro 6kg ABC	BR001	V006	PS004	NULL	25000	2025-05-08 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0001	2025-10-23 07:25:59.323286	V006	2025-10-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT008	ASS018	Epson EB-E01	PRJ-EPS01-001	NULL	BR001	V004	NULL	NULL	1500	2025-10-06 00:00:00	USR003	Active	1 year	NULL	AGH019	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-11-06 07:03:03.822401	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT008	ASS019	BenQ MS560	PRJ-BQ56-002	NULL	BR001	V004	NULL	NULL	1500	2025-10-06 00:00:00	USR003	Active	1 year	NULL	AGH019	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-11-06 07:03:03.822401	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT054	ASS106	Vehicle	54521100001	Mahindra Blazo X 55	BR001	V028	PS023	\N	2500000	2025-11-09 00:00:00	USR001	Active	10 years	\N	\N	ORG001	USR001	2025-11-09 15:59:39.627056	USR001	2025-11-09 15:59:39.627056	V028	2025-11-09 00:00:00	2.5e+06	500000	0	5	\N	\N	\N	2025-11-09 00:00:00	\N	\N	555678	\N	2000	0	Bengaluru	Akash	1500000.00	2025-11-09	2029-12-06	xyz
AT001	ASS003	HP EliteBook 840	LTP-HP84-002	NULL	BR002	V002	PS001	NULL	55000	2025-07-31 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR003	2025-08-04 09:56:53.217984	USR003	2025-08-04 09:56:53.217984	V002	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT011	ASS025	CP Plus Bullet CP-UNC-TA24L2	CCTV-CP24-002	NULL	BR002	V003	PS003	NULL	10000	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0001	2025-08-18 09:01:16.995404	V006	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT012	ASS026	Samsung Galaxy A52	MOB-SGA52-0	NULL	BR002	V003	PS003	NULL	38000	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V006	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT012	ASS027	Apple iPhone 13	MOB-IP13-002	NULL	BR002	V003	PS003	NULL	75000	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V006	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT013	ASS029	Voltas 2 Ton Inverter AC	AC-DK15-002	NULL	BR002	V005	PS004	NULL	66000	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT014	ASS030	Honda EU 7000i	GEN-HND7K-001	NULL	BR002	V005	PS004	NULL	6000	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT015	ASS031	Microsoft 365 Business Standard	LIC-MSBS-001	NULL	BR002	V005	PS007	NULL	3500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT017	ASS034	HP LaserJet Pro MFP M126nw	PRT-HPLJ-001	NULL	BR002	V002	PS007	NULL	2500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT017	ASS035	Canon PIXMA G3000	PRT-HPLJ-002	NULL	BR002	V002	PS007	NULL	2500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT007	ASS016	APC Back-UPS 600VA	UPS-APC6-001	NULL	BR002	V003	NULL	NULL	1500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT007	ASS017	Luminous 1000VA	UPS-LUM1K-002	NULL	BR002	V003	NULL	NULL	1500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS005	Laptop	15208002	Dell PowerEdge	BR002	V002	V004	\N	50000	2025-08-04 00:00:00	USR008	SCRAPPED	12-12-25	\N	\N	ORG001	USR001	2025-08-04 10:03:14.709765	EMP_INT_0001	2025-08-18 08:59:45.828996	V004	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT015	ASS032	Microsoft 365 E3	LIC-MSBS-002	NULL	BR002	V005	PS007	NULL	3500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V005	2025-08-21 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT013	ASS028	Daikin 1.5 Ton Split AC	AC-DK15-001	NULL	BR002	V005	PS004	NULL	66000	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0001	2025-08-12 13:47:17.763365	V005	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT009	ASS021	Netgear R6700AX	RTR-NGAX-0021	NULL	BR002	V005	PS10001	NULL	2500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V004	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT018	ASS036	Godrej Office Table 5ft	TBL-GOD5-001	NULL	BR002	V003	PS007	NULL	8500	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0003	2025-09-22 11:43:28.128263	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT011	ASS024	Hikvision Dome DS-2CD1323G0	CCTV-HKV13-001	NULL	BR002	V003	PS003	NULL	10000	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0003	2025-09-22 11:54:28.030356	V006	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT018	ASS037	Urban Ladder Wooden Table	TBL-GOD5-002	NULL	BR002	V003	PS007	NULL	8500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	NULL	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-08-05 09:56:53.217984	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	AST001	Laptop	01521023483	Sample Asset	BR001	V002	V001	\N	1500	2024-02-04 00:00:00	USR001	SCRAPPED	2 years	\N	\N	ORG001	USR001	2025-09-23 12:52:33.868682	EMP_INT_0001	2025-11-04 12:02:36.052037	V001	2026-01-15 00:00:00	1500	300	0	5	\N	\N	\N	2024-02-04 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT017	ASS081	Printer	17520900003	Special Printer	BR001	V002	\N	\N	10000	2025-09-12 00:00:00	\N	SCRAPPED	3	\N	\N	ORG001	USR003	2025-09-16 11:59:40.931027	EMP_INT_0001	2025-11-04 17:48:47.749498	V004	2029-11-11 00:00:00	10000	0	0	5	\N	\N	\N	2025-09-16 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT005	ASS012	Logitech MX Master 3	MSE-LMX3-001	NULL	BR001	V003	\N	\N	1500	2025-08-04 00:00:00	USR003	Active	1 year	\N	\N	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-11-06 07:00:35.10686	V003	2025-08-27 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT017	ASS078	Printer	17520900002	InkJet Printer	BR001	V002	\N	\N	56000	2025-11-07 00:00:00	USR009	SCRAPPED	09-12-25	\N	\N	ORG001	USR001	2025-09-12 08:34:58.7482	EMP_INT_0001	2025-10-23 07:13:11.373035	\N	2025-11-07 00:00:00	56000	10000	0	5	\N	\N	\N	2025-09-12 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT030	ASS075	Mirror	30520900004	Convex Mirror	BR001	V002	V002	\N	1000	2025-09-05 00:00:00	USR009	Active	09-12-25	\N	\N	ORG001	USR001	2025-09-05 07:41:53.731997	USR001	2025-09-05 07:41:53.731997	V002	2025-09-05 00:00:00	1000	100	0	5	\N	\N	\N	2025-09-05 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS077	Laptop	01520923457	HP TUF H15	BR001	V002	V002	\N	75000	2025-09-11 00:00:00	USR009	Active	12-12-25	\N	\N	ORG001	USR001	2025-09-11 10:46:35.808176	USR001	2025-09-11 10:46:35.808176	V002	2025-09-11 00:00:00	75000	15000	0	5	\N	\N	\N	2025-09-11 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT018	ASS041	Table	18520800001	CocoboloDesk2	BR001	V004	V004	\N	56000	2025-08-20 00:00:00	USR009	Active	09-12-25	\N	\N	ORG001	USR001	2025-08-08 11:56:49.916925	USR001	2025-08-08 11:56:49.916925	V004	2025-09-10 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT026	ASS039	Fan	26520800001	Bajaj Fan 2633	BR002	V002	V005	\N	2500	2025-08-06 00:00:00	USR010	Active	09-12-25	\N	\N	ORG001	USR001	2025-08-08 10:32:47.537777	USR001	2025-08-08 10:32:47.537777	V005	2025-09-12 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT026	ASS065	Fan	26520800007	Usha Maxx Air Ultra 400 Mm 3 Blade Pedestal Fan	BR002	V002	V002	\N	100000	2025-08-13 00:00:00	USR009	SCRAPPED	2 years 	\N	\N	ORG001	USR001	2025-08-13 17:17:52.883626	EMP_INT_0001	2025-08-22 10:44:56.62208	V002	2025-08-13 00:00:00	96666.664	9999.99	3333.3333	5	2025-08-13 22:49:03.9	\N	\N	2025-08-13 00:00:00	\N	\N	\N	\N	\N	40	\N	\N	\N	\N	\N	\N
AT001	ASS092	Laptop	01520923464	Think Pad	BR001	V004	V002	\N	25000	2025-09-22 00:00:00	USR009	SCRAPPED	2 years 	\N	\N	ORG001	USR001	2025-09-22 05:48:34.476936	EMP_INT_0003	2025-09-23 12:57:46.580657	V002	2025-09-22 00:00:00	25000	0	0	5	\N	\N	\N	2025-09-22 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT030	ASS070	Mirror	30520800001		BR002	V002	\N	\N	500.00	2025-08-20 00:00:00	USR003	SCRAPPED	1	\N	\N	ORG001	USR003	2025-08-22 10:39:48.815231	EMP_INT_0003	2025-08-22 10:57:26.278626	\N	2025-08-22 00:00:00	500	0	0	5	\N	\N	\N	2025-08-20 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT002	ASS059	Desktop	02520800004	LG	BR002	V002	V002	\N	450000	2025-08-13 00:00:00	USR009	Active	2 years	\N	AGH012	ORG001	USR001	2025-08-13 15:54:44.253203	USR001	2025-10-29 11:48:38.095892	V002	2025-08-13 00:00:00	450000	90000	0	12	\N	\N	\N	2025-08-13 00:00:00	\N	\N	\N	\N	\N	8.333333	\N	\N	\N	\N	\N	\N
AT001	AST002	Laptop	01521023484	Sample Asset	BR001	V002	V002	\N	1200	2024-02-02 00:00:00	USR002	Active	3 years	\N	\N	ORG001	USR001	2025-09-23 12:52:33.868682	USR002	2025-10-06 12:08:34.46801	V002	2027-01-20 00:00:00	1200	240	0	4	\N	\N	\N	2024-02-02 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT035	ASS082	remote	35520900001	Magic Remote 	BR001	V004	V004	\N	1000	2025-02-05 00:00:00	\N	Active	1	\N	\N	ORG001	USR003	2025-09-17 13:09:06.372675	USR003	2025-09-17 13:09:06.372675	V004	2025-09-18 00:00:00	1000	0	0	5	\N	\N	\N	2025-02-05 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT030	ASS071	Mirror	30520800002	Hand Mirror	BR001	V002	\N	\N	50	2025-08-15 00:00:00	\N	Active	1	\N	\N	ORG001	USR003	2025-08-22 12:15:51.708589	EMP_INT_0003	2025-09-24 11:40:23.194919	\N	2025-08-22 00:00:00	50	0	0	5	\N	\N	\N	2025-08-15 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT030	ASS076	Mirror	30520900005	ConcaVE MIRROR	BR002	V002	\N	\N	2000	2025-05-08 00:00:00	USR009	Active	09-12-25	\N	\N	ORG001	USR001	2025-09-05 09:38:48.44021	USR001	2025-09-12 09:37:38.813218	V002	2025-06-09 00:00:00	2000	500	0	5	\N	\N	\N	2025-09-05 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	ASS079	Laptop	01520923458	Asus TUF	BR001	V002	\N	\N	75000	2025-12-08 00:00:00	USR009	Active	09-12-25	\N	\N	ORG001	USR001	2025-09-12 12:50:17.647188	USR001	2025-09-12 12:51:06.02207	V002	2025-12-08 00:00:00	75000	25000	0	5	\N	\N	\N	2025-09-12 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT001	ASS074	Test Asset	TEST123456	Test asset for API testing	BR001	V001	\N	\N	1000	2024-01-01 00:00:00	\N	Active	\N	\N	\N	ORG001	USR001	2025-09-05 07:38:07.473906	USR001	2025-09-05 07:38:07.473906	V001	\N	1000	100	0	5	\N	\N	\N	2024-01-01 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT001	ASS096	Laptop	01520923475	Asus XP25	BR001	V002	\N	\N	70000	2025-09-25 00:00:00	USR003	Active	1	\N	\N	ORG001	USR001	2025-09-25 09:54:43.568717	USR001	2025-09-25 10:34:52.764862	V002	2027-11-25 00:00:00	70000	0	0	5	\N	\N	\N	2025-09-25 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT010	AST00001	Apple Laptop	ALap00001	MacBook Pro	BR002	V002	PS10001	\N	1200	2025-07-31 00:00:00	EMP_INT_0026	Active	3 years	\N	\N	ORG001	EMP006	2025-08-04 10:17:03.574022	EMP006	2025-09-29 07:53:26.612616	V002	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT051	ASS103	head phones	51521000004	SONY	BR001	V035	\N	\N	24000	2025-10-26 00:00:00	USR001	Active	2 years	\N	\N	ORG001	USR001	2025-10-28 07:28:04.89174	USR001	2025-10-29 10:23:27.213309	V035	2025-10-26 00:00:00	24000	5000	0	5	\N	\N	\N	2025-10-28 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT051	AST085	head phones	51520900001	Studio Pro X	BR001	V008	\N	\N	1500	2025-09-28 00:00:00	USR003	Active	2 years	\N	\N	ORG001	USR003	2025-09-29 11:19:06.666869	USR001	2025-10-29 10:45:36.333985	V008	2026-01-14 00:00:00	1480	300	20	5	2025-10-29 16:15:36.937	\N	\N	2025-09-29 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT051	AST087	head phones	51520900001	Noise Cancel Elite	BR001	V003	V003	\N	1000	2025-09-29 00:00:00	USR003	Active	1 year	\N	\N	ORG001	USR003	2025-09-29 11:19:06.666869	USR001	2025-10-29 10:45:36.653997	V003	2027-01-20 00:00:00	984.375	250	15.625	4	2025-10-29 16:15:37.254	\N	\N	2025-09-29 00:00:00	\N	\N	\N	\N	\N	25	\N	\N	\N	\N	\N	\N
AT006	ASS015	AMD Ryzen 7 5800X	CPU-RY78X-002	NULL	BR002	V003	NULL	NULL	1500	2025-08-05 00:00:00	USR003	Active	1 year	NULL	AGH008	ORG001	USR002	2025-08-05 09:56:53.217984	USR002	2025-10-29 11:48:37.966111	V003	2025-09-08 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT006	ASS014	\tIntel Core i7 12th Gen Boxed	CPU-I7BX-001	NULL	BR002	V003	NULL	NULL	1500	2025-08-05 00:00:00	USR003	SCRAPPED	1 year	NULL	AGH008	ORG001	USR002	2025-08-05 09:56:53.217984	EMP_INT_0001	2025-10-29 11:48:37.966111	V003	2025-08-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT051	AST086	head phones	51520900001	Bass Boost 500	BR001	V001	\N	\N	1200	2025-09-29 00:00:00	USR003	SCRAPPED	3 years	\N	\N	ORG001	USR003	2025-09-29 11:19:06.666869	EMP_INT_0003	2025-10-17 07:31:24.802252	V021	2027-01-20 00:00:00	1200	240	0	4	\N	\N	\N	2025-09-29 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT051	ASS098	head phones	51520900002	Head Phone Set 1	BR001	V020	PS021	\N	20000	2025-09-30 00:00:00	USR003	SCRAPPED	\N	\N	\N	ORG001	USR003	2025-09-30 11:57:43.918891	EMP_INT_0003	2025-10-17 07:31:26.84324	V020	2026-10-01 00:00:00	20000	0	0	5	\N	\N	\N	2025-09-30 00:00:00	\N	\N	\N	\N	\N	20	\N	\N	\N	\N	\N	\N
AT052	ASS099	water dispenser	52521000001	Aqaufina	BR001	V035	\N	\N	50	2025-10-11 00:00:00	USR003	SCRAPPED	1	\N	\N	ORG001	USR016	2025-10-08 10:40:07.138807	EMP_INT_0001	2025-11-04 08:42:06.359783	V035	2026-10-01 00:00:00	50	0	0	5	\N	\N	\N	2025-10-11 00:00:00	\N	\N	\N	\N	\N	20	Bengaluru	\N	\N	\N	\N	\N
AT001	AST005	Laptop	01521023492	Sample Asset	BR001	V002	V001	\N	1500	2024-02-04 00:00:00	USR001	Active	2 years	\N	\N	ORG001	USR001	2025-10-07 12:44:24.811688	USR001	2025-10-07 12:44:24.811688	V001	2026-01-15 00:00:00	1500	300	0	5	\N	\N	\N	2024-02-04 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	AST003	Laptop	01521023490	Sample Asset	BR001	V002	V001	\N	1500	2024-02-04 00:00:00	USR001	Active	2 years	\N	\N	ORG001	USR002	2025-10-07 04:39:52.515154	USR002	2025-10-07 05:15:28.552882	V001	2026-01-15 00:00:00	1500	300	0	5	\N	\N	\N	2024-02-04 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT035	AST101	remote	35521000002	magic remote	BR001	V001	V001	\N	1500	2024-01-15 00:00:00	USR001	Active	2 years	\N	\N	ORG001	USR003	2025-10-07 12:37:19.850877	USR003	2025-10-07 12:37:19.850877	V001	2026-01-15 00:00:00	1500	300	0	5	\N	\N	\N	2024-01-15 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT001	AST004	Laptop	01521023491	Sample Asset	BR001	V002	V001	\N	1500	2024-02-04 00:00:00	USR001	Active	2 years	\N	\N	ORG001	USR001	2025-10-07 12:44:24.811688	USR001	2025-10-07 12:44:24.811688	V001	2026-01-15 00:00:00	1500	300	0	5	\N	\N	\N	2024-02-04 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT053	ASS100	Software	53521000001	Microsoft 365 Business Standard	BR001	V001	PS013	\N	500	2024-09-15 00:00:00	USR003	Active	2	\N	\N	ORG001	USR003	2025-10-08 11:06:47.184839	USR003	2025-10-08 11:06:47.184839	V001	2025-11-01 00:00:00	500	0	0	5	\N	\N	\N	2024-11-01 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
AT053	ASS101	Software	53521000002	Antivirus Software.	BR001	V022	\N	\N	500	2025-10-17 00:00:00	USR023	Active	2	\N	\N	ORG001	USR003	2025-10-08 11:07:58.829371	EMP_INT_0001	2025-10-28 12:14:24.673829	V035	2025-12-05 00:00:00	500	0	0	5	\N	\N	\N	2024-12-12 00:00:00	\N	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: tblAuditLogConfig; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAuditLogConfig" (alc_id, app_id, event_id, enabled, reporting_required, reporting_email, description, org_id) FROM stdin;
ALC027	DEPARTMENTSASSET	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC028	DEPARTMENTSASSET	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC025	DEPARTMENTSADMIN	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC002	ASSETS	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC003	ASSETS	Eve007	t	t	nivethakaliyappan@gmail.com		ORG001
ALC004	ASSETS	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC059	LOGOUT	Eve002	t	t	aakashjaiswal0706@gmail.com	\N	ORG001
ALC060	RESETPASSWORD	Eve003	t	t	aakashjaiswal0706@gmail.com	\N	ORG001
ALC043	GROUPASSET	Eve007	t	t	nivethakaliyappan@gmail.com	NULL	ORG001
ALC031	ASSETTYPES	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC032	ASSETTYPES	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC058	LOGIN	Eve001	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC044	GROUPASSET	Eve008	t	t	nivethakaliyappan@gmail.com	NULL	ORG001
ALC045	GROUPASSET	Eve009	t	t	nivethakaliyappan@gmail.com	NULL	ORG001
ALC033	ASSETTYPES	Eve007	t	t	nivethakaliyappan@gmail.com		ORG001
ALC022	DEPARTMENTS	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC023	DEPARTMENTS	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC024	DEPARTMENTS	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC018	VENDORS	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC019	VENDORS	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC020	VENDORS	Eve007	t	t	nivethakaliyappan@gmail.com		ORG001
ALC021	VENDORS	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC014	USERS	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC015	USERS	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC016	USERS	Eve007	t	t	nivethakaliyappan@gmail.com		ORG001
ALC017	USERS	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC001	ASSETS	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC034	ASSETTYPES	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC035	DEPTASSIGNMENT	Eve012	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC026	DEPARTMENTSADMIN	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC046	ALCREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC008	ORGANIZATIONS	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC009	ORGANIZATIONS	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC010	BRANCHES	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC011	BRANCHES	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC012	BRANCHES	Eve007	t	t	nivethakaliyappan@gmail.com		ORG001
ALC013	BRANCHES	Eve008	t	t	nivethakaliyappan@gmail.com		ORG001
ALC036	DEPTASSIGNMENT	Eve013	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC037	DEPTASSIGNMENT	Eve004	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC038	EMPASSIGNMENT	Eve012	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC039	EMPASSIGNMENT	Eve013	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC040	EMPASSIGNMENT	Eve004	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC041	GROUPASSET	Eve005	t	t	nivethakaliyappan@gmail.com	NULL	ORG001
ALC029	PRODSERV	Eve005	t	t	nivethakaliyappan@gmail.com		ORG001
ALC030	PRODSERV	Eve006	t	t	nivethakaliyappan@gmail.com		ORG001
ALC042	GROUPASSET	Eve006	t	t	nivethakaliyappan@gmail.com	NULL	ORG001
ALC007	ASSETS	Eve011	f	t	nivethakaliyappan@gmail.com		ORG001
ALC005	ASSETS	Eve009	t	t	nivethakaliyappan@gmail.com		ORG001
ALC006	ASSETS	Eve010	t	t	nivethakaliyappan@gmail.com		ORG001
ALC047	ALCREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC048	AREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC049	AREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC052	AVREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC053	AVREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC054	AWFHREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC055	AWFHREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC056	BHREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC057	BHREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC050	MHREPORT	Eve023	t	t	nivethakaliyappan@gmail.com	\N	ORG001
ALC051	MHREPORT	Eve024	t	t	nivethakaliyappan@gmail.com	\N	ORG001
\.


--
-- Data for Name: tblAuditLogs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblAuditLogs" (al_id, user_id, app_id, event_id, text, created_on, org_id) FROM stdin;
AL001	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-15 12:53:39.955216	ORG001
AL002	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 12:57:00.195826	ORG001
AL003	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-15 13:02:43.660635	ORG001
AL004	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 13:07:31.432663	ORG001
AL005	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-15 13:08:09.280084	ORG001
AL006	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 13:08:28.376282	ORG001
AL007	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-15 13:08:37.458327	ORG001
AL008	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 13:14:40.098187	ORG001
AL009	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 13:20:51.229922	ORG001
AL010	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-15 13:21:00.121703	ORG001
AL011	USR001	RESETPASSWORD	Eve003	Reset Password: Password Reset Successfully	2025-09-15 13:22:12.016762	ORG001
AL012	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-15 13:23:10.026561	ORG001
AL013	USR002	ORGANIZATIONS	Eve005	Create: Organization Created	2025-09-16 05:23:39.462605	ORG001
AL014	USR002	ORGANIZATIONS	Eve008	Update: Organization Updated	2025-09-16 05:24:32.849562	ORG001
AL015	USR002	DEPTASSIGNMENT	Eve004	History: Department Assignment History Viewed	2025-09-16 05:32:02.693758	ORG001
AL016	USR002	ORGANIZATIONS	Eve008	Update: Organization Updated	2025-09-16 05:40:52.602545	ORG001
AL017	USR002	BRANCHES	Eve007	Download: Branches Data Downloaded (3 items)	2025-09-16 05:52:14.364923	ORG001
AL018	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-16 06:15:40.785282	ORG001
AL019	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-16 06:16:47.072639	ORG001
AL020	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-16 06:19:16.520452	ORG001
AL021	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-16 06:19:24.889635	ORG001
AL022	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-16 06:19:39.490358	ORG001
AL023	USR002	BRANCHES	Eve006	Delete: 1 Branch(es) Deleted (1 items)	2025-09-16 06:52:02.520884	ORG001
AL024	USR002	USERS	Eve007	Download: Users Data Downloaded (15 items)	2025-09-16 07:02:24.72473	ORG001
AL025	USR002	USERS	Eve008	Update: User Updated	2025-09-16 07:03:35.926959	ORG001
AL026	USR002	USERS	Eve005	Create: Add User Form Opened	2025-09-16 07:03:46.582983	ORG001
AL027	USR002	USERS	Eve008	Update: User Updated	2025-09-16 07:13:22.341789	ORG001
AL028	USR002	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-16 07:43:18.147715	ORG001
AL029	USR002	VENDORS	Eve006	Delete: 3 Vendor(s) Deleted (3 items)	2025-09-16 07:44:46.406111	ORG001
AL030	USR002	VENDORS	Eve008	Update: Vendor Updated	2025-09-16 07:45:55.489131	ORG001
AL031	USR002	DEPARTMENTS	Eve005	Create: Department Created	2025-09-16 07:57:09.90542	ORG001
AL032	USR002	DEPARTMENTS	Eve008	Update: Department Updated	2025-09-16 07:58:08.252053	ORG001
AL033	USR002	DEPARTMENTS	Eve006	Delete: Department Deleted	2025-09-16 07:58:16.742408	ORG001
AL038	USR002	PRODSERV	Eve005	Create: Product Created	2025-09-16 09:46:29.785869	ORG001
AL039	USR002	PRODSERV	Eve005	Create: Service Created	2025-09-16 09:49:31.328757	ORG001
AL040	USR002	ASSETTYPES	Eve007	Download: Asset Types Data Downloaded (25 items)	2025-09-16 10:01:01.12038	ORG001
AL041	USR002	ASSETTYPES	Eve005	Create: Add Asset Type Form Opened	2025-09-16 10:01:15.814005	ORG001
AL042	USR002	ASSETTYPES	Eve005	Create: Add Asset Type Form Opened	2025-09-16 10:01:57.066121	ORG001
AL043	USR002	ASSETTYPES	Eve006	Delete: 1 Asset Type(s) Deleted (1 items)	2025-09-16 10:02:20.68116	ORG001
AL044	USR002	ASSETTYPES	Eve005	Create: Add Asset Type Form Opened	2025-09-16 10:02:35.257017	ORG001
AL045	USR002	ASSETTYPES	Eve005	Create: Asset Type Created	2025-09-16 10:08:28.533266	ORG001
AL046	USR002	ASSETTYPES	Eve006	Delete: 1 Asset Type(s) Deleted (1 items)	2025-09-16 10:09:31.625933	ORG001
AL047	USR002	ASSETTYPES	Eve005	Create: Asset Type Created	2025-09-16 10:15:04.034588	ORG001
AL048	USR002	ASSETTYPES	Eve007	Download: Asset Types Data Downloaded (26 items)	2025-09-16 10:15:14.828438	ORG001
AL049	USR002	ASSETTYPES	Eve006	Delete: 1 Asset Type(s) Deleted (1 items)	2025-09-16 10:25:05.042327	ORG001
AL050	USR002	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-09-16 10:31:52.789402	ORG001
AL051	USR002	ASSETTYPES	Eve007	Download: Asset Types Data Downloaded (25 items)	2025-09-16 11:03:27.747634	ORG001
AL052	USR002	DEPTASSIGNMENT	Eve004	History: Department Assignment History Viewed	2025-09-16 11:08:18.511828	ORG001
AL053	USR002	DEPTASSIGNMENT	Eve012	Assign: Asset Assigned to Department - Asset: ASS071	2025-09-16 11:08:46.306833	ORG001
AL054	USR002	DEPTASSIGNMENT	Eve013	Unassign: Asset Unassigned from Department - Asset: ASS071	2025-09-16 11:10:09.227856	ORG001
AL055	USR002	DEPTASSIGNMENT	Eve004	History: Department Assignment History Viewed	2025-09-16 11:10:18.612599	ORG001
AL056	USR002	DEPTASSIGNMENT	Eve012	Assign: Asset Assigned to Department - Asset: ASS071	2025-09-16 11:10:28.575261	ORG001
AL057	USR002	ORGANIZATIONS	Eve008	Update: Organization Updated	2025-09-16 11:10:58.325298	ORG001
AL058	USR002	ORGANIZATIONS	Eve005	Create: Organization Created	2025-09-16 11:11:22.721954	ORG001
AL059	USR002	ASSETTYPES	Eve007	Download: Asset Types Data Downloaded (25 items)	2025-09-16 11:11:51.931774	ORG001
AL060	USR002	ASSETTYPES	Eve005	Create: Asset Type Created	2025-09-16 11:12:07.502515	ORG001
AL061	USR002	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-09-16 11:12:21.601003	ORG001
AL062	USR002	ASSETTYPES	Eve006	Delete: 1 Asset Type(s) Deleted (1 items)	2025-09-16 11:12:33.228262	ORG001
AL063	USR002	BRANCHES	Eve008	Update: Branch Updated	2025-09-16 11:13:14.024001	ORG001
AL064	USR002	BRANCHES	Eve008	Update: Branch Updated	2025-09-16 11:13:25.002304	ORG001
AL065	USR002	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-16 11:20:02.286343	ORG001
AL066	USR002	BRANCHES	Eve007	Download: Branches Data Downloaded (3 items)	2025-09-16 11:20:08.213381	ORG001
AL073	USR002	VENDORS	Eve008	Update: Vendor Updated	2025-09-16 11:24:43.368659	ORG001
AL074	USR002	VENDORS	Eve007	Download: Vendors Data Downloaded (13 items)	2025-09-16 11:25:15.807948	ORG001
AL075	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-16 11:55:11.621963	ORG001
AL076	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-16 11:56:11.202298	ORG001
AL077	USR003	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS081 (Serial: 17520900003)	2025-09-16 11:59:41.12442	ORG001
AL078	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-16 12:00:35.530765	ORG001
AL079	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-16 12:40:20.678175	ORG001
AL080	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-16 13:18:27.53476	ORG001
AL081	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 05:46:06.855579	ORG001
AL082	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 06:04:52.902427	ORG001
AL083	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 06:13:47.369925	ORG001
AL084	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 06:15:27.448073	ORG001
AL085	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:09.23477	ORG001
AL086	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:09.351729	ORG001
AL087	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:09.559793	ORG001
AL088	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:09.644165	ORG001
AL089	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:09.699689	ORG001
AL090	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:15.837263	ORG001
AL091	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 07:45:25.105794	ORG001
AL092	USR002	ORGANIZATIONS	Eve008	Update: Organization Updated	2025-09-17 08:24:48.643695	ORG001
AL093	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:19:31.707204	ORG001
AL094	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:20:15.735568	ORG001
AL095	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 09:27:01.091236	ORG001
AL096	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:29:33.774754	ORG001
AL097	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:35:10.379014	ORG001
AL098	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:36:49.723306	ORG001
AL099	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:36:52.129068	ORG001
AL100	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:37:16.639	ORG001
AL101	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:37:22.284763	ORG001
AL102	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:37:32.271856	ORG001
AL103	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:38:03.835682	ORG001
AL104	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:38:24.307829	ORG001
AL105	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:38:31.193994	ORG001
AL106	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:38:44.105693	ORG001
AL107	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:38:51.331134	ORG001
AL108	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:50:02.570036	ORG001
AL109	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:50:33.870438	ORG001
AL110	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:50:43.191246	ORG001
AL111	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:51:02.40011	ORG001
AL112	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:55:55.015133	ORG001
AL113	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 09:56:40.799924	ORG001
AL114	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 09:59:56.175344	ORG001
AL115	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 10:00:19.629908	ORG001
AL116	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 10:22:53.449434	ORG001
AL117	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 10:24:54.020457	ORG001
AL118	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 10:27:09.639858	ORG001
AL119	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 10:31:24.722338	ORG001
AL120	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 10:39:44.351757	ORG001
AL121	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 10:40:23.529392	ORG001
AL122	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 10:40:51.637519	ORG001
AL123	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 10:41:54.479199	ORG001
AL124	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 10:46:07.17488	ORG001
AL125	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 11:00:07.322404	ORG001
AL126	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 11:11:54.422817	ORG001
AL127	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 11:55:12.649738	ORG001
AL128	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS012 (Serial: MSE-LMX3-001)	2025-09-17 11:58:54.380375	ORG001
AL129	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS081 (Serial: 17520900003)	2025-09-17 12:21:03.610207	ORG001
AL130	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS081 (Serial: 17520900003)	2025-09-17 12:21:20.857245	ORG001
AL131	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS081 (Serial: 17520900003)	2025-09-17 12:24:02.937478	ORG001
AL132	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS081 (Serial: 17520900003)	2025-09-17 12:24:20.54724	ORG001
AL133	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 12:24:32.751378	ORG001
AL134	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 12:35:42.912256	ORG001
AL135	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-17 12:42:40.166085	ORG001
AL136	USR001	ASSETS	Eve007	Download (52 items)	2025-09-17 12:56:33.264874	ORG001
AL137	USR002	USERS	Eve005	Create: Add User Form Opened	2025-09-17 13:03:41.90115	ORG001
AL138	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 13:04:48.185647	ORG001
AL139	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:05:03.280087	ORG001
AL140	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-17 13:06:16.57654	ORG001
AL141	USR003	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS082 (Serial: 35520900001)	2025-09-17 13:09:06.587017	ORG001
AL142	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-17 13:09:29.550512	ORG001
AL143	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-17 13:11:21.368863	ORG001
AL144	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:12:07.133299	ORG001
AL145	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:14:59.309492	ORG001
AL146	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:15:31.61436	ORG001
AL147	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:17:52.385167	ORG001
AL148	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-17 13:18:41.47135	ORG001
AL149	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:05:19.151403	ORG001
AL150	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 06:09:23.923561	ORG001
AL151	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 06:09:26.747334	ORG001
AL152	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 06:10:17.932385	ORG001
AL153	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 06:10:27.432454	ORG001
AL154	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 06:10:36.997032	ORG001
AL155	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 06:10:41.183989	ORG001
AL156	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 06:10:48.153424	ORG001
AL157	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 06:10:56.044524	ORG001
AL158	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:14:11.560545	ORG001
AL159	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:14:26.075791	ORG001
AL160	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:14:48.885895	ORG001
AL161	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:17:03.220565	ORG001
AL162	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:29:39.536216	ORG001
AL163	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:34:31.436942	ORG001
AL164	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:39:56.095964	ORG001
AL165	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 06:40:03.061695	ORG001
AL166	USR003	DEPTASSIGNMENT	Eve013	Unassign: Asset Unassigned from Department - Asset: ASS020	2025-09-18 07:45:31.128473	ORG001
AL167	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 07:45:35.446801	ORG001
AL168	USR003	DEPTASSIGNMENT	Eve004	History: Department Assignment History Viewed	2025-09-18 07:45:41.810296	ORG001
AL169	USR003	DEPTASSIGNMENT	Eve012	Assign: Asset Assigned to Department - Asset: ASS020	2025-09-18 07:46:31.49367	ORG001
AL170	USR018	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 08:15:20.818229	ORG001
AL171	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 08:16:29.662292	ORG001
AL172	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 08:16:36.517856	ORG001
AL173	USR001	DEPTASSIGNMENT	Eve004	History: Department Assignment History Viewed	2025-09-18 09:29:07.555357	ORG001
AL174	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 09:34:17.589669	ORG001
AL175	USR001	DEPTASSIGNMENT	Eve013	Unassign: Asset Unassigned from Department - Asset: ASS071	2025-09-18 09:35:08.474834	ORG001
AL176	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 09:40:08.542008	ORG001
AL177	USR001	USERS	Eve008	Update: User Role Updated	2025-09-18 09:50:55.587566	ORG001
AL178	USR001	DEPTASSIGNMENT	Eve012	Assign: Asset Assigned to Department - Asset: ASS070	2025-09-18 09:53:45.299067	ORG001
AL179	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 09:58:56.699852	ORG001
AL180	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 10:00:15.276074	ORG001
AL181	USR001	DEPTASSIGNMENT	Eve013	Unassign: Asset Unassigned from Department - Asset: ASS070	2025-09-18 10:05:07.576131	ORG001
AL182	USR001	EMPASSIGNMENT	Eve012	Assign: Asset Assigned to Employee - Asset: ASS079	2025-09-18 10:09:01.617751	ORG001
AL183	USR001	EMPASSIGNMENT	Eve013	Unassign: Asset Unassigned from Employee - Asset: ASS079	2025-09-18 10:09:14.495331	ORG001
AL184	USR001	ORGANIZATIONS	Eve008	Update: Organization Updated	2025-09-18 10:16:26.369887	ORG001
AL185	USR001	ORGANIZATIONS	Eve005	Create: Organization Created	2025-09-18 10:17:21.189619	ORG001
AL186	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 10:34:45.855491	ORG001
AL187	USR001	ASSETTYPES	Eve007	Download: Asset Types Data Downloaded (25 items)	2025-09-18 10:35:39.231046	ORG001
AL188	USR001	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-09-18 10:49:24.969892	ORG001
AL189	USR001	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-09-18 10:49:32.441894	ORG001
AL190	USR001	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-09-18 10:49:39.815733	ORG001
AL191	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 10:56:06.443026	ORG001
AL192	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 11:18:41.689724	ORG001
AL193	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:20:29.801981	ORG001
AL194	USR001	DEPARTMENTS	Eve005	Create: Department Created	2025-09-18 11:21:38.936029	ORG001
AL195	USR001	DEPARTMENTS	Eve008	Update: Department Updated	2025-09-18 11:21:50.383106	ORG001
AL196	USR001	DEPARTMENTS	Eve006	Delete: Department Deleted	2025-09-18 11:21:57.06318	ORG001
AL197	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:26:13.180361	ORG001
AL198	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:26:18.313371	ORG001
AL199	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:26:26.75144	ORG001
AL200	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:27:45.87924	ORG001
AL201	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:27:54.063918	ORG001
AL202	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:28:28.904955	ORG001
AL203	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:29:55.800964	ORG001
AL204	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:30:48.634928	ORG001
AL205	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:37:15.804575	ORG001
AL206	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 11:49:19.145166	ORG001
AL207	USR001	USERS	Eve006	Delete: User Role Deleted	2025-09-18 11:49:55.823291	ORG001
AL208	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:50:09.14206	ORG001
AL209	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:50:12.616082	ORG001
AL210	USR001	USERS	Eve008	Update: User Role Updated	2025-09-18 11:51:51.188562	ORG001
AL211	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:51:54.92387	ORG001
AL212	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:51:57.387537	ORG001
AL213	USR001	USERS	Eve008	Update: User Role Updated	2025-09-18 11:55:34.400779	ORG001
AL214	USR022	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 11:55:39.102419	ORG001
AL215	USR022	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 11:55:41.220943	ORG001
AL216	USR001	USERS	Eve006	Delete: User Role Deleted	2025-09-18 11:58:04.625299	ORG001
AL221	USR001	BRANCHES	Eve008	Update: Branch Updated	2025-09-18 12:23:56.786556	ORG001
AL222	USR001	BRANCHES	Eve008	Update: Branch Updated	2025-09-18 12:24:03.139394	ORG001
AL223	USR001	BRANCHES	Eve008	Update: Branch Updated	2025-09-18 12:24:08.201207	ORG001
AL224	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-18 12:24:17.881304	ORG001
AL225	USR001	BRANCHES	Eve007	Download: Branches Data Downloaded (3 items)	2025-09-18 12:24:26.161257	ORG001
AL226	USR001	VENDORS	Eve007	Download: Vendors Data Downloaded (15 items)	2025-09-18 12:31:40.970399	ORG001
AL227	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 12:48:27.474519	ORG001
AL228	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 12:48:43.948668	ORG001
AL229	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 12:49:37.371657	ORG001
AL230	USR001	USERS	Eve006	Delete: User Role Deleted	2025-09-18 12:51:44.126353	ORG001
AL231	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 12:53:07.420171	ORG001
AL232	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 12:53:18.39708	ORG001
AL233	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 12:53:21.272437	ORG001
AL234	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 12:53:32.948702	ORG001
AL235	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 12:53:40.104716	ORG001
AL236	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 12:53:43.890248	ORG001
AL237	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 12:55:53.43024	ORG001
AL238	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-18 12:56:44.277064	ORG001
AL239	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-18 12:56:48.573657	ORG001
AL240	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 13:02:31.722385	ORG001
AL241	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-18 13:02:46.069247	ORG001
AL242	USR001	VENDORS	Eve007	Download: Vendors Data Downloaded (15 items)	2025-09-18 13:02:55.794336	ORG001
AL243	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-18 13:03:18.892995	ORG001
AL244	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-18 13:04:28.54226	ORG001
AL245	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-18 13:35:25.435786	ORG001
AL246	USR001	VENDORS	Eve007	Download: Vendors Data Downloaded (15 items)	2025-09-18 13:45:05.016093	ORG001
AL247	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-18 18:10:32.570899	ORG001
AL248	USR001	USERS	Eve005	Create: Add User Form Opened	2025-09-19 05:23:22.71911	ORG001
AL249	USR001	USERS	Eve007	Download: Users Data Downloaded (18 items)	2025-09-19 05:23:29.446014	ORG001
AL250	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 05:51:31.806985	ORG001
AL251	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 06:07:55.223216	ORG001
AL252	USR001	USERS	Eve007	Download: Users Data Downloaded (18 items)	2025-09-19 06:16:11.442323	ORG001
AL253	USR001	USERS	Eve005	Create: Add User Form Opened	2025-09-19 06:16:24.629473	ORG001
AL254	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 06:45:16.044277	ORG001
AL255	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 07:14:12.039354	ORG001
AL256	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 07:15:28.797711	ORG001
AL257	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-19 07:24:21.713519	ORG001
AL258	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 07:24:24.484585	ORG001
AL259	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 07:33:18.629084	ORG001
AL260	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 07:54:04.613805	ORG001
AL261	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 07:59:47.431243	ORG001
AL262	USR001	USERS	Eve005	Create: Add User Form Opened	2025-09-19 08:15:27.523404	ORG001
AL263	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-19 08:17:23.644824	ORG001
AL264	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 08:17:27.979488	ORG001
AL265	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-19 08:29:39.159986	ORG001
AL266	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-19 08:30:26.975984	ORG001
AL267	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-19 08:30:56.671363	ORG001
AL268	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-19 09:03:12.056348	ORG001
AL269	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 09:03:14.094628	ORG001
AL270	USR001	USERS	Eve008	Update: Benutzer aktualisiert	2025-09-19 09:03:49.23818	ORG001
AL271	USR001	USERS	Eve005	Create: Benutzer hinzufügen-Formular geöffnet	2025-09-19 09:03:51.5182	ORG001
AL272	USR001	USERS	Eve007	Download: Benutzerdaten heruntergeladen (18 items)	2025-09-19 09:04:05.216373	ORG001
AL273	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 09:09:18.779305	ORG001
AL274	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 09:24:20.801155	ORG001
AL275	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 09:51:54.097757	ORG001
AL276	USR001	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS089 (Serial: 33520900001)	2025-09-19 09:53:03.206675	ORG001
AL277	USR001	ASSETS	Eve006	Delete - Assets: ASS089 (1 items)	2025-09-19 10:23:15.579811	ORG001
AL278	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 10:31:21.525672	ORG001
AL279	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 10:39:04.120509	ORG001
AL280	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-19 10:42:13.423682	ORG001
AL281	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-19 10:44:52.170191	ORG001
AL282	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 10:50:44.674357	ORG001
AL283	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-19 10:56:37.11419	ORG001
AL284	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 10:59:32.516465	ORG001
AL285	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:06:00.294031	ORG001
AL286	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:15:12.436253	ORG001
AL287	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:16:55.508531	ORG001
AL288	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:18:21.612769	ORG001
AL289	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:19:50.634479	ORG001
AL290	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:20:38.527283	ORG001
AL291	USR001	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-19 11:21:29.535487	ORG001
AL292	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-19 11:21:45.120124	ORG001
AL293	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 14:46:24.567261	ORG001
AL294	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-19 14:49:05.341048	ORG001
AL295	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-19 14:49:16.444903	ORG001
AL296	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-21 13:22:44.891777	ORG001
AL297	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-21 13:22:55.542313	ORG001
AL298	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-21 13:22:56.829222	ORG001
AL299	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-21 13:25:17.310772	ORG001
AL300	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-21 13:25:43.695098	ORG001
AL301	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 05:26:55.879796	ORG001
AL302	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 05:32:17.246173	ORG001
AL303	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 05:37:09.351594	ORG001
AL304	USR001	ASSETS	Eve005	Create - Asset: ASS092 (Serial: 01520923464)	2025-09-22 05:48:35.96676	ORG001
AL305	USR001	ASSETS	Eve009	Add Document - Asset: ASS092	2025-09-22 05:52:03.82845	ORG001
AL306	USR001	ASSETS	Eve006	Delete - Assets: ASS091 (1 items)	2025-09-22 05:52:50.079496	ORG001
AL307	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 05:53:53.043317	ORG001
AL308	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 06:06:06.887628	ORG001
AL309	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:21:26.571546	ORG001
AL310	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:24:41.313652	ORG001
AL311	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:24:43.793226	ORG001
AL312	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:30:46.19977	ORG001
AL313	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:30:57.338303	ORG001
AL314	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:31:10.330078	ORG001
AL315	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:31:14.88481	ORG001
AL316	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:42:20.581252	ORG001
AL317	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:42:24.286464	ORG001
AL318	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:53:00.754538	ORG001
AL319	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:53:07.753932	ORG001
AL320	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:53:48.358524	ORG001
AL321	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-22 06:54:18.23118	ORG001
AL322	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 06:55:08.381681	ORG001
AL323	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 06:55:53.122078	ORG001
AL324	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-22 06:56:05.551855	ORG001
AL325	USR001	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-22 06:56:34.323163	ORG001
AL326	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 07:28:36.188554	ORG001
AL327	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 07:28:40.731278	ORG001
AL328	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 07:28:57.101019	ORG001
AL329	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 07:29:01.937767	ORG001
AL330	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 07:32:13.130959	ORG001
AL331	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 07:32:16.166508	ORG001
AL332	USR002	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-22 07:33:09.786094	ORG001
AL333	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 09:27:27.94627	ORG001
AL334	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 09:28:57.013511	ORG001
AL335	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 09:32:37.72533	ORG001
AL336	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 09:32:51.289675	ORG001
AL337	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-22 11:53:57.288167	ORG001
AL338	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-22 12:47:52.900059	ORG001
AL339	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-22 13:13:27.548462	ORG001
AL340	USR001	ASSETS	Eve009	Add Document - Asset: ASS092	2025-09-22 13:13:47.981295	ORG001
AL341	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 13:13:53.718937	ORG001
AL342	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 13:15:29.430309	ORG001
AL343	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-22 13:15:57.888081	ORG001
AL344	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-22 13:16:02.132691	ORG001
AL345	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-22 13:16:14.439182	ORG001
AL346	USR002	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-23 06:22:17.413414	ORG001
AL347	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 06:34:47.843833	ORG001
AL348	USR002	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-23 06:51:43.726711	ORG001
AL349	USR002	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-23 08:09:54.109665	ORG001
AL350	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 09:57:56.916975	ORG001
AL351	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 10:49:10.197401	ORG001
AL352	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 10:51:52.831376	ORG001
AL353	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 10:55:28.353323	ORG001
AL354	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:03:17.866569	ORG001
AL355	USR001	ASSETS	Eve005	Create - Asset: ASS092	2025-09-23 11:10:26.119332	ORG001
AL356	USR001	ASSETS	Eve007	Download - Asset: ASS092	2025-09-23 11:10:38.26482	ORG001
AL357	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:11:09.886241	ORG001
AL358	USR001	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS094 (Serial: 30520900006)	2025-09-23 11:12:39.136831	ORG001
AL359	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:13:23.581043	ORG001
AL360	USR001	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS095 (Serial: 30520900007)	2025-09-23 11:14:12.119933	ORG001
AL361	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-23 11:14:20.896032	ORG001
AL362	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-23 11:14:25.711059	ORG001
AL363	USR001	ASSETS	Eve006	Delete - Assets: ASS095 (1 items)	2025-09-23 11:14:34.850159	ORG001
AL364	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:14:41.120384	ORG001
AL365	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-23 11:15:25.123933	ORG001
AL366	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-23 11:15:29.807194	ORG001
AL367	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:20:20.761863	ORG001
AL368	USR001	PRODSERV	Eve005	Create: Product Created	2025-09-23 11:25:48.474711	ORG001
AL369	USR001	PRODSERV	Eve005	Create: Product Created	2025-09-23 11:27:19.52627	ORG001
AL370	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:29:33.525115	ORG001
AL371	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:43:54.099029	ORG001
AL372	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:48:47.38182	ORG001
AL373	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 11:57:51.795822	ORG001
AL374	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 12:01:52.368345	ORG001
AL375	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 12:17:18.247867	ORG001
AL376	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-23 12:41:02.916703	ORG001
AL377	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 13:06:46.558054	ORG001
AL378	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 13:06:55.671809	ORG001
AL379	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-23 13:07:13.917545	ORG001
AL380	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 04:38:52.440123	ORG001
AL381	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-24 05:11:32.456016	ORG001
AL382	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 05:43:38.249981	ORG001
AL383	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 05:43:43.301656	ORG001
AL384	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 05:43:48.980087	ORG001
AL385	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:00:09.018301	ORG001
AL386	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 08:00:19.449569	ORG001
AL387	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:00:23.465876	ORG001
AL388	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 08:00:30.327344	ORG001
AL389	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:00:33.420062	ORG001
AL390	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 08:00:37.315808	ORG001
AL391	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:00:41.514979	ORG001
AL392	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 08:10:22.382237	ORG001
AL393	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:10:26.826076	ORG001
AL394	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 08:10:30.31844	ORG001
AL395	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 08:10:34.204856	ORG001
AL396	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-24 10:53:33.583611	ORG001
AL397	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 11:08:51.430874	ORG001
AL398	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 11:08:55.536538	ORG001
AL399	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 11:38:04.993885	ORG001
AL400	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 11:38:30.003112	ORG001
AL401	USR003	ASSETS	Eve010	Save - Asset: ASS071 (Serial: 30520800002)	2025-09-24 11:40:07.836951	ORG001
AL402	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS071 (Serial: 30520800002)	2025-09-24 11:40:23.532217	ORG001
AL403	USR001	ASSETS	Eve010	Save - Asset: ASS065 (Serial: 26520800007)	2025-09-24 11:51:30.874556	ORG001
AL404	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-24 12:12:37.264864	ORG001
AL405	USR003	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-24 12:18:09.616943	ORG001
AL406	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-24 12:19:07.371184	ORG001
AL407	USR003	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-24 12:21:10.536523	ORG001
AL408	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-24 12:22:33.019019	ORG001
AL409	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-24 12:29:58.912253	ORG001
AL410	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 12:35:21.940947	ORG001
AL411	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 12:35:26.839902	ORG001
AL412	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 12:39:48.601783	ORG001
AL413	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 12:39:53.266142	ORG001
AL414	USR003	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 12:40:12.47633	ORG001
AL415	USR003	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 12:41:03.960948	ORG001
AL416	USR002	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 12:41:45.218203	ORG001
AL417	USR001	EMPASSIGNMENT	Eve004	History: Employee Assignment History Viewed	2025-09-24 12:51:06.034391	ORG001
AL418	USR003	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 13:00:00.841947	ORG001
AL419	USR003	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 13:04:10.372559	ORG001
AL420	USR002	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 13:04:55.566084	ORG001
AL421	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-24 13:05:54.023669	ORG001
AL422	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-24 13:06:47.926819	ORG001
AL423	USR002	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-24 13:10:03.098108	ORG001
AL424	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 05:56:31.175932	ORG001
AL425	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 05:56:35.42147	ORG001
AL426	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 09:12:17.476831	ORG001
AL427	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 09:12:47.890432	ORG001
AL428	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 09:51:16.785555	ORG001
AL429	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 09:51:25.388727	ORG001
AL430	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 09:51:46.898	ORG001
AL431	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 09:51:54.843986	ORG001
AL432	USR001	PRODSERV	Eve005	Create: Product Created	2025-09-25 09:53:29.726792	ORG001
AL433	USR001	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS096 (Serial: 01520923475)	2025-09-25 09:54:43.792257	ORG001
AL434	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS096 (Serial: 01520923475)	2025-09-25 10:05:36.066697	ORG001
AL435	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 10:11:10.618524	ORG001
AL436	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 10:15:03.548128	ORG001
AL437	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 10:15:07.644133	ORG001
AL438	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 10:26:18.230892	ORG001
AL439	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 10:26:55.285161	ORG001
AL440	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 10:34:32.027415	ORG001
AL441	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS096 (Serial: 01520923475)	2025-09-25 10:34:52.964008	ORG001
AL442	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 10:36:29.17389	ORG001
AL443	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 10:36:33.224712	ORG001
AL444	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 10:36:42.521897	ORG001
AL445	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 10:36:44.114647	ORG001
AL446	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 10:44:30.010227	ORG001
AL447	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 10:46:49.860317	ORG001
AL448	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 10:46:52.444151	ORG001
AL449	USR002	ASSETS	Eve005	Create: Anlage-Hinzufügen-Formular geöffnet	2025-09-25 11:04:24.595416	ORG001
AL450	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-25 11:04:54.140154	ORG001
AL451	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 11:09:52.974184	ORG001
AL452	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 11:40:45.764792	ORG001
AL453	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 11:40:48.101275	ORG001
AL454	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 11:41:41.636086	ORG001
AL455	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 11:42:11.926546	ORG001
AL456	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 11:42:46.85385	ORG001
AL457	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 11:42:50.263733	ORG001
AL458	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 11:43:43.355574	ORG001
AL459	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 11:43:47.068064	ORG001
AL460	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 12:06:01.399924	ORG001
AL461	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 12:06:05.113138	ORG001
AL462	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 12:18:03.033375	ORG001
AL463	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 12:18:05.704854	ORG001
AL464	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-25 12:21:37.412512	ORG001
AL465	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-25 12:21:39.892983	ORG001
AL466	USR001	ASSETS	Eve009	Add Document - Asset: ASS074	2025-09-25 12:27:49.772053	ORG001
AL467	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:35:16.278635	ORG001
AL468	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:38:13.303603	ORG001
AL469	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:39:12.69203	ORG001
AL470	USR001	VENDORS	Eve006	Delete: 1 Vendor(s) Deleted (1 items)	2025-09-25 12:40:25.197069	ORG001
AL471	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:44:12.529341	ORG001
AL472	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:55:41.009256	ORG001
AL473	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 12:55:58.678625	ORG001
AL474	USR001	PRODSERV	Eve005	Create: Service Created	2025-09-25 12:56:56.072816	ORG001
AL475	USR001	VENDORS	Eve006	Delete: 1 Vendor(s) Deleted (1 items)	2025-09-25 13:00:43.351012	ORG001
AL476	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:00:49.482977	ORG001
AL477	USR001	VENDORS	Eve006	Delete: 1 Vendor(s) Deleted (1 items)	2025-09-25 13:10:01.268325	ORG001
AL478	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:10:02.842467	ORG001
AL479	USR001	PRODSERV	Eve005	Create: Service Created	2025-09-25 13:12:57.967589	ORG001
AL480	USR001	VENDORS	Eve006	Delete: 1 Vendor(s) Deleted (1 items)	2025-09-25 13:13:17.704186	ORG001
AL481	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:13:25.410071	ORG001
AL482	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:15:19.548794	ORG001
AL483	USR001	VENDORS	Eve006	Delete: 1 Vendor(s) Deleted (1 items)	2025-09-25 13:18:30.911532	ORG001
AL484	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:18:33.34153	ORG001
AL485	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-25 13:18:34.012422	ORG001
AL486	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-26 06:40:43.186592	ORG001
AL487	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 06:56:51.424681	ORG001
AL488	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 06:56:55.988052	ORG001
AL489	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 07:27:59.051763	ORG001
AL490	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 07:28:04.01242	ORG001
AL491	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-26 08:19:43.800457	ORG001
AL492	USR001	EMPASSIGNMENT	Eve012	Assign: Asset Assigned to Employee - Asset: AST002	2025-09-26 09:13:17.191475	ORG001
AL493	USR001	EMPASSIGNMENT	Eve012	Assign: Asset Assigned to Employee - Asset: AST001	2025-09-26 09:13:27.125081	ORG001
AL494	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 09:58:39.37106	ORG001
AL495	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 09:58:42.573094	ORG001
AL496	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:10:11.464338	ORG001
AL497	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:10:14.655767	ORG001
AL498	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:21:37.693193	ORG001
AL499	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:21:43.991238	ORG001
AL500	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:22:05.398026	ORG001
AL501	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:22:24.825941	ORG001
AL502	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:22:42.731122	ORG001
AL503	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:23:05.412541	ORG001
AL504	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:23:14.264102	ORG001
AL505	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:23:24.213579	ORG001
AL506	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:35:10.231292	ORG001
AL507	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:35:18.905309	ORG001
AL508	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:36:25.290104	ORG001
AL509	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:36:32.590186	ORG001
AL510	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:39:05.238461	ORG001
AL511	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:39:08.023033	ORG001
AL512	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-26 10:47:31.796939	ORG001
AL513	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:56:36.203281	ORG001
AL514	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:56:48.748261	ORG001
AL515	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 10:57:05.761588	ORG001
AL516	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 10:57:21.109176	ORG001
AL517	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:05:03.928852	ORG001
AL518	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:05:05.209156	ORG001
AL519	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:05:06.923	ORG001
AL520	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:10:56.06835	ORG001
AL521	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:11:00.087617	ORG001
AL522	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:12:31.524297	ORG001
AL523	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:12:40.672203	ORG001
AL524	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:13:03.086953	ORG001
AL525	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:13:05.746654	ORG001
AL526	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:13:41.501823	ORG001
AL527	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:13:47.401514	ORG001
AL528	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:57:34.725389	ORG001
AL529	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:57:37.380933	ORG001
AL530	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:57:41.810624	ORG001
AL531	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:57:44.982159	ORG001
AL532	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:58:20.03878	ORG001
AL533	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 11:58:24.573843	ORG001
AL534	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:58:27.452724	ORG001
AL535	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-26 11:58:43.653637	ORG001
AL536	USR003	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-26 12:44:14.702101	ORG001
AL537	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-26 19:03:14.560961	ORG001
AL538	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 05:22:07.50648	ORG001
AL539	USR001	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-29 05:24:22.398515	ORG001
AL540	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 05:24:44.920083	ORG001
AL541	USR001	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-29 05:24:49.216491	ORG001
AL542	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 06:17:13.749224	ORG001
AL543	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 06:17:20.82543	ORG001
AL544	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 06:32:10.088152	ORG001
AL545	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 06:32:10.106364	ORG001
AL546	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 06:32:20.208162	ORG001
AL547	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 06:53:38.622597	ORG001
AL548	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 06:53:49.029045	ORG001
AL549	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 07:07:17.099213	ORG001
AL550	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 07:28:40.632795	ORG001
AL551	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 07:52:21.21143	ORG001
AL552	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 07:53:15.222783	ORG001
AL553	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 07:53:18.614267	ORG001
AL554	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 08:06:24.282841	ORG001
AL555	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 08:06:28.401692	ORG001
AL556	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 08:07:28.077331	ORG001
AL557	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 08:12:46.642769	ORG001
AL558	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-29 09:39:11.126037	ORG001
AL559	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 09:39:13.812302	ORG001
AL560	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 09:47:00.347665	ORG001
AL563	USR001	ASSETS	Eve006	Delete - Assets: ASS061 (1 items)	2025-09-29 10:32:30.766722	ORG001
AL564	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 10:56:10.370956	ORG001
AL565	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900001)	2025-09-29 11:24:06.852958	ORG001
AL566	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900001)	2025-09-29 11:24:34.147636	ORG001
AL567	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:05:49.222197	ORG001
AL568	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-29 12:07:18.395459	ORG001
AL569	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:09:47.26095	ORG001
AL570	USR001	PRODSERV	Eve005	Create: Product Created	2025-09-29 12:10:21.858658	ORG001
AL571	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-29 12:12:24.749988	ORG001
AL572	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:13:23.217659	ORG001
AL573	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST086 (Serial: 51520900001)	2025-09-29 12:22:13.391685	ORG001
AL574	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900001)	2025-09-29 12:22:24.163195	ORG001
AL575	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST086 (Serial: 51520900001)	2025-09-29 12:22:40.488612	ORG001
AL576	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900002)	2025-09-29 12:22:53.798956	ORG001
AL577	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900001)	2025-09-29 12:25:13.197052	ORG001
AL578	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:25:15.239253	ORG001
AL579	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:36:19.158399	ORG001
AL580	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-29 12:40:27.730919	ORG001
AL581	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-29 12:40:38.832163	ORG001
AL582	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:40:48.589887	ORG001
AL583	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:43:09.614024	ORG001
AL584	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:43:12.308339	ORG001
AL585	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-29 12:58:10.888238	ORG001
AL586	USR001	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS097 (Serial: 01520923476)	2025-09-29 13:04:44.4208	ORG001
AL587	USR001	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST085 (Serial: 51520900001)	2025-09-29 13:28:04.698216	ORG001
AL588	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 05:16:23.928592	ORG001
AL589	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 05:36:05.825589	ORG001
AL590	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 05:45:39.66502	ORG001
AL591	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 05:56:49.611635	ORG001
AL592	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 09:16:51.631311	ORG001
AL593	USR001	ASSETS	Eve009	Add Document - Asset: ASS023	2025-09-30 09:34:17.965755	ORG001
AL594	USR001	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-09-30 10:03:04.195781	ORG001
AL595	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 10:10:05.954646	ORG001
AL596	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 10:14:53.858598	ORG001
AL597	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 10:15:15.981697	ORG001
AL598	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 10:16:44.083074	ORG001
AL599	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 10:18:04.584577	ORG001
AL600	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 10:18:07.730677	ORG001
AL601	USR001	ASSETTYPES	Eve005	Create: Asset Type Created	2025-09-30 10:53:51.683759	ORG001
AL602	USR001	ASSETTYPES	Eve006	Delete: 1 Asset Type(s) Deleted (1 items)	2025-09-30 10:54:01.335289	ORG001
AL603	USR001	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-09-30 11:17:03.398646	ORG001
AL604	USR001	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-09-30 11:18:55.075451	ORG001
AL605	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:19:41.66698	ORG001
AL606	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:20:05.173156	ORG001
AL607	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:20:29.168925	ORG001
AL608	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:20:52.138411	ORG001
AL609	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:21:05.602572	ORG001
AL610	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:21:25.64221	ORG001
AL611	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:21:42.32437	ORG001
AL612	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:31:35.871674	ORG001
AL613	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:31:36.416073	ORG001
AL614	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:32:02.748746	ORG001
AL615	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:32:29.555234	ORG001
AL616	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:32:33.013314	ORG001
AL617	USR001	VENDORS	Eve008	Update: Vendor Updated	2025-09-30 11:33:02.372524	ORG001
AL618	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 11:41:49.026908	ORG001
AL619	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 11:54:38.970168	ORG001
AL620	USR003	PRODSERV	Eve005	Create: Product Created	2025-09-30 11:55:23.742201	ORG001
AL621	USR003	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS098 (Serial: 51520900002)	2025-09-30 11:57:44.128231	ORG001
AL622	USR003	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST086 (Serial: 51520900001)	2025-09-30 12:02:35.621231	ORG001
AL623	USR001	USERS	Eve005	Create: Assign Roles Screen Opened	2025-09-30 12:12:51.850967	ORG001
AL624	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:31:28.950202	ORG001
AL625	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:31:40.714108	ORG001
AL626	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:32:51.396508	ORG001
AL627	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:32:56.15379	ORG001
AL628	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:32:59.260976	ORG001
AL629	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:33:14.211856	ORG001
AL630	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:33:39.527507	ORG001
AL631	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:34:17.994955	ORG001
AL632	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:42:59.722773	ORG001
AL633	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:43:14.065279	ORG001
AL634	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:43:24.481642	ORG001
AL635	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:45:36.127819	ORG001
AL636	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:46:01.123222	ORG001
AL637	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:46:48.145531	ORG001
AL638	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:47:06.733477	ORG001
AL639	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:54:02.849089	ORG001
AL640	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:54:25.05922	ORG001
AL641	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-09-30 12:59:16.43024	ORG001
AL642	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-09-30 12:59:19.445181	ORG001
AL643	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 13:24:35.811085	ORG001
AL644	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-09-30 13:25:26.220946	ORG001
AL645	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-06 05:08:53.528405	ORG001
AL646	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 05:20:37.902002	ORG001
AL647	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 05:20:40.745224	ORG001
AL648	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 06:13:29.005555	ORG001
AL649	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 06:13:34.610786	ORG001
AL650	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 08:16:53.986481	ORG001
AL651	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 10:02:32.175235	ORG001
AL652	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 10:15:45.667793	ORG007
AL653	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 11:15:38.494399	ORG007
AL654	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 11:16:28.470607	ORG007
AL655	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 11:27:09.298328	ORG007
AL656	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 11:27:11.90939	ORG001
AL657	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 11:44:17.02986	ORG001
AL658	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:04:29.247164	ORG001
AL659	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:04:37.239523	ORG001
AL660	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:04:58.574024	ORG001
AL661	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:06:17.278353	ORG001
AL662	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:06:25.446366	ORG001
AL663	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:06:28.549222	ORG001
AL664	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:06:52.044244	ORG001
AL665	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:06:59.771197	ORG001
AL666	USR016	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-10-06 12:07:03.071417	ORG001
AL667	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:19:27.562536	ORG001
AL668	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:19:34.262134	ORG001
AL669	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:28:17.245716	ORG001
AL670	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:28:23.941526	ORG001
AL671	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:33:27.693355	ORG001
AL672	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:33:29.82275	ORG001
AL673	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:54:34.287321	ORG001
AL674	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:54:40.938766	ORG001
AL675	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:56:11.437551	ORG001
AL676	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:56:17.517353	ORG001
AL677	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 12:58:11.965127	ORG001
AL678	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 12:58:14.670619	ORG001
AL679	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-06 13:25:00.52913	ORG001
AL680	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-06 13:25:21.602775	ORG001
AL681	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST003 (Serial: 01521023489)	2025-10-07 04:52:47.615817	ORG001
AL682	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST003 (Serial: 01521023489)	2025-10-07 04:54:32.592632	ORG001
AL683	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST003 (Serial: 01521023489)	2025-10-07 04:56:10.223384	ORG001
AL684	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST003 (Serial: 01521023489)	2025-10-07 04:56:34.624265	ORG001
AL685	USR002	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: AST003 (Serial: 01521023489)	2025-10-07 05:13:06.627136	ORG001
AL686	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 07:25:07.746003	ORG001
AL687	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 07:25:14.030811	ORG001
AL688	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 07:37:39.362973	ORG001
AL689	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 07:38:15.355747	ORG001
AL690	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 07:43:59.682321	ORG001
AL691	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 07:44:02.460278	ORG001
AL692	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 08:10:44.282543	ORG001
AL693	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 08:10:54.987402	ORG001
AL694	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 08:21:36.37792	ORG001
AL695	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 08:22:21.318798	ORG001
AL696	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 08:47:51.972121	ORG001
AL697	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 08:48:26.983084	ORG001
AL698	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 08:53:40.046533	ORG001
AL699	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 08:53:44.536608	ORG001
AL700	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 09:03:21.330982	ORG001
AL701	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 09:09:26.663721	ORG001
AL702	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 09:30:24.611236	ORG001
AL703	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 09:30:31.766996	ORG001
AL704	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 09:31:24.376389	ORG001
AL705	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 09:31:30.497079	ORG001
AL706	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 09:47:23.175014	ORG001
AL707	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 09:47:25.877812	ORG001
AL708	USR003	USERS	Eve005	Create: Assign Roles Screen Opened	2025-10-07 09:47:34.217046	ORG001
AL709	USR003	USERS	Eve008	Update: User Role Updated	2025-10-07 09:52:45.569489	ORG001
AL710	USR003	USERS	Eve005	Create: Assign Roles Screen Opened	2025-10-07 09:53:19.351681	ORG001
AL711	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 10:07:44.188232	ORG001
AL712	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 10:07:51.194206	ORG001
AL713	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 10:10:41.525113	ORG001
AL714	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 10:10:43.932859	ORG001
AL715	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 10:11:14.133714	ORG001
AL716	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 10:11:40.669341	ORG001
AL717	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 10:17:06.546269	ORG001
AL718	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 10:17:22.156465	ORG001
AL719	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 11:25:59.745833	ORG001
AL720	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 11:26:03.8622	ORG001
AL721	USR019	BRANCHES	Eve005	Create: Add Branch Form Opened	2025-10-07 11:48:42.282936	ORG001
AL722	USR019	VENDORS	Eve005	Create: Add Vendor Form Opened	2025-10-07 11:48:48.3967	ORG001
AL723	USR019	USERS	Eve005	Create: Assign Roles Screen Opened	2025-10-07 11:49:07.626597	ORG001
AL724	USR002	USERS	Eve005	Create: Assign Roles Screen Opened	2025-10-07 11:53:32.389119	ORG001
AL725	USR019	USERS	Eve005	Create: Assign Roles Screen Opened	2025-10-07 11:53:38.801179	ORG001
AL726	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 12:10:19.874323	ORG001
AL727	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:10:34.159124	ORG001
AL728	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 12:13:31.711556	ORG001
AL729	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:14:11.755366	ORG001
AL730	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 12:19:28.604644	ORG001
AL731	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:19:38.609691	ORG001
AL732	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 12:21:48.415541	ORG001
AL733	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:22:00.735453	ORG001
AL734	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:25:06.510683	ORG001
AL735	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-07 12:45:55.887287	ORG001
AL736	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-07 12:46:07.70906	ORG001
AL737	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 04:44:51.93556	ORG001
AL738	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 05:02:22.611921	ORG001
AL739	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 05:02:33.404853	ORG001
AL740	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:07:03.981389	ORG001
AL741	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:07:16.713588	ORG001
AL742	USR020	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:18:11.596948	ORG001
AL743	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:35:01.600415	ORG001
AL744	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:35:06.347377	ORG001
AL745	USR020	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:41:43.960202	ORG001
AL034	USR002	DEPARTMENTSADMIN	Eve005	Create: Department Admin Created	2025-09-16 09:26:12.877759	ORG001
AL035	USR002	DEPARTMENTSADMIN	Eve006	Delete: Department Admin Removed	2025-09-16 09:26:46.813767	ORG001
AL067	USR002	DEPARTMENTSADMIN	Eve005	Create: Department Admin Created	2025-09-16 11:21:22.687009	ORG001
AL068	USR002	DEPARTMENTSADMIN	Eve006	Delete: Department Admin Removed	2025-09-16 11:22:04.047504	ORG001
AL069	USR002	DEPARTMENTSADMIN	Eve005	Create: Department Admin Created	2025-09-16 11:22:59.926469	ORG001
AL070	USR002	DEPARTMENTSADMIN	Eve006	Delete: Department Admin Removed	2025-09-16 11:23:09.371997	ORG001
AL217	USR001	DEPARTMENTSADMIN	Eve005	Create: Department Admin Created	2025-09-18 12:08:39.565953	ORG001
AL218	USR001	DEPARTMENTSADMIN	Eve006	Delete: Department Admin Removed	2025-09-18 12:08:49.277697	ORG001
AL746	USR020	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:42:12.84228	ORG001
AL747	USR020	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:42:24.819563	ORG001
AL748	USR021	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:42:56.101299	ORG001
AL749	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:51:39.828062	ORG001
AL750	USR021	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:52:00.875268	ORG001
AL751	USR021	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:52:18.783826	ORG001
AL752	USR021	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 06:52:41.608113	ORG001
AL753	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 06:52:52.093471	ORG001
AL754	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 09:55:15.967771	ORG001
AL755	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:34:32.000409	ORG001
AL756	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:34:37.213894	ORG001
AL757	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:38:28.199239	ORG001
AL758	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:38:32.904635	ORG001
AL759	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 10:38:40.333548	ORG001
AL760	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:39:02.846083	ORG001
AL761	USR016	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS099 (Serial: 52521000001)	2025-10-08 10:40:07.384577	ORG001
AL762	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 10:40:14.547404	ORG001
AL763	USR016	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-10-08 10:40:21.868028	ORG001
AL764	USR002	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-10-08 10:42:00.048092	ORG001
AL765	USR016	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS099 (Serial: 52521000001)	2025-10-08 10:42:55.258719	ORG001
AL766	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:44:27.631064	ORG001
AL767	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:44:42.189764	ORG001
AL768	USR016	ASSETS	Eve008	Update: Asset Updated Successfully - Asset: ASS099 (Serial: 52521000001)	2025-10-08 10:44:58.315029	ORG001
AL769	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 10:45:00.50703	ORG001
AL770	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 10:45:14.970778	ORG001
AL771	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:46:20.228815	ORG001
AL772	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:46:30.719665	ORG001
AL773	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:47:52.844771	ORG001
AL774	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:47:59.176058	ORG001
AL775	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:48:56.226727	ORG001
AL776	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:49:00.500151	ORG001
AL777	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:50:12.55141	ORG001
AL778	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:50:19.066298	ORG001
AL779	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:52:56.367792	ORG001
AL780	USR019	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:53:02.421354	ORG001
AL781	USR019	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:53:35.565524	ORG001
AL782	USR021	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:55:41.042261	ORG001
AL783	USR021	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 10:59:20.40334	ORG001
AL784	USR020	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 10:59:30.179959	ORG001
AL785	USR020	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 11:00:51.39502	ORG001
AL786	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 11:00:54.290436	ORG001
AL787	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 11:00:59.529914	ORG001
AL788	USR021	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 11:01:06.26797	ORG001
AL789	USR003	ASSETTYPES	Eve005	Create: Asset Type Created	2025-10-08 11:04:50.104727	ORG001
AL790	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 11:05:04.761006	ORG001
AL791	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 11:05:19.111354	ORG001
AL792	USR003	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS100 (Serial: 53521000001)	2025-10-08 11:06:47.40793	ORG001
AL793	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 11:06:51.26283	ORG001
AL794	USR003	ASSETS	Eve010	Save: Asset Saved Successfully - Asset: ASS101 (Serial: 53521000002)	2025-10-08 11:07:59.062753	ORG001
AL795	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 12:25:14.611923	ORG001
AL796	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 12:25:45.156687	ORG001
AL797	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 12:27:22.01194	ORG001
AL798	USR016	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 12:27:24.011921	ORG001
AL799	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 12:35:10.717386	ORG001
AL800	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 12:36:48.649745	ORG001
AL801	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 12:36:54.479501	ORG001
AL802	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-08 12:40:52.867455	ORG001
AL803	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 12:48:56.850585	ORG001
AL804	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 12:49:37.355733	ORG001
AL805	USR021	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 12:58:18.241246	ORG001
AL806	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 12:58:23.435598	ORG001
AL807	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 13:05:21.032436	ORG001
AL808	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 13:06:16.434881	ORG001
AL809	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-08 13:28:38.977381	ORG001
AL810	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-08 13:29:49.712259	ORG001
AL811	USR003	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-09 06:04:48.764908	ORG001
AL812	USR003	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-09 06:06:17.7088	ORG001
AL813	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 06:24:11.375281	ORG001
AL814	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 06:24:16.970792	ORG001
AL815	USR021	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 06:24:26.071802	ORG001
AL816	USR021	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 06:24:31.435761	ORG001
AL817	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 06:24:40.926354	ORG001
AL818	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 06:33:39.593952	ORG001
AL819	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 07:07:24.093585	ORG001
AL820	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 07:08:26.43259	ORG001
AL821	USR003	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-09 07:13:32.870984	ORG001
AL822	USR003	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-09 07:18:31.074231	ORG001
AL823	USR003	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-09 07:19:09.767553	ORG001
AL824	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 07:28:35.004341	ORG001
AL825	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 07:43:00.138341	ORG001
AL826	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 07:43:09.938267	ORG001
AL827	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 07:55:13.967278	ORG001
AL828	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 07:55:18.219117	ORG001
AL829	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 08:01:00.114505	ORG001
AL830	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 08:22:48.746218	ORG001
AL831	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 08:22:53.538826	ORG001
AL832	USR016	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 10:54:20.422815	ORG001
AL833	USR016	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 10:54:32.447169	ORG001
AL834	USR017	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 10:55:04.9106	ORG001
AL835	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 10:55:25.445249	ORG001
AL836	USR017	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-09 10:55:26.144918	ORG001
AL837	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-09 10:55:35.892334	ORG001
AL838	USR003	DEPTASSIGNMENT	Eve012	Assign: Asset Assigned to Department - Asset: ASS023	2025-10-09 11:07:45.920395	ORG001
AL839	USR003	DEPTASSIGNMENT	Eve013	Unassign: Asset Unassigned from Department - Asset: ASS023	2025-10-09 11:08:01.753968	ORG001
AL840	USR001	EMPASSIGNMENT	Eve004	History: Employee Assignment History Viewed	2025-10-13 04:47:27.534363	ORG001
AL841	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-13 04:52:47.349466	ORG001
AL842	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-13 04:52:59.193453	ORG001
AL843	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-13 05:01:59.037904	ORG001
AL844	USR001	ASSETTYPES	Eve008	Update: Asset Type Updated	2025-10-13 05:20:23.734553	ORG001
AL036	USR002	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-09-16 09:33:53.783373	ORG001
AL037	USR002	DEPARTMENTSASSET	Eve006	Delete: Department Asset Type Mapping Deleted	2025-09-16 09:34:58.274153	ORG001
AL071	USR002	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-09-16 11:23:41.161119	ORG001
AL072	USR002	DEPARTMENTSASSET	Eve006	Delete: Department Asset Type Mapping Deleted	2025-09-16 11:23:50.923891	ORG001
AL219	USR001	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-09-18 12:15:02.516286	ORG001
AL220	USR001	DEPARTMENTSASSET	Eve006	Delete: Department Asset Type Mapping Deleted	2025-09-18 12:15:13.818994	ORG001
AL561	USR001	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-09-29 09:59:55.764364	ORG001
AL562	USR001	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-09-29 10:19:14.270243	ORG001
AL845	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-13 08:15:55.905807	ORG001
AL846	USR002	DEPARTMENTSASSET	Eve005	Create: Department Asset Type Mapping Created	2025-10-13 08:19:35.203679	ORG001
AL847	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 06:48:54.699087	ORG001
AL848	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-14 11:11:40.735818	ORG001
AL849	USR003	EMPASSIGNMENT	Eve012	Assign: Asset Assigned to Employee - Asset: AST004	2025-10-14 11:16:10.888265	ORG001
AL850	USR003	EMPASSIGNMENT	Eve004	History: Employee Assignment History Viewed	2025-10-14 11:16:27.854733	ORG001
AL851	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 11:34:04.74421	ORG001
AL852	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 11:38:24.590702	ORG001
AL853	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-14 12:20:04.726279	ORG001
AL854	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-14 12:44:13.999705	ORG001
AL855	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 12:44:18.280507	ORG001
AL856	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 12:44:38.619179	ORG001
AL857	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-14 13:26:07.758376	ORG001
AL858	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-14 15:00:52.624701	ORG001
AL859	USR015	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 15:00:55.951067	ORG001
AL860	USR015	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-14 15:01:02.962412	ORG001
AL861	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-14 15:14:25.24838	ORG001
AL862	USR003	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-14 15:17:38.888314	ORG001
AL863	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 03:10:42.878761	ORG001
AL864	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 03:20:37.701908	ORG001
AL865	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 03:22:46.471471	ORG001
AL866	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 03:58:47.569769	ORG001
AL867	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 03:59:25.402123	ORG001
AL868	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 11:29:17.531852	ORG001
AL869	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 11:29:42.691409	ORG001
AL870	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 11:29:47.454036	ORG001
AL871	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 11:29:58.114422	ORG001
AL872	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 11:56:53.458181	ORG001
AL873	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 11:57:07.29702	ORG001
AL874	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 12:18:53.546261	ORG001
AL875	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 12:35:49.197726	ORG001
AL876	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 12:36:10.273433	ORG001
AL877	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 13:46:23.246362	ORG001
AL878	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 13:46:27.302602	ORG001
AL879	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-15 13:46:59.491488	ORG001
AL880	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-15 13:47:03.164334	ORG001
AL881	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:12:06.524502	ORG001
AL882	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:12:10.376407	ORG001
AL883	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:12:27.850323	ORG001
AL884	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:12:30.842263	ORG001
AL885	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:19:43.078097	ORG001
AL886	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:19:46.437389	ORG001
AL887	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:19:59.565804	ORG001
AL888	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:20:04.071984	ORG001
AL889	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:20:45.133659	ORG001
AL890	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:20:48.491122	ORG001
AL891	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:27:07.369486	ORG001
AL892	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:27:10.348501	ORG001
AL893	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:47:57.965781	ORG001
AL894	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:48:01.31412	ORG001
AL895	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 05:48:15.214823	ORG001
AL896	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 05:48:18.574543	ORG001
AL897	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 06:17:56.602694	ORG001
AL898	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 06:18:00.182799	ORG001
AL899	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 06:18:15.04364	ORG001
AL900	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 06:18:18.545233	ORG001
AL901	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:18:14.015625	ORG001
AL902	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:22:25.030529	ORG001
AL903	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:22:28.139387	ORG001
AL904	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:22:47.192932	ORG001
AL905	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:22:50.377844	ORG001
AL906	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:29:43.129513	ORG001
AL907	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:32:25.216807	ORG001
AL908	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:33:00.671348	ORG001
AL909	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:33:02.674851	ORG001
AL910	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:33:09.78923	ORG001
AL911	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:43:03.563678	ORG001
AL912	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:43:08.284065	ORG001
AL913	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:43:39.843855	ORG001
AL914	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:43:43.680173	ORG001
AL915	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:45:11.759647	ORG001
AL916	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:45:15.483924	ORG001
AL917	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:45:35.986279	ORG001
AL918	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:45:40.167652	ORG001
AL919	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:49:52.592953	ORG001
AL920	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:53:49.387853	ORG001
AL921	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:53:56.966172	ORG001
AL922	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 07:54:16.946794	ORG001
AL923	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 07:54:21.164652	ORG001
AL924	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:02:25.434433	ORG001
AL925	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:02:29.551923	ORG001
AL926	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:02:45.760696	ORG001
AL927	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:02:49.674659	ORG001
AL928	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:04:22.876891	ORG001
AL929	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:04:26.86848	ORG001
AL930	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:04:51.624608	ORG001
AL931	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:04:55.518676	ORG001
AL932	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:19:56.493354	ORG001
AL933	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:20:00.397107	ORG001
AL934	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 08:24:52.657189	ORG001
AL935	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 08:25:27.331808	ORG001
AL936	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 09:30:55.863481	ORG001
AL937	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 09:31:00.075724	ORG001
AL938	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 09:32:10.422494	ORG001
AL939	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 09:32:15.379295	ORG001
AL940	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 09:33:13.065296	ORG001
AL941	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 09:33:25.34806	ORG001
AL942	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 09:34:57.184415	ORG001
AL943	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 09:35:00.636782	ORG001
AL944	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 09:35:22.868852	ORG001
AL945	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 09:35:26.551531	ORG001
AL946	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:05:01.928914	ORG001
AL947	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:05:04.978516	ORG001
AL948	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:06:28.341115	ORG001
AL949	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:06:31.444423	ORG001
AL950	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:07:55.397553	ORG001
AL951	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:07:58.71278	ORG001
AL952	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:08:15.88155	ORG001
AL953	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:08:21.105245	ORG001
AL954	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:21:49.672251	ORG001
AL955	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:22:02.361809	ORG001
AL956	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:24:21.01906	ORG001
AL957	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:24:24.359008	ORG001
AL958	USR003	GROUPASSET	Eve005	Create: Add Group Asset Form Opened	2025-10-16 10:25:40.522471	ORG001
AL959	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:26:17.836706	ORG001
AL960	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:26:20.833821	ORG001
AL961	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 10:27:34.546861	ORG001
AL962	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:27:37.582082	ORG001
AL963	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 10:57:36.303184	ORG001
AL964	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:25:21.608494	ORG001
AL965	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:25:25.963937	ORG001
AL966	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:25:56.278711	ORG001
AL967	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:26:00.454957	ORG001
AL968	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:27:46.709461	ORG001
AL969	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:27:50.72349	ORG001
AL970	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:38:13.587623	ORG001
AL971	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:38:17.691524	ORG001
AL972	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:38:34.039517	ORG001
AL973	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:38:37.547434	ORG001
AL974	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:39:15.167819	ORG001
AL975	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:39:18.89735	ORG001
AL976	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 11:40:32.830807	ORG001
AL977	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 11:40:36.635601	ORG001
AL978	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:19:11.920378	ORG001
AL979	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:19:16.033991	ORG001
AL980	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:19:30.933262	ORG001
AL981	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:19:34.914232	ORG001
AL982	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:20:27.656378	ORG001
AL983	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:20:31.421378	ORG001
AL984	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:20:47.093871	ORG001
AL985	USR003	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:20:50.875183	ORG001
AL986	USR003	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:49:52.473415	ORG001
AL987	USR002	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:49:56.250037	ORG001
AL988	USR002	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:50:08.844557	ORG001
AL989	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:53:31.445419	ORG001
AL990	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 12:54:29.533359	ORG001
AL991	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 12:55:06.87316	ORG001
AL992	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 13:03:41.487763	ORG001
AL993	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-16 13:09:47.87395	ORG001
AL994	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-16 13:10:51.674287	ORG001
AL995	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-22 12:18:13.893377	ORG001
AL996	USR001	LOGIN	Eve001	Test audit log entry	2025-10-22 12:18:29.023539	ORG001
AL997	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-22 12:19:20.704523	ORG001
AL998	USR001	ASSETS	Eve005	Create: Add Asset Form Opened	2025-10-22 12:19:41.029298	ORG001
AL999	USR001	LOGOUT	Eve002	Logging Out: User Logged Out Successfully	2025-10-22 12:19:55.669193	ORG001
AL1000	USR001	LOGIN	Eve001	Logging In: User Logged In Successfully	2025-10-22 12:20:09.439061	ORG001
\.


--
-- Data for Name: tblBranches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblBranches" (branch_id, org_id, int_status, text, city, branch_code, created_by, created_on, changed_by, changed_on) FROM stdin;
BR003	ORG001	1	Downtown Branch	Bengaluru	104	USR001	2025-08-04 11:27:26.229609	\N	2025-08-04 11:27:26.229609
BR002	ORG001	1	Coimbatore Branch	Coimbatore	102		2025-07-31 15:03:24.239873	USR001	2025-09-18 12:24:07.972172
BR001	ORG001	1	Chennai Branch	Chennai	101		2025-07-31 10:00:00		2025-07-31 10:00:00
\.


--
-- Data for Name: tblDepartments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblDepartments" (org_id, dept_id, int_status, text, parent_id, created_on, changed_on, changed_by, created_by, branch_id) FROM stdin;
ORG001	DPT202	1	Quality Assurance	\N	2025-07-31	2025-07-31			BR001
ORG001	DPT400	1	TEST		2025-10-06	2025-10-06			BR003
ORG001	DPT201	1	Product Development	\N	2025-07-31	2025-07-31			BR001
ORG001	DPT204	1	Marketing & Promotions	\N	2025-07-31	2025-07-31			BR001
ORG001	DPT205	1	Field Maintenance Team	\N	2025-07-31	2025-07-31			BR001
ORG001	DPT206	1	Equipment Repair Unit	\N	2025-07-31	2025-07-31			BR001
ORG001	DPT301	1	Technical Support Services	\N	2025-07-31	2025-07-31			BR002
ORG001	DPT302	1	Customer Support	\N	2025-07-31	2025-07-31			BR002
ORG001	DPT203	1	Human Resources	\N	2025-07-31	2025-07-31			BR002
ORG001	DPT304	1	Sales Manager	\N	2025-08-22	2025-08-22	\N	USR003	BR001
ORG001	DPT303	1	IT support	\N	2025-08-05	2025-08-05	\N	USR001	BR002
\.


--
-- Data for Name: tblDepreciationSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblDepreciationSettings" (setting_id, org_id, fiscal_year_start_month, fiscal_year_start_day, depreciation_calculation_frequency, auto_calculate_depreciation, created_by, created_on, changed_by, changed_on) FROM stdin;
DS001	ORG001	1	1	MONTHLY	t	SYSTEM	2025-08-13 10:58:35.826662	\N	2025-08-13 10:58:35.826662
DS002	ORG002	1	1	MONTHLY	t	SYSTEM	2025-08-13 10:58:35.826662	\N	2025-08-13 10:58:35.826662
\.


--
-- Data for Name: tblDeptAdmins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblDeptAdmins" (dept_admin_id, org_id, dept_id, user_id, created_by, created_on, changed_by, changed_on, branch_id) FROM stdin;
DPTA01	ORG001	DPT201	USR004		2025-08-01 11:56:38.54		2025-08-01 11:56:38.54	BR001
DPTA02	ORG001	DPT202	USR002		2025-08-01 11:56:38.54		2025-08-01 11:56:38.54	BR001
DPTA03	ORG001	DPT203	USR007		2025-08-01 11:56:38.54		2025-08-01 11:56:38.54	BR001
DPTA05	ORG001	DPT201	USR001	USR001	2025-08-04 00:00:00	\N	\N	BR001
DPTA06	ORG001	DPT303	USR008	USR001	2025-08-05 00:00:00	\N	\N	BR001
DPTA12	ORG001	DPT202	USR022	USR001	2025-10-28 00:00:00	\N	\N	BR001
\.


--
-- Data for Name: tblDeptAssetTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblDeptAssetTypes" (dept_asset_type_id, dept_id, asset_type_id, int_status, created_by, created_on, changed_by, changed_on, org_id) FROM stdin;
DAT002	DPT202	AT011	1	USR003	2025-08-04 12:50:26.589602	USR003	2025-08-04 12:50:26.589602	ORG003
DAT003	DPT203	AT011	1	USR003	2025-08-04 12:50:26.589602	USR003	2025-08-04 12:50:26.589602	ORG003
DAT004	DPT204	AT011	1	USR003	2025-08-04 12:50:26.589602	USR003	2025-08-04 12:50:26.589602	ORG003
DAT005	DPT205	AT011	1	USR003	2025-08-04 12:50:26.589602	USR003	2025-08-04 12:50:26.589602	ORG003
DAT006	DPT206	AT011	1	USR003	2025-08-04 12:50:26.589602	USR003	2025-08-04 12:50:26.589602	ORG003
DPTASS007	DPT202	AT001	1	USR003	2025-09-22 00:00:00	USR003	2025-09-22 00:00:00	ORG001
DPTASS008	DPT303	AT001	1	USR003	2025-09-22 00:00:00	USR003	2025-09-22 00:00:00	ORG001
DPTASS012	DPT201	AT013	1	USR002	2025-10-13 00:00:00	USR002	2025-10-13 00:00:00	ORG001
DPTASS013	DPT202	AT017	1	USR001	2025-11-04 00:00:00	USR001	2025-11-04 00:00:00	ORG001
\.


--
-- Data for Name: tblDocTypeObjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblDocTypeObjects" (dto_id, object_type, doc_type, doc_type_text, org_id) FROM stdin;
DTO001	*	OT	others	ORG001
DTO002	vendor	SL	SLA	ORG001
DTO004	maintenance	BP	Before Photos	ORG001
DTO005	maintenance	AP	After Photos	ORG001
DTO006	maintenance	WO	Work Order	ORG001
DTO007	asset	PO	Purchase Order 	ORG001
DTO008	asset	IN	Insurance	ORG001
DTO009	asset	INV	Invoice	ORG001
DTO010	asset	WA	Warranty	ORG001
DTO011	asset group	PO	Purchase Order 	ORG001
DTO012	asset group	IN	Insurance	ORG001
DTO013	asset group	INV	Invoice 	ORG001
DTO014	asset group	WA	Warranty	ORG001
DTO003	vendor	CT	Contract	ORG001
DTO015	scrap sales	Out	Outpass	ORG001
DTO016	scrap sales	CC	Clearance Certificate	ORG001
DTO017	asset type	CC	Clearance Certificate	ORG001
DTO018	asset	TM	Technical Manual	ORG001
\.


--
-- Data for Name: tblEmployees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblEmployees" (emp_int_id, employee_id, name, first_name, last_name, middle_name, full_name, email_id, dept_id, phone_number, employee_type, joining_date, releiving_date, language_code, int_status, created_by, created_on, changed_by, changed_on, org_id, branch_id) FROM stdin;
EMP_INT_0021	EMP021	John Doe	John	Doe		John Doe	john.doe@company.com	DPT201	9876543210	Full Time	2023-01-15 00:00:00	\N	en	1	USR001	2025-09-25 12:02:38.967032	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0046	EMP025	Subhiksha Rajaram	Subhiksha	Rajaram		Subhiksha Rajaram	subhiksharajaram@gmail.com	DPT202	9098424877	Full Time	2021-06-23 00:00:00	\N	en	1	USR001	2025-09-25 12:02:38.967032	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0047	EMP026	Rahul Krishna	Rahul	Krishna		Rahul Krishna	rahulkriz@gmail.com	DPT203	9597207762	Full Time	2020-10-15 00:00:00	\N	en	1	USR001	2025-09-25 12:02:38.967032	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0048	EMP028	Maria Shilpa	Maria Shilpa 	Shilpa	\N	Maria Shilpa	shilpa@riobizsols.com	DPT201	967789085	P	2024-01-08 10:15:00	\N	en	1	SYSTEM	2024-01-08 10:15:00	SYSTEM	2024-01-08 10:15:00	ORG001	\N
EMP_INT_0005	EMP005	Aryan Babu Mehra	Aryan	Mehra	Babu	Aryan Babu Mehra	aryan.mehra@outlook.com	DPT201	9876543210	C	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
EMP_INT_0009	EMP009	Akash Dev Malhotra	Akash	Malhotra	Dev	Akash Dev Malhotra	akash.malhotra@rediffmail.com	DPT203	9876543210	C	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0010	EMP010	Karan Arjun Sharma	Karan	Sharma	Arjun	Karan Arjun Sharma	karan.sharma@protonmail.com	DPT204	9876543210	P	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0011	EMP011	Neha Vinod Patil	Neha	Patil	Vinod	Neha Vinod Patil	mailto:neha.patil@gmail.com	DPT204	9876543210	C	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0012	EMP012	Manish Raju Deshmukh	Manish	Deshmukh	Raju	Manish Raju Deshmukh	mailto:manish.deshmukh@outlook.com	DPT205	9876543210	P	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0002	EMP002	Narendra Prathap	Narendra	Prathap		Narendra Prathap	narenrio756@gmail.com	DPT202	9952658366	P	2022-11-15 14:30:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
EMP_INT_0024	EMP024	Maintenance Supervisor 	Maintenance 	Supervisor	\N	Maintenance Supervisor	maintenancesupervisor@gmail.com	DPT400	1234567890	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0003	EMP003	Nivetha Kaliyappan 	Nivetha	Kaliyappan 		Nivetha Kaliyappan 	nivethakaliyappan@gmail.com	DPT201	8508223156	P	2024-01-08 10:15:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
EMP_INT_0013	EMP013	Isha Kumari Yadav	Isha	Yadav	Kumari	Isha Kumari Yadav	mailto:isha.yadav@yahoo.com	DPT206	9876543210	C	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0014	EMP014	Rohan Deepak Kulkarni	Rohan	Kulkarni	Deepak	Rohan Deepak Kulkarni	mailto:rohan.kulkarni@live.com	DPT206	9876543210	P	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0004	EMP004	Tony Rozario	Tony	Rozario		Tony Rozario	tonyrozario@gmail.com	DPT201	8884910777	P	2021-07-01 12:00:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
EMP_INT_0006	EMP006	Sneha Kaur Singh	Sneha	Singh	Kaur	Sneha Kaur Singh	sneha.singh@yahoo.com	DPT202	9876543210	C	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0007	EMP007	Rahul Ramesh Iyer	Rahul	Iyer	Ramesh	Rahul Ramesh Iyer	rahul.iyer@gmail.com	DPT203	9876543210	C	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0008	EMP008	Priya Nandita Rao	Priya	Rao	Nandita	Priya Nandita Rao	mailtopriya.rao@hotmail.com	DPT203	9876543210	P	2025-08-01 11:38:49.414	\N	en	1	SYSTEM	2025-08-01 11:38:49.414	SYSTEM	2025-08-01 11:38:49.414	ORG001	\N
EMP_INT_0044	EMP022	Jane Smith	Jane	Smith		Jane Smith	jane.smith@company.com	DPT201	9876543211	Full Time	2024-01-15 00:00:00	\N	en	1	USR001	2025-09-25 12:02:38.967032	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0045	EMP023	Sneha Suresh	Sneha	Suresh		Sneha Suresh	snehasuresh@gmail.com	DPT202	9080511628	Full Time	2025-01-30 00:00:00	\N	en	1	USR001	2025-09-25 12:02:38.967032	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0001	EMP001	Akash Jaiswal	Akash	Jaiswal		Akash Jaiswal	realakashjaiswal@gmail.com	DPT202	7633092708	P	2023-06-20 09:00:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
EMP_INT_0016	EMP016	John Doe	John	Doe		John Doe	john.doe@company.com	DPT201	9876543210	Full Time	2023-01-15 00:00:00	\N	en	1	USR001	2025-09-25 11:03:43.506405	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0017	EMP017	Jane Smith	Jane	Smith		Jane Smith	jane.smith@company.com	DPT201	9876543211	Full Time	2024-01-15 00:00:00	\N	en	1	USR001	2025-09-25 11:03:43.506405	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0018	EMP018	Sneha Suresh	Sneha	Suresh		Sneha Suresh	snehasuresh@gmail.com	DPT202	9080511628	Full Time	2025-01-30 00:00:00	\N	en	1	USR001	2025-09-25 11:03:43.506405	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0019	EMP019	Subhiksha Rajaram	Subhiksha	Rajaram		Subhiksha Rajaram	subhiksharajaram@gmail.com	DPT202	9098424877	Full Time	2021-06-23 00:00:00	\N	en	1	USR001	2025-09-25 11:03:43.506405	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0020	EMP020	Rahul Krishna	Rahul	Krishna		Rahul Krishna	rahulkriz@gmail.com	DPT203	9597207762	Full Time	2020-10-15 00:00:00	\N	en	1	USR001	2025-09-25 11:03:43.506405	USR001	2025-09-25 12:02:38.967032	ORG001	\N
EMP_INT_0025	EMP027	Asset Manager 	Asset  	Manager 	\N	Asset Manager 	assetmanager@gmail.com	DPT400	8508223156	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0026	EMP029	Procurement Manager 	Procurement 	Manager 	\N	Procurement Manager 	procurementmanager@gmail.com	DPT400	8508223156	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0027	EMP030	IT Manager 	IT	Manager 	\N	IT Manager 	itmanager@gmail.com	DPT400	8508223156	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0028	EMP031	Chief Officer 	Chief 	Officer 	\N	Chief Officer 	chiefofficer@gmail.com	DPT400	8508223156	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0029	EMP032	Production Supervisor 	Production 	Supervisor	\N	Production Supervisor 	productionsupervisor@gmail.com	DPT400	8508223156	P	2023-09-22 08:45:00	\N	en	1	SYSTEM	2025-10-06 15:39:45.416	SYSTEM	2025-10-06 15:39:45.416	ORG001	\N
EMP_INT_0015	EMP015	Tester	Tester			Tester	aakashjaiswal0706@gmail.com	DPT202	7633092708	P	2023-06-20 09:00:00	\N	en	1	SYSTEM	2025-07-31 15:39:45.416	SYSTEM	2025-07-31 15:39:45.416	ORG001	\N
\.


--
-- Data for Name: tblEvents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblEvents" (event_id, text) FROM stdin;
Eve001	Logging In
Eve002	Logging Out
Eve003	Reset Password
Eve005	Create
Eve006	Delete
Eve007	Download
Eve008	Update
Eve009	Add Document
Eve010	Save
Eve011	Cancel
Eve012	Assign
Eve013	Unassign
Eve004	History
Eve023	Generate Report
Eve024	Export Report
\.


--
-- Data for Name: tblFCMTokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblFCMTokens" (token_id, user_id, device_token, device_type, platform, app_version, device_info, is_active, last_used, created_on, updated_on) FROM stdin;
FCMEA8400A1-6382-4	USR002	e1rdCRSwSJ2WgPfTij-_D1:APA91bGh5fUfa7a5SC7zm04ZvwV_E-Xod8MGF5SbIlsAjBOa6SAw90hGpvGiK_Nlvhs-g-MBhuSdkGCPFcDLHEJw2KtwFKZIETSbXGtM6eRVwgTFmnrB-Zg	mobile	android	1.0	{"model": "CPH2467", "osVersion": "15", "manufacturer": "OnePlus"}	t	2025-11-07 12:38:46.352775	2025-11-06 09:50:43.980593	2025-11-07 12:38:46.352775
\.


--
-- Data for Name: tblIDSequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblIDSequences" (table_key, prefix, last_number) FROM stdin;
dept_asset	DPTASS	14
tblAssetBRDet	ABR	0
asset_group_h	AGH	19
asset_group_d	AGD	51
asset_maint_doc	AMD	13
asset_type	AT	54
employee	EMP	34
atp	ATP	91
prod_serv	PS	23
asset	ASS	106
psnq	PSN	38
vendor_doc	VD	7
asset_type_doc	ATD	15
user	USR	23
department	DPT	0
userjobrole	UJR	30
branch	BR	3
jobrolenav	JRN	0
aplv	APLV	95
vendor_prod_serv	VPS	7
jobrole	JR	5
wfams	WFAMS	1
wfamsd	WFAMSD	17
wfamsh	WFAMSH	6
asset_group_doc	AGD	8
asset_doc	AD	34
vendor	V	37
emp_int_id	EMP_INT_	47
dept_admin	DPTA	12
org	ORG	7
asset_type_prop	ATP	43
\.


--
-- Data for Name: tblJobRoleNav; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblJobRoleNav" (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, sub_menu, sequence, access_level, is_group, mob_desk) FROM stdin;
JRN001	ORG001	1	JR001	\N	DASHBOARD	Dashboard	\N	1	A	f	D
JRN002	ORG001	1	JR001	\N	ASSETS	Assets	\N	2	A	f	D
JRN003	ORG001	1	JR001	\N	ASSETASSIGNMENT	Asset Assignment	\N	3	A	t	D
JRN005	ORG001	1	JR001	\N	MAINTENANCEAPPROVAL	Maintenance Approval	\N	5	A	f	D
JRN009	ORG001	1	JR001	\N	MASTERDATA	Master Data	\N	9	A	t	D
JRN010	ORG001	1	JR001	JRN003	DEPTASSIGNMENT	Department Assignment	\N	1	A	f	D
JRN011	ORG001	1	JR001	JRN003	EMPASSIGNMENT	Employee Assignment	\N	2	A	f	D
JRN012	ORG001	1	JR001	JRN009	ORGANIZATIONS	Organizations	\N	1	A	f	D
JRN013	ORG001	1	JR001	JRN009	ASSETTYPES	Asset Types	\N	2	A	f	D
JRN014	ORG001	1	JR001	JRN009	DEPARTMENTS	Departments	\N	3	A	f	D
JRN015	ORG001	1	JR001	JRN009	DEPARTMENTSADMIN	Departments Admin	\N	4	A	f	D
JRN017	ORG001	1	JR001	JRN009	BRANCHES	Branches	\N	6	A	f	D
JRN018	ORG001	1	JR001	JRN009	VENDORS	Vendors	\N	7	A	f	D
JRN019	ORG001	1	JR001	JRN009	PRODSERV	Products/Services	\N	8	A	f	D
JRN022	ORG001	1	JR001	JRN009	MAINTENANCESCHEDULE	Maintenance Schedule	\N	11	A	f	D
JRN00201	ORG001	1	JR002	\N	DASHBOARD	Dashboard	\N	1	A	f	D
JRN00202	ORG001	1	JR002	\N	ASSETS	Assets	\N	2	A	f	D
JRN00203	ORG001	1	JR002	\N	ASSETASSIGNMENT	Asset Assignment	\N	3	A	t	D
JRN00204	ORG001	1	JR002	JRN00203	DEPTASSIGNMENT	Department Assignment	\N	4	A	f	D
JRN00205	ORG001	1	JR002	JRN00203	EMPASSIGNMENT	Employee Assignment	\N	5	A	f	D
JRN00207	ORG001	1	JR002	\N	MAINTENANCEAPPROVAL	Maintenance Approval	\N	7	A	f	D
JRN007	ORG001	1	JR001	\N	REPORTBREAKDOWN	Report Breakdown	\N	7	A	f	D
JRN00209	ORG001	1	JR002	\N	MASTERDATA	Master Data	\N	9	D	t	D
JRN00210	ORG001	1	JR002	\N	ORGANIZATIONS	Organizations	\N	10	D	f	D
JRN00211	ORG001	1	JR002	\N	ASSETTYPES	Asset Types	\N	11	D	f	D
JRN00212	ORG001	1	JR002	\N	DEPARTMENTS	Departments	\N	12	D	f	D
JRN00213	ORG001	1	JR002	\N	BRANCHES	Branches	\N	13	D	f	D
JRN00214	ORG001	1	JR002	\N	VENDORS	Vendors	\N	14	D	f	D
JRN00301	ORG001	1	JR003	\N	DASHBOARD	Dashboard	\N	1	A	f	D
JRN00302	ORG001	1	JR003	\N	ASSETS	Assets	\N	2	D	f	D
JRN00303	ORG001	1	JR003	\N	ASSETASSIGNMENT	Asset Assignment	\N	3	D	t	D
JRN00304	ORG001	1	JR003	JRN00303	DEPTASSIGNMENT	Department Assignment	\N	4	D	f	D
JRN00305	ORG001	1	JR003	JRN00303	EMPASSIGNMENT	Employee Assignment	\N	5	D	f	D
JRN00307	ORG001	1	JR003	\N	MAINTENANCEAPPROVAL	Maintenance Approval	\N	7	A	f	D
JRN00310	ORG001	1	JR003	\N	MASTERDATA	Master Data	\N	10	D	t	D
JRN00311	ORG001	1	JR003	\N	ORGANIZATIONS	Organizations	\N	11	D	f	D
JRN00312	ORG001	1	JR003	\N	ASSETTYPES	Asset Types	\N	12	D	f	D
JRN00313	ORG001	1	JR003	\N	DEPARTMENTS	Departments	\N	13	D	f	D
JRN00314	ORG001	1	JR003	\N	BRANCHES	Branches	\N	14	D	f	D
JRN00315	ORG001	1	JR003	\N	VENDORS	Vendors	\N	15	D	f	D
JRN00401	ORG001	1	JR004	\N	DASHBOARD	Dashboard	\N	1	A	f	D
JRN00402	ORG001	1	JR004	\N	ASSETS	Assets	\N	2	D	f	D
JRN00308	ORG001	1	JR003	\N	SUPERVISORAPPROVAL	Maintenance List	\N	8	A	f	D
JRN00405	ORG001	1	JR004	\N	MASTERDATA	Master Data	\N	5	D	t	D
JRN00501	ORG001	1	JR005	\N	DASHBOARD	Dashboard	\N	1	A	f	D
JRN00502	ORG001	1	JR005	\N	ASSETS	Assets	\N	2	D	f	D
JRN606	ORG001	1	JR001	\N	WORKORDERMANAGEMENT	Work Order Management	\N	60	A	t	M
JRN00504	ORG001	1	JR005	\N	MASTERDATA	Master Data	\N	4	D	t	D
JRN00505	ORG001	1	JR005	\N	ORGANIZATIONS	Organizations	\N	5	D	f	D
JRN00506	ORG001	1	JR005	\N	ASSETTYPES	Asset Types	\N	6	D	f	D
JRN00507	ORG001	1	JR005	\N	DEPARTMENTS	Departments	\N	7	D	f	D
JRN00508	ORG001	1	JR005	\N	BRANCHES	Branches	\N	8	D	f	D
JRN00509	ORG001	1	JR005	\N	VENDORS	Vendors	\N	9	D	f	D
JRN510	ORG001	1	JR001	\N	GROUPASSET	Group Asset	false	25	A	f	D
JRN024	ORG001	1	JR001	\N	SCRAPSALES	Scrap Sales	\N	13	A	f	D
JRN117	ORG001	1	JR002	\N	SCRAPSALES	Scrap Sales	\N	8	A	f	D
JRN201	ORG001	1	JR003	\N	SCRAPSALES	Scrap Sales	\N	5	A	f	D
JRN006	ORG001	1	JR001	\N	SUPERVISORAPPROVAL	Maintenance List	\N	6	A	f	D
JRN023	ORG001	1	JR001	\N	AUDITLOGS	Audit Logs	\N	12	A	f	D
JRN00406	ORG001	1	JR004	JRN00405	ORGANIZATIONS	Organizations	\N	6	D	f	D
JRN021	ORG001	1	JR001	JRN009	USERS	User Roles	\N	10	A	f	D
JRN016	ORG001	1	JR001	JRN009	DEPARTMENTSASSET	Departments AssetType	\N	5	A	f	D
JRN004	ORG001	1	JR001	\N	WORKORDERMANAGEMENT	Workorder Management	\N	4	A	f	D
JRN00206	ORG001	1	JR002	\N	WORKORDERMANAGEMENT	Workorder Management	\N	6	A	f	D
JRN00306	ORG001	1	JR003	\N	WORKORDERMANAGEMENT	Workorder Management	\N	6	A	f	D
JRN00403	ORG001	1	JR004	\N	WORKORDERMANAGEMENT	Workorder Management	\N	3	D	f	D
JRN008	ORG001	1	JR001	\N	ADMINSETTINGS	Admin Settings	\N	8	A	t	D
JRN020	ORG001	1	JR001	JRN009	ROLES	Bulk Upload	\N	9	A	f	D
JRN601	ORG001	1	JR001	\N	ASSETASSIGNMENT	Asset Assignment	\N	10	A	t	M
JRN00215	ORG001	1	JR002	\N	USERS	User Roles	\N	15	D	f	D
JRN00407	ORG001	1	JR004	JRN00405	ASSETTYPES	Asset Types	\N	7	D	f	D
JRN00408	ORG001	1	JR004	JRN00405	DEPARTMENTS	Departments	\N	8	D	f	D
JRN00409	ORG001	1	JR004	JRN00405	BRANCHES	Branches	\N	9	D	f	D
JRN00410	ORG001	1	JR004	JRN00405	VENDORS	Vendors	\N	10	D	f	D
JRN00208	ORG001	1	JR002	\N	REPORTBREAKDOWN	Report Breakdown	\N	8	A	f	D
JRN00309	ORG001	1	JR003	\N	REPORTBREAKDOWN	Report Breakdown	\N	9	A	f	D
JRN00503	ORG001	1	JR005	\N	REPORTBREAKDOWN	Report Breakdown	\N	3	D	f	D
JRN604	ORG001	1	JR001	\N	REPORTBREAKDOWN	Report Breakdown	\N	40	A	t	M
JRN00404	ORG001	1	JR004	\N	REPORTBREAKDOWN	Report Breakdown	\N	4	D	f	D
JRN605	ORG001	1	JR001	\N	MAINTENANCE SUPERVISER	Maintenance Supervisor	\N	50	A	t	M
JRN602	ORG001	1	JR001	\N	EMPASSIGNMENT	Employee Assignment	\N	20	A	t	M
JRN603	ORG001	1	JR001	\N	DEPTASSIGNMENT	Department Assignment	\N	30	A	t	M
JRN00607	ORG001	1	JR001	\N	SCRAPASSETS	Scrap Assets	\N	15	A	f	D
JRN00609	ORG001	1	JR002	\N	SCRAPASSETS	Scrap Assets	\N	15	A	f	D
JRN00610	ORG001	1	JR003	\N	SCRAPASSETS	Scrap Assets	\N	15	D	f	D
JRN00611	ORG001	1	JR004	\N	SCRAPASSETS	Scrap Assets	\N	15	D	f	D
JRN00612	ORG001	1	JR005	\N	SCRAPASSETS	Scrap Assets	\N	15	V	f	D
JRN036	ORG001	1	JR001	\N	SERIALNUMBERPRINT	Serial Number Print	\N	6	A	f	D
JRN046	ORG001	1	JR002	\N	SERIALNUMBERPRINT	Serial Number Print	\N	6	D	f	D
JRN701	ORG001	1	JR002	\N	ASSETASSIGNMENT	Asset Assignment	\N	10	A	t	M
JRN702	ORG001	1	JR002	\N	EMPASSIGNMENT	Employee Assignment	\N	20	A	t	M
JRN038	ORG001	1	JR005	\N	REPORTS	Reports	\N	3	D	t	D
JRN039	ORG001	1	JR005	JRN038	ASSETREPORT	Asset Report	\N	1	D	f	D
JRN030	ORG001	1	JR001	\N	REPORTS	Reports	\N	7	A	t	D
JRN031	ORG001	1	JR001	JRN030	ASSETLIFECYCLEREPORT	Asset Lifecycle Report	\N	1	A	f	D
JRN032	ORG001	1	JR001	JRN030	ASSETREPORT	Asset Report	\N	2	A	f	D
JRN033	ORG001	1	JR001	JRN030	MAINTENANCEHISTORY	Maintenance History of Asset	\N	3	A	f	D
JRN034	ORG001	1	JR001	JRN030	ASSETVALUATION	Asset Valuation	\N	4	A	f	D
JRN035	ORG001	1	JR001	JRN030	ASSETWORKFLOWHISTORY	Asset Workflow History	\N	5	A	f	D
JRN040	ORG001	1	JR002	\N	REPORTS	Reports	\N	6	A	t	D
JRN041	ORG001	1	JR002	JRN040	ASSETLIFECYCLEREPORT	Asset Lifecycle Report	\N	1	D	f	D
JRN042	ORG001	1	JR002	JRN040	ASSETREPORT	Asset Report	\N	2	D	f	D
JRN043	ORG001	1	JR002	JRN040	MAINTENANCEHISTORY	Maintenance History of Asset	\N	3	D	f	D
JRN044	ORG001	1	JR002	JRN040	ASSETVALUATION	Asset Valuation	\N	4	D	f	D
JRN045	ORG001	1	JR002	JRN040	ASSETWORKFLOWHISTORY	Asset Workflow History	\N	5	D	f	D
JRN037	ORG001	1	JR001	JRN030	BREAKDOWNHISTORY	Breakdown History	\N	7	A	f	D
JRN050	ORG001	1	JR003	\N	REPORTS	Reports	\N	5	A	t	D
JRN051	ORG001	1	JR003	JRN050	ASSETLIFECYCLEREPORT	Asset Lifecycle Report	\N	1	A	f	D
JRN052	ORG001	1	JR003	JRN050	ASSETREPORT	Asset Report	\N	2	A	f	D
JRN053	ORG001	1	JR003	JRN050	MAINTENANCEHISTORY	Maintenance History of Asset	\N	3	A	f	D
JRN054	ORG001	1	JR003	JRN050	ASSETVALUATION	Asset Valuation	\N	4	A	f	D
JRN055	ORG001	1	JR003	JRN050	ASSETWORKFLOWHISTORY	Asset Workflow History	\N	5	A	f	D
JRN070	ORG001	1	JR005	\N	REPORTS	Reports	\N	3	D	t	D
JRN071	ORG001	1	JR005	JRN070	ASSETLIFECYCLEREPORT	Asset Lifecycle Report	\N	1	D	f	D
JRN072	ORG001	1	JR005	JRN070	ASSETREPORT	Asset Report	\N	2	D	f	D
JRN073	ORG001	1	JR005	JRN070	MAINTENANCEHISTORY	Maintenance History of Asset	\N	3	D	f	D
JRN074	ORG001	1	JR005	JRN070	ASSETVALUATION	Asset Valuation	\N	4	D	f	D
JRN075	ORG001	1	JR005	JRN070	ASSETWORKFLOWHISTORY	Asset Workflow History	\N	5	D	f	D
JRN089	ORG001	1	JR010	\N	MASTERDATA	Master Data	ORGANIZATIONS	11	A	t	D
JRN083	ORG001	1	JR008	\N	ASSETS	Assets	\N	10	D	f	D
JRN085	ORG001	1	JR009	\N	SCRAPSALES	Scrap Sales 	\N	10	A	f	D
JRN1010	ORG001	1	JR010	JRN089	ORGANIZATIONS	Organizations	\N	1	A	f	D
JRN1011	ORG001	1	JR010	JRN089	ASSETTYPES	Asset Types	\N	2	A	f	D
JRN1012	ORG001	1	JR010	JRN089	DEPARTMENTS	Departments	\N	3	A	f	D
JRN056	ORG001	1	JR003	\N	SERIALNUMBERPRINT	Serial Number Print	\N	6	A	f	D
JRN066	ORG001	1	JR004	\N	SERIALNUMBERPRINT	Serial Number Print	\N	6	D	f	D
JRN076	ORG001	1	JR005	\N	SERIALNUMBERPRINT	Serial Number Print	\N	6	D	f	D
JRN092	ORG001	1	JR010	JRN091	AUDITLOGCONFIG	Audit Log Config	\N	12	D	f	D
JRN704	ORG001	1	JR002	\N	ADMINSETTINGS	Admin Settings	false	8	A	t	D
JRN706	ORG001	1	JR003	\N	ADMINSETTINGS	Admin Settings	false	8	A	t	D
JRN1017	ORG001	1	JR010	JRN089	PRODSERV	Products/Services	\N	8	D	f	D
JRN708	ORG001	1	JR004	\N	ADMINSETTINGS	Admin Settings	false	8	A	t	D
JRN1013	ORG001	1	JR010	JRN089	DEPARTMENTSADMIN	Departments Admin	\N	4	D	f	D
JRN710	ORG001	1	JR005	\N	ADMINSETTINGS	Admin Settings	false	8	A	t	D
JRN712	ORG001	1	JR001	JRN008	AUDITLOGCONFIG	Audit Log Config	false	1	A	f	D
JRN713	ORG001	1	JR002	JRN704	AUDITLOGCONFIG	Audit Log Config	false	1	A	f	D
JRN714	ORG001	1	JR003	JRN706	AUDITLOGCONFIG	Audit Log Config	false	1	A	f	D
JRN715	ORG001	1	JR004	JRN708	AUDITLOGCONFIG	Audit Log Config	false	1	A	f	D
JRN716	ORG001	1	JR005	JRN710	AUDITLOGCONFIG	Audit Log Config	false	1	A	f	D
JRN082	ORG001	1	JR008	\N	GROUPASSET	Group Assets	\N	10	A	f	D
JRN080	ORG001	1	JR007	\N	WORKORDERMANAGEMENT	Work Order Management	\N	10	A	f	D
JRN1015	ORG001	1	JR010	JRN089	BRANCHES	Branches	\N	6	A	f	D
JRN1016	ORG001	1	JR010	JRN089	VENDORS	Vendors	\N	7	A	f	D
JRN1020	ORG001	1	JR010	JRN089	MAINTENANCESCHEDULE	Maintenance Schedule	\N	11	A	f	D
JRN091	ORG001	1	JR010	\N	ADMINSETTINGS	Admin Settings	\N	12	A	t	D
JRN086	ORG001	1	JR010	JRN090	DEPTASSIGNMENT	Department Assignment 	\N	20	A	f	D
JRN1019	ORG001	1	JR010	JRN089	USERS	User Roles	\N	10	A	f	D
JRN090	ORG001	1	JR010	\N	ASSETASSIGNMENT	Asset Assignment 	\N	10	A	t	D
JRN1018	ORG001	1	JR010	JRN089	ROLES	Bulk Upload	\N	9	A	f	D
JRN087	ORG001	1	JR010	JRN090	EMPASSIGNMENT	Employee Assignment 	\N	10	A	f	D
JRN100	ORG001	1	JR010	\N	MASTERDATA	Master data 	\N	20	A	t	D
JRN1014	ORG001	1	JR010	JRN089	DEPARTMENTSASSET	Departments AssetType	\N	5	A	f	D
JRN081	ORG001	1	JR007	\N	SUPERVISORAPPROVAL	Supervisor Approval 	\N	10	A	f	D
JRN088	ORG001	1	JR010	\N	AUDITLOGS	Audit Logs 	\N	10	A	f	D
JRN084	ORG001	1	JR009	\N	SCRAPASSETS	Scrap Assets	\N	10	D	f	D
JRN047	ORG001	1	JR002	JRN040	BREAKDOWNHISTORY	Breakdown History	\N	7	D	f	D
JRN057	ORG001	1	JR003	JRN050	BREAKDOWNHISTORY	Breakdown History	\N	7	A	f	D
JRN077	ORG001	1	JR005	JRN070	BREAKDOWNHISTORY	Breakdown History	\N	7	D	f	D
JRN115	ORG001	1	JR010	\N	ADMINSETTINGS	Admin Setting 	\N	30	A	t	D
JRN120	ORG001	1	JR011	JRN118	BREAKDOWNHISTORY	Breakdown History	\N	20	A	f	D
JRN126	ORG001	1	JR012	\N	REPORTBREAKDOWN	Report Breakdown	\N	10	A	f	D
JRN125	ORG001	1	JR011	\N	SUPERVISORAPPROVAL	Supervisor Approval 	\N	20	A	f	D
JRN118	ORG001	1	JR011	\N	REPORTS	Reports	\N	40	A	t	D
JRN124	ORG001	1	JR011	JRN118	ASSETLIFECYCLEREPORT	Asset Lifecycle Report 	\N	60	A	t	D
JRN123	ORG001	1	JR011	JRN118	ASSETREPORT	Asset Report 	\N	50	A	t	D
JRN122	ORG001	1	JR011	JRN118	ASSETVALUATION	Asset Valuation Report 	\N	40	A	t	D
JRN121	ORG001	1	JR011	JRN118	ASSETWORKFLOWHISTORY	Asset Workflow History Report 	\N	30	A	t	D
JRN119	ORG001	1	JR011	JRN118	MAINTENANCEHISTORY	Maintenance History Report 	\N	10	A	f	D
\.


--
-- Data for Name: tblJobRoles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblJobRoles" (org_id, job_role_id, text, job_function, int_status) FROM stdin;
ORG001	JR001	System Administrator	dept_admin	1
ORG001	JR002	IT Support Specialist	dept_admin	1
ORG001	JR003	IT Asset Supervisor	dept_asset	1
ORG001	JR004	Software License Manager	dept_asset	1
ORG001	JR005	Network Engineer	department	1
ORG001	JR006	Supervisor	dept_supervisor	1
ORG001	JR007	Maintennace Supervisor	maintenance	1
ORG001	JR008	Asset Manager	asset	1
ORG001	JR009	Procurement Manager	Procurement	1
ORG001	JR010	IT Manager	IT	1
ORG001	JR011	Chief Officer	Chief	1
ORG001	JR012	Production Supervisor	Supervisor	1
ORG001	JR013	Safety Officer	Safety_Officer	1
\.


--
-- Data for Name: tblMaintStatus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblMaintStatus" (maint_status_id, org_id, text, int_status) FROM stdin;
MS001	ORG001	Scheduled	1
MS002	ORG001	In-progress	1
MS003	ORG001	Cancelled	1
MS004	ORG001	Aborted	1
MS005	ORG001	Completed	1
\.


--
-- Data for Name: tblMaintTypes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblMaintTypes" (maint_type_id, org_id, text, int_status) FROM stdin;
MT001	ORG001	Subscribtion Renewal	1
MT002	ORG001	Regular Maintenance	1
MT003	ORG001	Others	1
MT004	ORG001	Break Down	1
\.


--
-- Data for Name: tblNotificationHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblNotificationHistory" (notification_id, user_id, token_id, notification_type, title, body, data, status, fcm_response, sent_on, delivered_on, clicked_on) FROM stdin;
NOT7B3A48B2-1E33-4	USR002	FCMEA8400A1-6382-4	test_notification	Test Notification	This will appear on your device!	{"type": "test"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762422746801023%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-06 15:22:26	2025-11-06 15:22:26	\N
NOTDEDEDA17-57E1-4	USR002	FCMEA8400A1-6382-4	test_notification	Test Notification	This will appear on your device!	{"type": "test"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762424376152190%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-06 15:49:36	2025-11-06 15:49:36	\N
NOTB1C74B4D-019E-4	USR002	FCMEA8400A1-6382-4	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762425702027374%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-06 16:11:42	2025-11-06 16:11:42	\N
NOTFC6849B3-2364-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Apple Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS001", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_01", "wfamsh_id": "WFAMSH_01", "asset_name": "Apple Laptop", "planned_date": "2025-09-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171388223491%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:08	2025-11-03 17:33:08	\N
NOTC1D67D7C-50F7-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Dell XPS 13" requires maintenance approval. Please review and approve.	{"asset_id": "ASS002", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_04", "wfamsh_id": "WFAMSH_02", "asset_name": "Dell XPS 13", "planned_date": "2025-08-26T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171389541046%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:09	2025-11-03 17:33:09	\N
NOT4542817E-3A6E-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "HP EliteBook 840" requires maintenance approval. Please review and approve.	{"asset_id": "ASS003", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_07", "wfamsh_id": "WFAMSH_03", "asset_name": "HP EliteBook 840", "planned_date": "2025-08-29T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171390814250%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:10	2025-11-03 17:33:10	\N
NOT2B86B001-1F67-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS004", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_10", "wfamsh_id": "WFAMSH_04", "asset_name": "Laptop", "planned_date": "2025-09-30T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171392090681%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:12	2025-11-03 17:33:12	\N
NOTCA307A7C-7089-4	USR002	FCMEA8400A1-6382-4	test_notification	Test Notification	This will appear on your device!	{"type": "test"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762429807942350%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-06 17:20:08	2025-11-06 17:20:08	\N
NOT72340603-195A-4	USR002	FCMEA8400A1-6382-4	test_notification	Test Notification	This will appear on your device!	{"type": "test"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762434158208638%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-06 18:32:38	2025-11-06 18:32:38	\N
NOT4BDDE141-4E01-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Dell OptiPlex 7090" requires maintenance approval. Please review and approve.	{"asset_id": "ASS006", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_43", "wfamsh_id": "WFAMSH_15", "asset_name": "Dell OptiPlex 7090", "planned_date": "2025-10-28T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171406126985%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:26	2025-11-03 17:33:26	\N
NOT6C560A82-139D-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "HP ProDesk 400 G7" requires maintenance approval. Please review and approve.	{"asset_id": "ASS007", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_46", "wfamsh_id": "WFAMSH_16", "asset_name": "HP ProDesk 400 G7", "planned_date": "2025-10-28T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171407369127%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:27	2025-11-03 17:33:27	\N
NOT0A12A255-B05C-4	USR002	FCMEA8400A1-6382-4	workflow_approval	New Maintenance Approval Required	Asset "Software" requires maintenance approval. Please review and approve.	{"asset_id": "ASS101", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_54", "wfamsh_id": "WFAMSH_19", "asset_name": "Software", "planned_date": "2025-11-16T00:00:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762518076155850%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMEA8400A1-6382-4": true}}	2025-11-07 17:51:16	2025-11-07 17:51:16	\N
NOT76776095-1985-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Minimax CO2 4.5kg" requires maintenance approval. Please review and approve.	{"asset_id": "ASS023", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_64", "wfamsh_id": "WFAMSH_27", "asset_name": "Minimax CO2 4.5kg", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171418877105%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:38	2025-11-03 17:33:38	\N
NOT395F1237-D5D2-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Hikvision Dome DS-2CD1323G0" requires maintenance approval. Please review and approve.	{"asset_id": "ASS024", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_66", "wfamsh_id": "WFAMSH_28", "asset_name": "Hikvision Dome DS-2CD1323G0", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171420222675%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:40	2025-11-03 17:33:40	\N
NOT53281821-3037-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "CP Plus Bullet CP-UNC-TA24L2" requires maintenance approval. Please review and approve.	{"asset_id": "ASS025", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_68", "wfamsh_id": "WFAMSH_29", "asset_name": "CP Plus Bullet CP-UNC-TA24L2", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171421367155%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:41	2025-11-03 17:33:41	\N
NOTB365A810-AC09-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	failed	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	\N	\N
NOT2D15E8EF-B9E6-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "TP-Link Archer C6" requires maintenance approval. Please review and approve.	{"asset_id": "ASS020", "job_role": "System Administrator", "sequence": "10", "wfamsd_id": "WFAMSD_57", "wfamsh_id": "WFAMSH_24", "asset_name": "TP-Link Archer C6", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171414598125%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCM52193256-1EBC-4": true}}	2025-11-03 17:33:34	2025-11-03 17:33:34	\N
NOT296FC1CC-B677-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Netgear R6700AX" requires maintenance approval. Please review and approve.	{"asset_id": "ASS021", "job_role": "System Administrator", "sequence": "10", "wfamsd_id": "WFAMSD_60", "wfamsh_id": "WFAMSH_25", "asset_name": "Netgear R6700AX", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171416502240%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCM52193256-1EBC-4": true}}	2025-11-03 17:33:36	2025-11-03 17:33:36	\N
NOT3CF5A84E-E79C-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Minimax CO2 4.5kg" requires maintenance approval. Please review and approve.	{"asset_id": "ASS023", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_65", "wfamsh_id": "WFAMSH_27", "asset_name": "Minimax CO2 4.5kg", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171490598660%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCM52193256-1EBC-4": true}}	2025-11-03 17:34:50	2025-11-03 17:34:50	\N
NOT4D51718E-41F3-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	2025-11-06 13:40:15	\N
NOTDADF25D5-8265-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	2025-11-06 13:40:15	\N
NOTB847A725-8216-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	2025-11-06 13:40:15	\N
NOT41A26F26-944F-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	failed	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	\N	\N
NOT5F08A501-E759-4	USR002	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "System Administrator", "sequence": "20", "wfamsd_id": "WFAMSD_50", "wfamsh_id": "WFAMSH_17", "asset_name": "Epson EB-E01", "planned_date": "2025-10-13T00:00:00.000Z", "notification_type": "workflow_approval"}	failed	{"responses": [{"error": "Requested entity was not found.", "success": false}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416614906593%c6f2479bc6f2479b"}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615110873%c6f2479bc6f2479b"}, {"error": "Requested entity was not found.", "success": false}, {"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762416615667684%c6f2479bc6f2479b"}], "totalTokens": 6, "failureCount": 3, "successCount": 3, "tokenSuccessMap": {"FCM36AC28A5-C36E-4": true, "FCM52193256-1EBC-4": false, "FCM743BCAD0-4659-4": false, "FCMB10900D5-5109-4": false, "FCMD6D7593B-3CD3-4": true, "FCMF0953C9A-9856-4": true}}	2025-11-06 13:40:15	\N	\N
NOTA2B76CA1-B3F1-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS005", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_13", "wfamsh_id": "WFAMSH_05", "asset_name": "Laptop", "planned_date": "2025-09-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171393386797%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:13	2025-11-03 17:33:13	\N
NOTFAF42F56-B0F1-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Test Asset" requires maintenance approval. Please review and approve.	{"asset_id": "ASS074", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_16", "wfamsh_id": "WFAMSH_06", "asset_name": "Test Asset", "planned_date": "2024-01-30T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171394636586%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:14	2025-11-03 17:33:14	\N
NOT0F4C1FA4-6450-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS077", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_19", "wfamsh_id": "WFAMSH_07", "asset_name": "Laptop", "planned_date": "2025-10-10T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171395934594%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:15	2025-11-03 17:33:15	\N
NOTF546FC53-9D30-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS092", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_22", "wfamsh_id": "WFAMSH_08", "asset_name": "Laptop", "planned_date": "2025-10-21T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171397279458%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:17	2025-11-03 17:33:17	\N
NOTFA2620E9-8E25-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS096", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_25", "wfamsh_id": "WFAMSH_09", "asset_name": "Laptop", "planned_date": "2025-10-24T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171398511730%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:18	2025-11-03 17:33:18	\N
NOT6F28F2B9-6D7F-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "AST001", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_28", "wfamsh_id": "WFAMSH_10", "asset_name": "Laptop", "planned_date": "2024-03-04T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171399769827%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:19	2025-11-03 17:33:19	\N
NOT89762B21-65CB-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "AST002", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_31", "wfamsh_id": "WFAMSH_11", "asset_name": "Laptop", "planned_date": "2024-03-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171401020649%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:21	2025-11-03 17:33:21	\N
NOT2F217C20-76B2-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "AST003", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_34", "wfamsh_id": "WFAMSH_12", "asset_name": "Laptop", "planned_date": "2024-03-04T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171402290095%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:22	2025-11-03 17:33:22	\N
NOT679E89DB-D12E-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "AST004", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_37", "wfamsh_id": "WFAMSH_13", "asset_name": "Laptop", "planned_date": "2024-03-04T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171403532755%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:23	2025-11-03 17:33:23	\N
NOT26DE0507-218C-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Laptop" requires maintenance approval. Please review and approve.	{"asset_id": "AST005", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_40", "wfamsh_id": "WFAMSH_14", "asset_name": "Laptop", "planned_date": "2024-03-04T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171404790350%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:24	2025-11-03 17:33:24	\N
NOTFB025D95-CE11-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Desktop" requires maintenance approval. Please review and approve.	{"asset_id": "ASS059", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_49", "wfamsh_id": "WFAMSH_17", "asset_name": "Desktop", "planned_date": "2025-11-10T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171408605521%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:28	2025-11-03 17:33:28	\N
NOT752750CE-B96A-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Epson EB-E01" requires maintenance approval. Please review and approve.	{"asset_id": "ASS018", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_52", "wfamsh_id": "WFAMSH_22", "asset_name": "Epson EB-E01", "planned_date": "2025-10-12T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171411510886%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:31	2025-11-03 17:33:31	\N
NOTA396278E-46B1-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "BenQ MS560" requires maintenance approval. Please review and approve.	{"asset_id": "ASS019", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_54", "wfamsh_id": "WFAMSH_23", "asset_name": "BenQ MS560", "planned_date": "2025-10-12T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171412625885%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:32	2025-11-03 17:33:32	\N
NOT9E1B34E6-FF37-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "TP-Link Archer C6" requires maintenance approval. Please review and approve.	{"asset_id": "ASS020", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_56", "wfamsh_id": "WFAMSH_24", "asset_name": "TP-Link Archer C6", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171413842181%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:33	2025-11-03 17:33:33	\N
NOT6B340CC5-16AE-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Netgear R6700AX" requires maintenance approval. Please review and approve.	{"asset_id": "ASS021", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_59", "wfamsh_id": "WFAMSH_25", "asset_name": "Netgear R6700AX", "planned_date": "2025-11-02T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171415740775%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:35	2025-11-03 17:33:35	\N
NOTE5D0FCAD-2A85-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "SafePro 6kg ABC" requires maintenance approval. Please review and approve.	{"asset_id": "ASS022", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_62", "wfamsh_id": "WFAMSH_26", "asset_name": "SafePro 6kg ABC", "planned_date": "2025-11-03T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171417716464%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:37	2025-11-03 17:33:37	\N
NOT98960FFA-8E88-4	USR003	\N	workflow_approval	New Maintenance Approval Required	Asset "Software" requires maintenance approval. Please review and approve.	{"asset_id": "ASS100", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_70", "wfamsh_id": "WFAMSH_35", "asset_name": "Software", "planned_date": "2024-10-14T18:30:00.000Z", "notification_type": "workflow_approval"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171424701897%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:33:44	2025-11-03 17:33:44	\N
NOT54916B2B-2BF2-4	USR003	\N	workflow_rejection_reverted	Maintenance Request Rejected - Re-approval Required	The maintenance request for asset "Minimax CO2 4.5kg" was rejected by System Administrator. Your previous approval has been reverted. Please review and re-approve. Reason: REJ	{"asset_id": "ASS023", "job_role": "IT Support Specialist", "sequence": "10", "wfamsd_id": "WFAMSD_64", "wfamsh_id": "WFAMSH_27", "asset_name": "Minimax CO2 4.5kg", "is_reversion": "true", "rejected_by_role": "System Administrator", "rejection_reason": "REJ", "notification_type": "workflow_rejection_reverted"}	sent	{"responses": [{"success": true, "messageId": "projects/assetlifecyclemanagement/messages/0:1762171540962568%c6f2479bc6f2479b"}], "totalTokens": 1, "failureCount": 0, "successCount": 1, "tokenSuccessMap": {"FCMC12D2A8C-8391-4": true}}	2025-11-03 17:35:41	2025-11-03 17:35:41	\N
\.


--
-- Data for Name: tblNotificationPreferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblNotificationPreferences" (preference_id, user_id, notification_type, is_enabled, email_enabled, push_enabled, created_on, updated_on) FROM stdin;
NP999	USR002	test_notification	t	t	t	2025-10-24 13:37:25.861426	2025-10-24 13:38:13.378818
PREFUSR001	USR001	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR021	USR021	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR016	USR016	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR014	USR014	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR012	USR012	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR003	USR003	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR023	USR023	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR007	USR007	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR019	USR019	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR005	USR005	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR022	USR022	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR018	USR018	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR010	USR010	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR004	USR004	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR011	USR011	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR006	USR006	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR020	USR020	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR008	USR008	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR024	USR024	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR017	USR017	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR015	USR015	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR002	USR002	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR013	USR013	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR009	USR009	workflow_approval	t	t	t	2025-10-27 12:30:25.306538	2025-10-27 12:30:25.306538
PREFUSR001BD	USR001	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR021BD	USR021	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR016BD	USR016	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR014BD	USR014	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR012BD	USR012	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR003BD	USR003	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR023BD	USR023	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR007BD	USR007	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR019BD	USR019	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR005BD	USR005	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR022BD	USR022	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR018BD	USR018	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR010BD	USR010	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR004BD	USR004	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR011BD	USR011	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR006BD	USR006	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR020BD	USR020	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR008BD	USR008	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR024BD	USR024	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR017BD	USR017	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR015BD	USR015	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR002BD	USR002	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR013BD	USR013	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREFUSR009BD	USR009	breakdown_approval	t	t	t	2025-10-27 12:30:25.356681	2025-10-27 12:30:25.356681
PREF_1761718927145	USR001	test_notification	t	t	t	2025-10-29 06:22:07.162634	2025-10-29 06:22:07.162634
PREF_TEST_USR020	USR020	test_notification	t	t	t	2025-10-29 06:40:05.01829	2025-10-29 06:40:05.01829
PREF1761739490.2212	USR002	asset_updated	t	t	t	2025-10-29 12:04:50.221262	2025-10-29 12:04:50.221262
NP998	USR003	test_notification	t	t	t	2025-10-27 12:30:25.356	2025-10-27 12:30:25.356
PREF80K9F4Y8YRD	USR015	workflow_completed	t	t	t	2025-10-31 12:53:28.030343	2025-10-31 12:53:28.030343
PREF46X6JUHOR4P	USR001	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.671884	2025-11-03 12:01:44.671884
PREFWDRQ4K47Q6I	USR002	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.71045	2025-11-03 12:01:44.71045
PREFZW0EZ1W7AT9	USR003	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.748685	2025-11-03 12:01:44.748685
PREFW8FQN2WRXO	USR004	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.786434	2025-11-03 12:01:44.786434
PREFIUXTY3XH1KA	USR005	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.82409	2025-11-03 12:01:44.82409
PREFED767IJQGGM	USR006	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.86143	2025-11-03 12:01:44.86143
PREFZK2HQI2DMNA	USR007	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.899372	2025-11-03 12:01:44.899372
PREF479K0ITEV1U	USR008	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.937277	2025-11-03 12:01:44.937277
PREFZO60XCF0D2	USR009	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:44.975332	2025-11-03 12:01:44.975332
PREFDLKGILL3M7	USR010	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.012668	2025-11-03 12:01:45.012668
PREF96JKQJMPC8F	USR011	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.050411	2025-11-03 12:01:45.050411
PREFN30R14MQ2JJ	USR012	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.088445	2025-11-03 12:01:45.088445
PREFDU1034OOKI8	USR013	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.126147	2025-11-03 12:01:45.126147
PREF87OWM957JD7	USR014	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.16361	2025-11-03 12:01:45.16361
PREFH2UBYIULCY	USR015	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.202079	2025-11-03 12:01:45.202079
PREFK71O3QXTAQC	USR016	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.239676	2025-11-03 12:01:45.239676
PREFJQ4UPX6KVP7	USR017	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.277259	2025-11-03 12:01:45.277259
PREFIC7MCNJOJUH	USR018	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.314946	2025-11-03 12:01:45.314946
PREFZUW4ISR3GS	USR019	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.352726	2025-11-03 12:01:45.352726
PREFWF4J53BE4PL	USR020	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.390007	2025-11-03 12:01:45.390007
PREFF8J4HSTH07R	USR021	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.428035	2025-11-03 12:01:45.428035
PREFS1T04EFZW1	USR022	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.465366	2025-11-03 12:01:45.465366
PREFSOUPFIOS9NE	USR023	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.502011	2025-11-03 12:01:45.502011
PREFTT7UBLJ90V	USR024	workflow_rejection_reverted	t	t	t	2025-11-03 12:01:45.538713	2025-11-03 12:01:45.538713
\.


--
-- Data for Name: tblOrgSettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblOrgSettings" (os_id, org_id, key, value) FROM stdin;
OS_01	ORG001	dep_auto_calc	1
OS_02	ORG001	asset_inv_doc_size	10
OS_03	ORG001	default_doc_size	15
OS_04	ORG001	dep_calc_freq	Monthly
OS_05	ORG001	printer_asset_type	Printer
OS_06	ORG001	software_at_id	AT053
OS_07	ORG001	m_supervisor_role	JR007
OS_08	ORG001	at_id_usage_based	AT054
OS_09	ORG001	at_ub_lead_time	1000
\.


--
-- Data for Name: tblOrgs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblOrgs" (org_id, text, valid_from, valid_to, int_status, org_code, org_city) FROM stdin;
ORG001	Indicube Head Office	2022-04-01	2030-03-31	1	IHO1	Chennai
ORG003	RIO	\N	\N	1	RIO	Coimbatore
ORG007	ALM Pvt Ltd	\N	\N	1	ALM	Coimbatore
\.


--
-- Data for Name: tblPrintSerialNoQueue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblPrintSerialNoQueue" (psnq_id, serial_no, status, created_by, created_on, org_id, reason) FROM stdin;
PSN012	LTP-HP84-002	Completed	USR002	2025-09-09 12:00:44.862074	ORG001	Reprint
PSN011	LTP-DX13-001	New	USR002	2025-09-09 11:59:29.46952	ORG001	New
PSN013	01520923457	New	USR001	2025-09-11 10:46:37.57513	ORG001	\N
PSN018	17520900002	New	USR001	2025-09-12 08:34:59.67309	ORG001	\N
PSN019	01520923458	New	USR001	2025-09-12 12:50:18.719026	ORG001	\N
PSN021	17520900003	New	USR003	2025-09-16 11:59:41.216027	ORG001	\N
PSN022	35520900001	New	USR003	2025-09-17 13:09:06.690011	ORG001	\N
PSN023	33520900001	New	USR001	2025-09-19 09:53:03.757679	ORG001	\N
PSN024	30520900006	New	USR001	2025-09-23 11:12:39.707304	ORG001	\N
PSN025	30520900007	New	USR001	2025-09-23 11:14:12.737404	ORG001	\N
PSN030	01520923476	New	USR001	2025-09-29 13:04:45.414186	ORG001	\N
PSN026	30520800002	Completed	USR003	2025-09-24 11:40:07.513332	ORG001	reprint
PSN029	01520923475	Completed	USR001	2025-09-25 09:54:43.901142	ORG001	\N
PSN028	26520800007	Completed	USR001	2025-09-24 11:51:30.003834	ORG001	reason
PSN031	51520900002	Completed	USR003	2025-09-30 11:57:44.226524	ORG001	\N
PSN032	52521000001	New	USR016	2025-10-08 10:40:07.512184	ORG001	\N
PSN033	53521000001	New	USR003	2025-10-08 11:06:47.515904	ORG001	\N
PSN034	53521000002	New	USR003	2025-10-08 11:07:59.172694	ORG001	\N
PSN035	51521000003	New	USR001	2025-10-28 07:22:31.560271	ORG001	\N
PSN036	51521000004	New	USR001	2025-10-28 07:28:07.76933	ORG001	\N
PSN037	53521000003	New	USR001	2025-10-30 12:38:52.897797	ORG001	\N
PSN038	54521100001	New	USR001	2025-11-09 15:59:42.210276	ORG001	\N
\.


--
-- Data for Name: tblProdServs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblProdServs" (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description) FROM stdin;
PS007	ORG001	AT001	\N	\N	active	Service	Laptop Annual Maintenance Contract (AMC) 
PS008	ORG001	AT010	\N	\N	active	service	Fire Extinguisher Refilling & Pressure Testing
PS009	ORG001	AT013	\N	\N	active	service	Air Conditioner Deep Cleaning Service 
PS001	ORG001	AT001	Dell	PowerEdge	active	Product	\N
PS002	ORG001	AT001	Dell	Inspiron 15	active	Product	\N
PS003	ORG001	AT001	Dell	Latitude 7420	active	Product	\N
PS004	ORG001	AT001	HP	ProLiant	retired	Product	\N
PS005	ORG001	AT001	Lenovo	ThinkSystem	active	Product	\N
PS006	ORG001	AT001	Dell	XPS 13	active	Product	\N
PS10	ORG001	AT017	Dell	INKJet	1	product	\N
PS010	ORG001	AT001	Dell	Dell344	1	product	\N
PS011	ORG001	AT026	Bajaj	Baj12	1	product	\N
PS012	ORG001	AT026	\N	\N	1	service	Bajaj Service
PS013	ORG001	AT033	test	test	1	product	\N
PS014	ORG001	AT033	\N	\N	1	service	test
PS017	ORG001	AT001	Asus	XP25	1	product	\N
PS018	ORG001	AT001	\N	\N	1	service	Testing
PS019	ORG001	AT001	\N	\N	1	service	Testing 2
PS020	ORG001	AT001	Model	model	1	product	\N
PS021	ORG001	AT051	marshal	2s	1	product	\N
PS022	ORG001	AT051	SONY	M2-103	1	product	\N
PS023	ORG001	AT054	Mahindra	Blazo X 55	1	product	\N
\.


--
-- Data for Name: tblProps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblProps" (prop_id, org_id, property, int_status) FROM stdin;
PROP001	ORG001	Material	1
PROP002	ORG001	Dimensions	1
PROP003	ORG001	Color	1
PROP004	ORG001	Brand	1
PROP005	ORG001	Processor	1
PROP006	ORG001	Ram Size	1
PROP007	ORG001	Monitor Size	1
PROP008	ORG001	Resolution	1
PROP009	ORG001	Panel Type	1
PROP010	ORG001	Connectivity	1
PROP011	ORG001	Layout	1
PROP012	ORG001	Type	1
PROP013	ORG001	Capacity	1
PROP014	ORG001	Backup Time	1
PROP015	ORG001	Battery Type	1
PROP016	ORG001	Lumens	1
PROP017	ORG001	Throw Distance	1
PROP018	ORG001	Band Type	1
PROP019	ORG001	Speed	1
PROP020	ORG001	No of ports	1
PROP021	ORG001	Night Vision	1
PROP022	ORG001	Lense Type	1
PROP023	ORG001	Camera Specs	1
PROP024	ORG001	Energy Rating	1
PROP025	ORG001	Fuel Type	1
PROP026	ORG001	Phase Type	1
PROP027	ORG001	Lisence Type	1
PROP029	ORG001	Software Name	1
PROP028	ORG001	Connectivity	1
PROP030	ORG001	Printer Type	1
PROP031	ORG001	Template	1
PROP032	ORG001	IP_ADDRESS	1
\.


--
-- Data for Name: tblScrapSalesDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblScrapSalesDocs" (ssdoc_id, ssh_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
SSDOC72550852259	SSH0001	DTO015	\N	scrap-sales/SSH0001/1757072550852_75f269a5.pdf	f	\N	ORG001
SSDOC73086132226	SSH0004	DTO015	\N	scrap-sales/SSH0004/1757073086132_d1a995f0.pdf	f	\N	ORG001
SSDOC73185509671	SSH0005	DTO001	Other	scrap-sales/SSH0005/1757073185509_11bd4b7f.pdf	f	\N	ORG001
SSDOC73136950469	SSH0005	DTO015	\N	scrap-sales/SSH0005/1757073136950_c303e6d4.pdf	f	\N	ORG001
SSDOC81192790150	SSH0005	DTO015	\N	scrap-sales/SSH0005/1758181192790_e0163730.pdf	t	scrap-sales/SSH0005/1758181192790_e0163730.pdf	ORG001
\.


--
-- Data for Name: tblScrapSales_D; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblScrapSales_D" (ssd_id, ssh_id, asd_id, sale_value) FROM stdin;
SSD0001	SSH0001	ASD0001	500
SSD0002	SSH0001	ASD0002	750
SSD0003	SSH0001	ASD0003	1250
SSD0004	SSH0002	ASD0014	1000
SSD0005	SSH0003	ASD0013	300
SSD0006	SSH0003	ASD0011	300
SSD0007	SSH0004	ASD0017	2
SSD0008	SSH0004	ASD0018	2
SSD0009	SSH0005	ASD0016	300
SSD0010	SSH0006	ASD0026	5000
\.


--
-- Data for Name: tblScrapSales_H; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblScrapSales_H" (ssh_id, org_id, text, total_sale_value, buyer_name, buyer_company, buyer_phone, created_by, created_on, changed_by, changed_on, sale_date, collection_date, invoice_no, po_no, branch_code) FROM stdin;
SSH0001	ORG001	Bulk Laptop Sale to Tech Recyclers	{2500}	John Smith	Tech Recyclers Inc.	+1-555-0123	USR002	2025-08-13 00:00:00	USR002	2025-08-13 00:00:00	2024-01-15 00:00:00	2024-01-20 00:00:00	INV-2024-001	PO-2024-001	101
SSH0002	ORG001	Scrap Sale	{1000}	Akash	Akash Jaiswal	07633092708	USR001	2025-08-18 00:00:00	USR001	2025-08-18 00:00:00	2025-08-18 00:00:00	2025-08-18 00:00:00	\N	\N	101
SSH0003	ORG001	Test Group	{600}	Rahul	Rahul Pvt Ltd	7633092708	USR001	2025-08-19 00:00:00	USR001	2025-08-19 00:00:00	2025-08-19 00:00:00	2025-08-19 00:00:00	\N	\N	101
SSH0004	ORG001	Mirrors	{4}	Akash	Akash	7633092708	USR001	2025-09-05 00:00:00	USR001	2025-09-05 00:00:00	2025-09-05 00:00:00	2025-09-05 00:00:00	\N	\N	101
SSH0005	ORG001	fans	{300}	Test Buyer	Akash	+917633092708	USR001	2025-09-05 00:00:00	USR001	2025-09-05 00:00:00	2025-09-05 00:00:00	2025-09-05 00:00:00	\N	\N	101
SSH0006	ORG001	Testing	{5000}	test	Akash	+917633092708	USR001	2025-10-28 00:00:00	USR001	2025-10-28 00:00:00	2025-10-28 00:00:00	2025-10-28 00:00:00	\N	\N	101
\.


--
-- Data for Name: tblTableFilterColumns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblTableFilterColumns" (id, tablename, columns_csv, created_at) FROM stdin;
1	tblassettypes	org_id,asset_type_id,maintenance_schedule,assignment_type,rogue_inspection,group_required,created_by,created_on,changed_by,changed_on,text	2025-07-10 10:52:06.131218
2	tblbranches	org_id,text,city,branch_code,created_by,created_on,changed_by,changed_on	2025-07-10 10:52:06.219133
3	tbldepartments	org_id,dept_id,text,parent_id,branch_code,created_on,changed_on,changed_by,created_by	2025-07-10 10:52:06.333887
4	tbldeptadmins	org_id,dept_id,user_id,created_by,created_on	2025-07-10 10:52:06.681804
5	tbldeptassets	dept_id,asset_type_id,org_id,created_by,created_on,changed_by,changed_on	2025-07-10 10:52:06.79245
6	tblidsequences	table_key,prefix,last_number	2025-07-10 10:52:06.948425
7	tbljobroles	org_id,job_role_id,text,job_function	2025-07-10 10:52:07.099283
8	tblorgs	org_id,text,valid_from,valid_to	2025-07-10 10:52:07.210045
9	tbltablefiltercolumns	tablename,columns_csv,created_at	2025-07-10 10:52:07.298198
10	tblusers	org_id,user_id,full_name,email,phone,job_role_id,password,created_by,created_on,changed_by,changed_on,reset_token,reset_token_expiry,last_accessed,time_zone,date_format,language_code,dept_id	2025-07-10 10:52:07.384208
\.


--
-- Data for Name: tblTechnicalLogConfig; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblTechnicalLogConfig" (id, app_id, log_level, enabled, created_on, updated_on) FROM stdin;
1	DASHBOARD	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
3	ASSETASSIGNMENT	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
4	VENDORS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
7	WORKORDERMANAGEMENT	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
19	MASTERDATA	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
20	ORGANIZATIONS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
21	ASSETTYPES	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
22	DEPARTMENTS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
23	BRANCHES	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
24	USERS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
25	MAINTENANCESCHEDULE	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
26	AUDITLOGS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
27	AUDITLOGCONFIG	ERROR	t	2025-10-15 18:12:30.189106	2025-10-15 18:12:30.189106
33	MAINTENANCECRON	INFO	t	2025-10-23 15:20:52.892953	2025-10-23 15:20:52.892953
28	GROUPASSET	INFO	t	2025-10-15 18:12:30.189106	2025-10-23 17:48:14.697451
2	ASSETS	INFO	t	2025-10-15 18:12:30.189106	2025-10-16 14:49:46.91271
9	MAINTENANCEAPPROVAL	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 05:21:02.236781
11	REPORTBREAKDOWN	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:10:01.16607
12	ASSETLIFECYCLEREPORT	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
13	ASSETREPORT	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
14	MAINTENANCEHISTORY	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
15	ASSETVALUATION	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
16	ASSETWORKFLOWHISTORY	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
17	BREAKDOWNHISTORY	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:20:54.999388
31	LOGIN	INFO	t	2025-10-15 18:12:30.189106	2025-10-19 06:55:52.216016
5	DEPTASSIGNMENT	INFO	t	2025-10-15 18:12:30.189106	2025-10-22 12:10:29.145647
6	EMPASSIGNMENT	INFO	t	2025-10-15 18:12:30.189106	2025-10-22 12:10:29.225771
32	SERIALNUMBERPRINT	INFO	t	2025-10-22 13:25:07.742451	2025-10-22 13:25:07.742451
10	SUPERVISORAPPROVAL	INFO	t	2025-10-15 18:12:30.189106	2025-10-22 13:41:24.273228
29	SCRAPSALES	INFO	t	2025-10-15 18:12:30.189106	2025-10-22 14:15:35.402793
8	INSPECTION	ERROR	t	2025-10-15 18:12:30.189106	2025-10-23 11:17:03.816555
18	ADMINSETTINGS	ERROR	t	2025-10-15 18:12:30.189106	2025-10-23 11:17:03.926783
30	SCRAPASSETS	INFO	t	2025-10-15 18:12:30.189106	2025-10-23 11:17:16.241652
\.


--
-- Data for Name: tblUserJobRoles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblUserJobRoles" (user_job_role_id, user_id, job_role_id) FROM stdin;
UJR004	USR004	JR001
UJR005	USR005	JR002
UJR006	USR006	JR002
UJR007	USR007	JR003
UJR008	USR008	JR003
UJR010	USR010	JR004
UJR011	USR011	JR004
UJR012	USR012	JR005
UJR013	USR013	JR005
UJR014	USR014	JR005
UJR002	USR002	JR001
SA_JR001_admin	admin	JR001
SA_JR002_manager	manager	JR002
SA_JR003_supervisor	supervisor	JR003
SA_JR004_user1	user1	JR004
SA_JR005_user2	user2	JR005
UJR017	USR010	JR006
UJR018	USR011	JR006
UJR020	USR018	JR004
UJR009	USR009	JR002
UJR028	USR022	JR002
UJR029	USR023	JR001
UJR030	USR023	JR002
UJR032	USR016	JR008
UJR033	USR017	JR009
UJR037	USR021	JR012
UJR031	USR015	JR007
UJR034	USR019	JR010
UJR035	USR020	JR011
UJR036	USR021	JR011
UJR038	USR024	JR001
UJR001	USR001	JR001
UJR003	USR003	JR002
\.


--
-- Data for Name: tblUsers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblUsers" (org_id, user_id, full_name, email, phone, job_role_id, password, created_by, created_on, changed_by, changed_on, reset_token, reset_token_expiry, last_accessed, time_zone, date_format, language_code, int_status, dept_id, emp_int_id, branch_id) FROM stdin;
ORG001	USR020	Chief Officer	chiefofficer@gmail.com	8508223156	JR011	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-08	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0028	\N
ORG001	USR014	Rohan Deepak Kulkarni	mailto:rohan.kulkarni@live.com	9876543210	JR005	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT206	\N	\N
ORG001	USR005	Aryan Babu Mehra	mailto:aryan.mehra@outlook.com	9876543210	JR002	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT201	\N	\N
ORG001	USR006	Sneha Kaur Singh	mailto:sneha.singh@yahoo.com	9876543210	JR002	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT202	\N	\N
ORG001	USR007	Rahul Ramesh Iyer	mailto:rahul.iyer@gmail.com	9876543210	JR003	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT203	\N	\N
ORG001	USR011	Neha Vinod Patil	mailto:neha.patil@gmail.com	9876543210	JR004	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT204	\N	\N
ORG001	USR002	Narendrapradhap	narenrio756@gmail.com	9952658366	JR001	$2b$10$1Dol6AYy72MQ9PEbpHurpuvnp.K87icX3ms9Vo5bpLS7fEwie/Sde	USR001	2025-07-14	USR001	2025-07-14	\N	\N	2025-11-07	IST	YYYY-MM-DD	en	1	DPT202	EMP_INT_0002	BR001
ORG001	USR013	Isha Kumari Yadav	mailto:isha.yadav@yahoo.com	9876543210	JR005	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT206	\N	\N
ORG001	USR008	Priya Nandita Rao	\N	9876543210	admin/DPT303	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT203	\N	\N
ORG001	USR018	Priya Nandita Rao	mailtopriya.rao@hotmail.com	9876543210	JR004	$2b$10$.1n1HCeeSJLTw36YER8TWeQmr/3dBBmRt6cjgfnB3N5XKLKh4nQVG	USR002	2025-09-18	USR002	2025-09-18	\N	\N	2025-09-18	IST	YYYY-MM-DD	en	1	DPT203	EMP_INT_0008	\N
ORG001	USR015	M Supervisor	msupervisor@gmail.com	8508223156	JR007	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-31	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0024	\N
ORG001	USR010	Karan Arjun Sharma	mailto:karan.sharma@protonmail.com	9876543210	JR004	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT204	\N	\N
ORG001	USR012	Manish Raju Deshmukh	mailto:manish.deshmukh@outlook.com	9876543210	JR005	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT205	\N	\N
ORG001	USR024	Maria Shilpa 	shilpa@riobizsols.com	967789085	JR001	$2b$10$IPULPnlUPSCxKsi0QQUBSee6G3frZxW1MWFTXhe0NKSS8psar8JzO	SYSADMIN	2025-07-01	USR001	2025-09-15	\N	\N	2025-11-03	IST	YYYY-MM-DD	en	1	DPT202	\N	\N
ORG001	USR019	IT Manager 	itmanager@gmail.com	8508223156	JR010	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-08	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0027	\N
ORG001	USR001	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	JR001	$2b$10$IPULPnlUPSCxKsi0QQUBSee6G3frZxW1MWFTXhe0NKSS8psar8JzO	SYSADMIN	2025-07-01	USR001	2025-09-15	ba8e961b42701544c556c5744579928db51cae59c212f160142b0c8a09c7affc	2025-10-15 03:35:47.491	2025-11-06	IST	YYYY-MM-DD	en	1	DPT202	EMP_INT_0001	BR001
ORG001	USR016	Asset Manager 	assetmanager@gmail.com	8508223156	JR008	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-09	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0025	\N
ORG001	USR023	Akash Dev Malhotra	akash.malhotra@rediffmail.com	9876543210	\N	$2b$10$lP2cw4spWsD94/7a5OXDpeWCWeo0fYqz7fFc/p8gcMeWj8Fz2Pin.	USR001	2025-09-18	USR001	2025-09-18	\N	\N	2025-09-18	IST	YYYY-MM-DD	en	1	DPT203	EMP_INT_0009	\N
ORG001	USR004	Tony Rozario	tony.rozario@gmail.com	8884910777	JR001	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	\N	2025-08-01	ff65628fdf33cfe31adfb581468e787a55727891b1d9fdc81f646024b19fb904	2025-10-14 15:23:07.278	2025-08-01	IST	YYYY-MM-DD	en	1	DPT201	EMP_INT_0004	\N
ORG001	USR017	Procurement Manager 	procurementmanager@gmail.com	8508223156	JR009	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-09	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0026	\N
ORG001	USR022	Tester	aakashjaiswal0706@gmail.com	7633092708	admin/DPT202	$2b$10$2Ima5Fyp0xLS9hbZmmIvN.Jev3arPdNSetYCX.Ucs5FxxGStRfBca	USR001	2025-09-18	USR001	2025-09-18	\N	\N	2025-09-18	IST	YYYY-MM-DD	en	1	DPT202	EMP_INT_0015	\N
ORG001	USR021	Production Supervisor	productionsupervisor@gmail.com	8508223156	JR012	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	\N	\N	2025-10-09	IST	YYYY-MM-DD	en	1	DPT400	EMP_INT_0029	\N
ORG001	USR003	Nivetha Kaliyappan 	nivethakaliyappan@gmail.com	8508223156	JR002	$2b$10$/aOAluUZ.XRHASx4nZ3HvODVN6r0Qiqfeam.aFfI5KAcMJROvsGWe	SYSADMIN	2025-08-01	USR003	2025-08-01	2ae0e93a9aa2d2ff152b43b28f621b462ab3224a6b470d3bcda544c04dd1ebea	2025-10-06 10:21:32.703	2025-11-07	IST	YYYY-MM-DD	en	1	DPT201	EMP_INT_0003	\N
ORG001	USR009	Akash Dev Malhotra	mailto:akash.malhotra@rediffmail.com	9876543210	JR004	$2b$10$RYLJtPf49jlHYrMA/5Z3ceG2a8pcz26KX8hxbRVtKjlPqFx1vt/c6	SYSADMIN	2025-08-01	\N	2025-08-01	\N	\N	2025-08-01	IST	YYYY-MM-DD	en	1	DPT203	\N	\N
\.


--
-- Data for Name: tblVendorDocs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblVendorDocs" (vd_id, vendor_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id) FROM stdin;
VD004	V001	DTO002	\N	assetlifecyclemanagement/ORG001/vendors/V001/1756988154551_223184127ba0974a.png	t	assetlifecyclemanagement/vendors/Archived Vendor Document/V001/1756988154551_223184127ba0974a.png	ORG001
VD006	V022	DTO002	\N	assetlifecyclemanagement/ORG001/vendors/V022/1757069012155_ac1e023abc35efc3.pdf	f	\N	ORG001
VD005	V001	DTO001	Test Vendor Document	assetlifecyclemanagement/ORG001/vendors/V001/1757065885507_142830eb7f72efd4.txt	t	assetlifecyclemanagement/vendors/Archived Vendor Document/V001/1757065885507_142830eb7f72efd4.txt	ORG001
VD007	V022	DTO001	other	assetlifecyclemanagement/ORG001/vendors/V022/1757069092103_87be45d0933f96a7.pdf	t	assetlifecyclemanagement/vendors/Archived Vendor Document/V022/1757069092103_87be45d0933f96a7.pdf	ORG001
\.


--
-- Data for Name: tblVendorProdService; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblVendorProdService" (ven_prod_serv_id, prod_serv_id, vendor_id, org_id) FROM stdin;
VPS001	PS005	V035	ORG001
VPS002	PS018	V035	ORG001
VPS003	PS021	V020	ORG001
VPS004	PS013	V035	ORG001
VPS005	PS013	V001	ORG001
VPS006	PS011	V035	ORG001
VPS007	PS022	V035	ORG001
VPS008	PS023	V028	ORG001
\.


--
-- Data for Name: tblVendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblVendors" (vendor_id, org_id, vendor_name, int_status, company_name, address_line1, address_line2, city, state, pincode, company_email, gst_number, cin_number, contact_person_name, contact_person_email, contact_person_number, created_by, created_on, changed_by, changed_on, branch_code) FROM stdin;
V035	ORG001	Akash	1	Akash	9th main road mathiere extension	\N	Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	5435435454	54356436356	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-09-25 18:51:31.487	USER123	2025-09-30 11:32:27.707	101
V007	ORG001	Acme Supplies Pvt Ltd	1	RioBizSols	9th main road mathiere extension		Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	27AAECA1234F1Z5	54435435345	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-08-04 17:27:37.543	admin	2025-08-04 17:27:37.543	101
V001	ORG001	Karthick	1	Acme Supplies Pvt Ltd	123 Main Street	Suite 400	Mumbai	Maharashtra	400001	info@acmesupplies.com	27AAECA1234F1Z5	U12345MH2010PTC123456	Rajesh Kumar	rajesh.kumar@acmesupplies.com	9876543210	admin	2024-06-01 10:00:00	USER123	2025-09-30 11:33:00.727	101
V002	ORG001	Jeniefer Antony	1	Bright Tech Solutions	456 Park Avenue	Floor 2	Bengaluru	Karnataka	560001	contact@brighttech.com	29AAECB5678G2Z6	U67890KA2012PTC654321	Priya Sharma	priya.sharma@brighttech.com	+91-9123456780	system	2024-05-15 09:30:00	system	2024-05-20 11:45:00	101
V003	ORG001	Solomon	0	Test Vendor Pvt Ltd	101 Test Lane	Suite 10	Chennai	Tamil Nadu	600001	test@vendor.com	33AAECT1234F1Z8	U12345TN2011PTC123457	Suresh Iyer	suresh.iyer@vendor.com	+91-9000000001	admin	2024-06-10 10:00:00	admin	2024-06-10 10:00:00	101
V004	ORG001	Prabhakaran	1	Ace Pack Machines	30 Lakshmi Mills	Peelamedu	Coimbatore	Tamil Nadu	641104	acepack@gmail.com	29ABCDE1234F1Z5	U12345TN2020PTC012345	Prabhakaran	prabhakaran@gmail.com	9850379432	system	2024-06-01 10:00:00	system	2024-06-05 15:30:00	101
V005	ORG001	Deepika	1	Jeneral Engg Works	Dhamu Nagar	Ramanathapuram	Coimbatore	Tamil Nadu	641045	deepika@gmail.com	33PQRS5678L9Z3	L54321KA2015PLC098765	Deepika	deepika@gmail.com	8760945610	system	2024-06-01 10:00:00	system	2024-06-05 15:30:00	101
V008	ORG001	Ramesh	1	Bajaj Suppliers	9th main road mathiere extension		Bengaluru	Karnataka	560054	ramesh@gmail.com	5435435454	54356436356	Ramesh	ramesh@gmail.com	9876543210	admin	2025-08-05 17:50:13.241	admin	2025-08-05 17:50:13.241	101
V015	ORG001	Akash	1	RioBizSols	9th main road mathiere extension		Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	5435435454	54435435345	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-08-29 17:40:17.966	admin	2025-08-29 17:40:17.966	101
V029	ORG001	Shruti	0	Shruti pvt ltd	9th main road mathiere extension	\N	Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	27AAECA1234F1Z5	54356436356	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-09-19 16:27:55.87	USER123	2025-09-30 11:21:40.876	101
V006	ORG001	Ramesh Kishna	1	Binary Computers	Ram Nagar	Gandhipuram	Coimbatore	Tamil Nadu	641041	binarycomputers@gmail.com	07LMNOP7890G2Z2	U65999MH2021PLC123456	ranjith	ranjith@gmail.com	9944387601	system	2024-06-01 10:00:00	system	2024-06-05 15:30:00	101
V023	ORG001	Test Vendor.	1	Test Company Ltd	123 Test Street,	Suite 100	Mumbai	Maharashtra	400001	test@company.com	27ABCDE1234F1Z5	U12345MH2020PTC123456	John Doe	john@company.com	9876543210	admin	2025-09-05 16:10:29.2	USER123	2025-09-16 11:24:43.112	101
V020	ORG001	Rahul	1	Akash	9th main road mathiere extension		Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	5435435454	54356436356	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-08-29 17:47:20.571	admin	2025-08-29 17:47:20.571	101
V021	ORG001	Rahul	1	Akash	9th main road mathiere extension		Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	5435435454	U12345MH2010PTC123456	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-08-29 17:54:06.608	admin	2025-08-29 17:54:06.608	101
V022	ORG001	Akash	1	Akash	9th main road mathiere extension		Bengaluru	Karnataka	560054	realakashjaiswal@gmail.com	27AAECA1234F1Z5	U12345MH2010PTC123456	Akash Jaiswal	realakashjaiswal@gmail.com	7633092708	admin	2025-09-05 16:10:08.529	admin	2025-09-05 16:10:08.529	101
V027	ORG001	Reshma 	1	Iceberg Technologies 	kodaikanal 		kodaikanal	Tamil Nadu 	641045 	reshma@gmail.com					8509753223	admin	2025-09-18 08:27:04.133	admin	2025-09-18 08:27:04.133	101
V028	ORG001	Reshma 	1	Iceberg Technologies 	kodaikanal 		kodaikanal	Tamil Nadu 	641045   	reshma@gmail.com			Reshma 	8509753223	8509753223	admin	2025-09-18 09:21:03.985	admin	2025-09-18 09:21:03.985	101
\.


--
-- Data for Name: tblWFATSeqs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id) FROM stdin;
WFATS-02	AT001	WFS-02	10	ORG001
WFATS-03	AT001	WFS-03	20	ORG001
WFATS-06	AT001	WFS-06	30	ORG001
WFATS-08	AT002	WFS-02	10	ORG001
WFATS-09	AT002	WFS-03	20	ORG001
WFATS-10	AT002	WFS-06	30	ORG001
WFATS-11	AT003	WFS-02	10	ORG001
WFATS-12	AT003	WFS-03	20	ORG001
WFATS-13	AT003	WFS-06	30	ORG001
WFATS-14	AT009	WFS-05	10	ORG001
WFATS-15	AT009	WFS-06	20	ORG001
WFATS-17	AT010	WFS-06	20	ORG001
WFATS-18	AT011	WFS-05	10	ORG001
WFATS-19	AT011	WFS-06	20	ORG001
WFATS-07	AT009	WFS-04	10	ORG001
WFATS-20	AT053	WFS-02	10	ORG001
WFATS-21	AT053	WFS-06	20	ORG001
WFATS-16	AT010	WFS-02	10	ORG001
WFATS-22	AT008	WFS-06	20	ORG001
WFATS-23	AT008	WFS-02	10	ORG001
WFATS-24	AT054	WFS-02	10	ORG001
WFATS-25	AT054	WFS-06	20	ORG001
\.


--
-- Data for Name: tblWFAssetMaintHist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFAssetMaintHist" (wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id) FROM stdin;
\.


--
-- Data for Name: tblWFAssetMaintSch_D; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFAssetMaintSch_D" (wfamsd_id, wfamsh_id, job_role_id, dept_id, sequence, status, notes, created_by, created_on, changed_by, changed_on, org_id, user_id) FROM stdin;
WFAMSD_01	WFAMSH_01	JR002	DPT201	10	AP	Group maintenance for 24 assets	system	2025-11-10 12:49:32.843742	\N	\N	ORG001	\N
WFAMSD_02	WFAMSH_01	JR003	DPT201	20	IN	Group maintenance for 24 assets	system	2025-11-10 12:49:33.553775	\N	\N	ORG001	\N
WFAMSD_03	WFAMSH_01	JR001	DPT201	30	IN	Group maintenance for 24 assets	system	2025-11-10 12:49:33.670807	\N	\N	ORG001	\N
WFAMSD_04	WFAMSH_02	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:34.022238	\N	\N	ORG001	\N
WFAMSD_05	WFAMSH_02	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:34.722212	\N	\N	ORG001	\N
WFAMSD_06	WFAMSH_02	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:34.866274	\N	\N	ORG001	\N
WFAMSD_07	WFAMSH_03	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:35.186152	\N	\N	ORG001	\N
WFAMSD_08	WFAMSH_03	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:35.911414	\N	\N	ORG001	\N
WFAMSD_09	WFAMSH_03	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:36.034956	\N	\N	ORG001	\N
WFAMSD_10	WFAMSH_04	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:36.354465	\N	\N	ORG001	\N
WFAMSD_11	WFAMSH_04	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:37.095975	\N	\N	ORG001	\N
WFAMSD_12	WFAMSH_04	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:37.211915	\N	\N	ORG001	\N
WFAMSD_13	WFAMSH_05	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:37.525667	\N	\N	ORG001	\N
WFAMSD_14	WFAMSH_05	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:38.206224	\N	\N	ORG001	\N
WFAMSD_15	WFAMSH_05	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:38.337385	\N	\N	ORG001	\N
WFAMSD_16	WFAMSH_06	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:38.716646	\N	\N	ORG001	\N
WFAMSD_17	WFAMSH_06	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:39.573912	\N	\N	ORG001	\N
WFAMSD_18	WFAMSH_06	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:39.705463	\N	\N	ORG001	\N
WFAMSD_19	WFAMSH_07	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:40.049189	\N	\N	ORG001	\N
WFAMSD_20	WFAMSH_07	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:40.767168	\N	\N	ORG001	\N
WFAMSD_21	WFAMSH_07	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:40.893641	\N	\N	ORG001	\N
WFAMSD_22	WFAMSH_08	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:41.331175	\N	\N	ORG001	\N
WFAMSD_23	WFAMSH_08	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:42.026654	\N	\N	ORG001	\N
WFAMSD_24	WFAMSH_08	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:42.148124	\N	\N	ORG001	\N
WFAMSD_25	WFAMSH_09	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:42.472204	\N	\N	ORG001	\N
WFAMSD_26	WFAMSH_09	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:43.192418	\N	\N	ORG001	\N
WFAMSD_27	WFAMSH_09	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:43.30892	\N	\N	ORG001	\N
WFAMSD_28	WFAMSH_10	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:43.648449	\N	\N	ORG001	\N
WFAMSD_29	WFAMSH_10	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:44.349899	\N	\N	ORG001	\N
WFAMSD_30	WFAMSH_10	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:44.487926	\N	\N	ORG001	\N
WFAMSD_31	WFAMSH_11	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:44.808411	\N	\N	ORG001	\N
WFAMSD_32	WFAMSH_11	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:45.533808	\N	\N	ORG001	\N
WFAMSD_33	WFAMSH_11	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:45.672677	\N	\N	ORG001	\N
WFAMSD_34	WFAMSH_12	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:45.991575	\N	\N	ORG001	\N
WFAMSD_35	WFAMSH_12	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:46.730128	\N	\N	ORG001	\N
WFAMSD_36	WFAMSH_12	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:46.852148	\N	\N	ORG001	\N
WFAMSD_37	WFAMSH_13	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:47.169626	\N	\N	ORG001	\N
WFAMSD_38	WFAMSH_13	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:47.891366	\N	\N	ORG001	\N
WFAMSD_39	WFAMSH_13	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:48.022843	\N	\N	ORG001	\N
WFAMSD_40	WFAMSH_14	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:48.370365	\N	\N	ORG001	\N
WFAMSD_41	WFAMSH_14	JR003	DPT201	20	IN	\N	system	2025-11-10 12:49:49.089901	\N	\N	ORG001	\N
WFAMSD_42	WFAMSH_14	JR001	DPT201	30	IN	\N	system	2025-11-10 12:49:49.214143	\N	\N	ORG001	\N
WFAMSD_43	WFAMSH_15	JR002	DPT201	10	AP	Group maintenance for 4 assets	system	2025-11-10 12:49:49.699093	\N	\N	ORG001	\N
WFAMSD_44	WFAMSH_15	JR003	DPT201	20	IN	Group maintenance for 4 assets	system	2025-11-10 12:49:50.414827	\N	\N	ORG001	\N
WFAMSD_45	WFAMSH_15	JR001	DPT201	30	IN	Group maintenance for 4 assets	system	2025-11-10 12:49:50.53782	\N	\N	ORG001	\N
WFAMSD_46	WFAMSH_16	JR002	DPT201	10	AP	Group maintenance for 1 assets	system	2025-11-10 12:49:50.967926	\N	\N	ORG001	\N
WFAMSD_47	WFAMSH_16	JR003	DPT201	20	IN	Group maintenance for 1 assets	system	2025-11-10 12:49:51.70933	\N	\N	ORG001	\N
WFAMSD_48	WFAMSH_16	JR001	DPT201	30	IN	Group maintenance for 1 assets	system	2025-11-10 12:49:51.828875	\N	\N	ORG001	\N
WFAMSD_49	WFAMSH_17	JR002	DPT201	10	AP	Group maintenance for 2 assets	system	2025-11-10 12:49:53.851002	\N	\N	ORG001	\N
WFAMSD_50	WFAMSH_17	JR001	DPT201	20	IN	Group maintenance for 2 assets	system	2025-11-10 12:49:54.61061	\N	\N	ORG001	\N
WFAMSD_51	WFAMSH_18	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:57.604578	\N	\N	ORG001	\N
WFAMSD_52	WFAMSH_18	JR001	DPT201	20	IN	\N	system	2025-11-10 12:49:58.414549	\N	\N	ORG001	\N
WFAMSD_53	WFAMSH_19	JR002	DPT201	10	AP	\N	system	2025-11-10 12:49:58.757088	\N	\N	ORG001	\N
WFAMSD_54	WFAMSH_19	JR001	DPT201	20	IN	\N	system	2025-11-10 12:49:59.642783	\N	\N	ORG001	\N
\.


--
-- Data for Name: tblWFAssetMaintSch_H; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFAssetMaintSch_H" (wfamsh_id, at_main_freq_id, maint_type_id, asset_id, group_id, vendor_id, pl_sch_date, act_sch_date, status, created_by, created_on, changed_by, changed_on, org_id, existing_ams_id, branch_code) FROM stdin;
WFAMSH_01	ATMF001	MT002	ASS023	NULL	V006	2025-06-06 00:00:00	\N	IN	system	2025-11-10 12:49:32.673846	\N	\N	ORG001	\N	101
WFAMSH_02	ATMF001	MT002	ASS001	\N	V002	2025-09-03 00:00:00	\N	IN	system	2025-11-10 12:49:33.872286	\N	\N	ORG001	\N	102
WFAMSH_03	ATMF001	MT002	ASS002	\N	\N	2025-08-27 00:00:00	\N	IN	system	2025-11-10 12:49:35.036176	\N	\N	ORG001	\N	101
WFAMSH_04	ATMF001	MT002	ASS004	\N	V005	2025-10-01 00:00:00	\N	IN	system	2025-11-10 12:49:36.203012	\N	\N	ORG001	\N	102
WFAMSH_05	ATMF001	MT002	ASS005	\N	V004	2025-09-03 00:00:00	\N	IN	system	2025-11-10 12:49:37.372987	\N	\N	ORG001	\N	102
WFAMSH_06	ATMF001	MT002	ASS074	\N	V001	2024-01-31 00:00:00	\N	IN	system	2025-11-10 12:49:38.545274	\N	\N	ORG001	\N	101
WFAMSH_07	ATMF001	MT002	ASS077	\N	V002	2025-10-11 00:00:00	\N	IN	system	2025-11-10 12:49:39.876414	\N	\N	ORG001	\N	101
WFAMSH_08	ATMF001	MT002	ASS092	\N	V002	2025-10-22 00:00:00	\N	IN	system	2025-11-10 12:49:41.154343	\N	\N	ORG001	\N	101
WFAMSH_09	ATMF001	MT002	ASS096	\N	V002	2025-10-25 00:00:00	\N	IN	system	2025-11-10 12:49:42.318127	\N	\N	ORG001	\N	101
WFAMSH_10	ATMF001	MT002	AST001	\N	V001	2024-03-05 00:00:00	\N	IN	system	2025-11-10 12:49:43.476921	\N	\N	ORG001	\N	101
WFAMSH_11	ATMF001	MT002	AST002	\N	V002	2024-03-03 00:00:00	\N	IN	system	2025-11-10 12:49:44.65044	\N	\N	ORG001	\N	101
WFAMSH_12	ATMF001	MT002	AST003	\N	V001	2024-03-05 00:00:00	\N	IN	system	2025-11-10 12:49:45.837172	\N	\N	ORG001	\N	101
WFAMSH_13	ATMF001	MT002	AST004	\N	V001	2024-03-05 00:00:00	\N	IN	system	2025-11-10 12:49:47.016079	\N	\N	ORG001	\N	101
WFAMSH_14	ATMF001	MT002	AST005	\N	V001	2024-03-05 00:00:00	\N	IN	system	2025-11-10 12:49:48.199909	\N	\N	ORG001	\N	101
WFAMSH_15	ATMF002	MT002	ASS006	AGH008	V002	2025-10-29 00:00:00	\N	IN	system	2025-11-10 12:49:49.53316	\N	\N	ORG001	\N	102
WFAMSH_16	ATMF002	MT002	ASS059	AGH012	V002	2025-11-11 00:00:00	\N	IN	system	2025-11-10 12:49:50.791407	\N	\N	ORG001	\N	102
WFAMSH_17	ATMF019	MT002	ASS018	AGH019	V003	2025-10-13 00:00:00	\N	IN	system	2025-11-10 12:49:53.69107	\N	\N	ORG001	\N	101
WFAMSH_18	ATMF018	MT001	ASS100	\N	V001	2024-10-15 00:00:00	\N	IN	system	2025-11-10 12:49:57.420802	\N	\N	ORG001	\N	101
WFAMSH_19	ATMF018	MT001	ASS101	\N	V035	2025-11-16 00:00:00	\N	IN	system	2025-11-10 12:49:58.590016	\N	\N	ORG001	\N	101
\.


--
-- Data for Name: tblWFJobRole; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFJobRole" (wf_job_role_id, wf_steps_id, job_role_id, emp_int_id, dept_id, org_id) FROM stdin;
WFJR-01	WFS-01	JR001	\N	DPT201	ORG001
WFJR-04	WFS-04	JR001	\N	DPT201	ORG001
WFJR-06	WFS-06	JR001	\N	DPT201	ORG001
WFJR-03	WFS-03	JR003	\N	DPT201	ORG001
WFJR-05	WFS-05	JR002	\N	DPT201	ORG001
WFJR-02	WFS-02	JR002	\N	DPT201	ORG001
\.


--
-- Data for Name: tblWFSteps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."tblWFSteps" (wf_steps_id, org_id, text) FROM stdin;
WFS-01	ORG001	Approved
WFS-03	ORG001	HR Approved
WFS-04	ORG001	IT Department Approved
WFS-05	ORG001	Department Head Approved
WFS-06	ORG001	Final Approval
WFS-02	ORG001	User Approved
\.


--
-- Name: tblTechnicalLogConfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."tblTechnicalLogConfig_id_seq"', 39, true);


--
-- Name: tblWFATSeqs_wf_at_seqs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."tblWFATSeqs_wf_at_seqs_id_seq"', 1, false);


--
-- Name: tbltablefiltercolumns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tbltablefiltercolumns_id_seq', 10, true);


--
-- Name: tblATDocs atd_id_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATDocs"
    ADD CONSTRAINT atd_id_pk PRIMARY KEY (atd_id);


--
-- Name: tblJobRoles job_role_id_UK; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblJobRoles"
    ADD CONSTRAINT "job_role_id_UK" UNIQUE (job_role_id);


--
-- Name: tblATBRReasonCodes tblATBRReasonCodes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATBRReasonCodes"
    ADD CONSTRAINT "tblATBRReasonCodes_pkey" PRIMARY KEY (atbrrc_id);


--
-- Name: tblATMaintCheckList tblATMaintCheckList_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintCheckList"
    ADD CONSTRAINT "tblATMaintCheckList_pkey" PRIMARY KEY (at_main_checklist_id);


--
-- Name: tblATMaintFreq tblATMaintFreq_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintFreq"
    ADD CONSTRAINT "tblATMaintFreq_pkey" PRIMARY KEY (at_main_freq_id);


--
-- Name: tblApps tblApps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblApps"
    ADD CONSTRAINT "tblApps_pkey" PRIMARY KEY (app_id);


--
-- Name: tblAssetAssignments tblAssetAssignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetAssignments"
    ADD CONSTRAINT "tblAssetAssignments_pkey" PRIMARY KEY (asset_assign_id);


--
-- Name: tblAssetBRDet tblAssetBRDet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetBRDet"
    ADD CONSTRAINT "tblAssetBRDet_pkey" PRIMARY KEY (abr_id);


--
-- Name: tblAssetDepHist tblAssetDepreciation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetDepHist"
    ADD CONSTRAINT "tblAssetDepreciation_pkey" PRIMARY KEY (depreciation_id);


--
-- Name: tblAssetDocs tblAssetDocs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetDocs"
    ADD CONSTRAINT "tblAssetDocs_pkey" PRIMARY KEY (a_d_id);


--
-- Name: tblAssetMaintDocs tblAssetDocs_pkey_1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintDocs"
    ADD CONSTRAINT "tblAssetDocs_pkey_1" PRIMARY KEY (amd_id);


--
-- Name: tblAssetGroupDocs tblAssetGroupDocs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroupDocs"
    ADD CONSTRAINT "tblAssetGroupDocs_pkey" PRIMARY KEY (agd_id);


--
-- Name: tblAssetMaintSch tblAssetMaintSch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblAssetMaintSch_pkey" PRIMARY KEY (ams_id);


--
-- Name: tblAssetPropListValues tblAssetPropListValues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropListValues"
    ADD CONSTRAINT "tblAssetPropListValues_pkey" PRIMARY KEY (aplv_id);


--
-- Name: tblAssetPropValues tblAssetPropValues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropValues"
    ADD CONSTRAINT "tblAssetPropValues_pkey" PRIMARY KEY (apv_id);


--
-- Name: tblAssetScrapDet tblAssetScrapDet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetScrapDet"
    ADD CONSTRAINT "tblAssetScrapDet_pkey" PRIMARY KEY (asd_id);


--
-- Name: tblAssetTypeProps tblAssetTypeProps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypeProps"
    ADD CONSTRAINT "tblAssetTypeProps_pkey" PRIMARY KEY (asset_type_prop_id);


--
-- Name: tblAssetTypes tblAssetType_UK; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypes"
    ADD CONSTRAINT "tblAssetType_UK" UNIQUE (asset_type_id);


--
-- Name: tblAssetTypes tblAssetTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypes"
    ADD CONSTRAINT "tblAssetTypes_pkey" PRIMARY KEY (asset_type_id);


--
-- Name: tblAssetUsageReg tblAssetUsageReg_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetUsageReg"
    ADD CONSTRAINT "tblAssetUsageReg_pkey" PRIMARY KEY (aug_id);


--
-- Name: tblAuditLogConfig tblAuditLogConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogConfig"
    ADD CONSTRAINT "tblAuditLogConfig_pkey" PRIMARY KEY (alc_id);


--
-- Name: tblAuditLogs tblAuditLogs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogs"
    ADD CONSTRAINT "tblAuditLogs_pkey" PRIMARY KEY (al_id);


--
-- Name: tblDepreciationSettings tblDepreciationSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDepreciationSettings"
    ADD CONSTRAINT "tblDepreciationSettings_pkey" PRIMARY KEY (setting_id);


--
-- Name: tblDeptAdmins tblDeptAdmins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT "tblDeptAdmins_pkey" PRIMARY KEY (dept_admin_id);


--
-- Name: tblDeptAssetTypes tblDeptAssetTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAssetTypes"
    ADD CONSTRAINT "tblDeptAssetTypes_pkey" PRIMARY KEY (dept_asset_type_id);


--
-- Name: tblDocTypeObjects tblDocTypeObjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDocTypeObjects"
    ADD CONSTRAINT "tblDocTypeObjects_pkey" PRIMARY KEY (dto_id);


--
-- Name: tblEmployees tblEmployees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblEmployees"
    ADD CONSTRAINT "tblEmployees_pkey" PRIMARY KEY (emp_int_id);


--
-- Name: tblEvents tblEvents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblEvents"
    ADD CONSTRAINT "tblEvents_pkey" PRIMARY KEY (event_id);


--
-- Name: tblFCMTokens tblFCMTokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblFCMTokens"
    ADD CONSTRAINT "tblFCMTokens_pkey" PRIMARY KEY (token_id);


--
-- Name: tblJobRoleNav tblJobRoleNav_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblJobRoleNav"
    ADD CONSTRAINT "tblJobRoleNav_pkey" PRIMARY KEY (job_role_nav_id);


--
-- Name: tblMaintStatus tblMaintStatus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblMaintStatus"
    ADD CONSTRAINT "tblMaintStatus_pkey" PRIMARY KEY (maint_status_id);


--
-- Name: tblMaintTypes tblMaintTypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblMaintTypes"
    ADD CONSTRAINT "tblMaintTypes_pkey" PRIMARY KEY (maint_type_id);


--
-- Name: tblNotificationHistory tblNotificationHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationHistory"
    ADD CONSTRAINT "tblNotificationHistory_pkey" PRIMARY KEY (notification_id);


--
-- Name: tblNotificationPreferences tblNotificationPreferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationPreferences"
    ADD CONSTRAINT "tblNotificationPreferences_pkey" PRIMARY KEY (preference_id);


--
-- Name: tblNotificationPreferences tblNotificationPreferences_user_id_notification_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationPreferences"
    ADD CONSTRAINT "tblNotificationPreferences_user_id_notification_type_key" UNIQUE (user_id, notification_type);


--
-- Name: tblOrgSettings tblOrgSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblOrgSettings"
    ADD CONSTRAINT "tblOrgSettings_pkey" PRIMARY KEY (os_id);


--
-- Name: tblPrintSerialNoQueue tblPrintSerialNoQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblPrintSerialNoQueue"
    ADD CONSTRAINT "tblPrintSerialNoQueue_pkey" PRIMARY KEY (psnq_id);


--
-- Name: tblProdServs tblProdServs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblProdServs"
    ADD CONSTRAINT "tblProdServs_pkey" PRIMARY KEY (prod_serv_id);


--
-- Name: tblProps tblProps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblProps"
    ADD CONSTRAINT "tblProps_pkey" PRIMARY KEY (prop_id);


--
-- Name: tblScrapSalesDocs tblScrapSalesDocs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSalesDocs"
    ADD CONSTRAINT "tblScrapSalesDocs_pkey" PRIMARY KEY (ssdoc_id);


--
-- Name: tblScrapSales_D tblScrapSales_D_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_D"
    ADD CONSTRAINT "tblScrapSales_D_pkey" PRIMARY KEY (ssd_id);


--
-- Name: tblScrapSales_H tblScrapSales_H_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_H"
    ADD CONSTRAINT "tblScrapSales_H_pkey" PRIMARY KEY (ssh_id);


--
-- Name: tblTechnicalLogConfig tblTechnicalLogConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblTechnicalLogConfig"
    ADD CONSTRAINT "tblTechnicalLogConfig_pkey" PRIMARY KEY (id);


--
-- Name: tblUserJobRoles tblUserJobRole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUserJobRoles"
    ADD CONSTRAINT "tblUserJobRole_pkey" PRIMARY KEY (user_job_role_id);


--
-- Name: tblVendorDocs tblVendorDocs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorDocs"
    ADD CONSTRAINT "tblVendorDocs_pkey" PRIMARY KEY (vd_id);


--
-- Name: tblVendorProdService tblVendorProdService_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorProdService"
    ADD CONSTRAINT "tblVendorProdService_pkey" PRIMARY KEY (ven_prod_serv_id);


--
-- Name: tblVendors tblVendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendors"
    ADD CONSTRAINT "tblVendors_pkey" PRIMARY KEY (vendor_id);


--
-- Name: tblWFATSeqs tblWFATSeqs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFATSeqs"
    ADD CONSTRAINT "tblWFATSeqs_pkey" PRIMARY KEY (wf_at_seqs_id);


--
-- Name: tblWFAssetMaintHist tblWFAssetMaintHist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintHist"
    ADD CONSTRAINT "tblWFAssetMaintHist_pkey" PRIMARY KEY (wfamhis_id);


--
-- Name: tblWFAssetMaintSch_D tblWFAssetMaintSch_D_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_D"
    ADD CONSTRAINT "tblWFAssetMaintSch_D_pkey" PRIMARY KEY (wfamsd_id);


--
-- Name: tblWFAssetMaintSch_H tblWFAssetMaintSch_H_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblWFAssetMaintSch_H_pkey" PRIMARY KEY (wfamsh_id);


--
-- Name: tblWFJobRole tblWFJobRole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblWFJobRole_pkey" PRIMARY KEY (wf_job_role_id);


--
-- Name: tblWFSteps tblWFSteps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFSteps"
    ADD CONSTRAINT "tblWFSteps_pkey" PRIMARY KEY (wf_steps_id);


--
-- Name: tblAssetGroup_D tblassetgroup_d_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroup_D"
    ADD CONSTRAINT tblassetgroup_d_pkey PRIMARY KEY (assetgroup_d_id);


--
-- Name: tblAssetGroup_H tblassetgroup_h_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroup_H"
    ADD CONSTRAINT tblassetgroup_h_pkey PRIMARY KEY (assetgroup_h_id);


--
-- Name: tblAssets tblassets_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssets"
    ADD CONSTRAINT tblassets_unique UNIQUE (asset_id);


--
-- Name: tblBranches tblbranches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblBranches"
    ADD CONSTRAINT tblbranches_pkey PRIMARY KEY (branch_id);


--
-- Name: tblDeptAdmins tbldeptadmins_dept_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT tbldeptadmins_dept_id_user_id_key UNIQUE (dept_id, user_id);


--
-- Name: tblDeptAdmins tbldeptadmins_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT tbldeptadmins_id_key UNIQUE (dept_admin_id);


--
-- Name: tblIDSequences tblidsequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblIDSequences"
    ADD CONSTRAINT tblidsequences_pkey PRIMARY KEY (table_key);


--
-- Name: tblTableFilterColumns tbltablefiltercolumns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblTableFilterColumns"
    ADD CONSTRAINT tbltablefiltercolumns_pkey PRIMARY KEY (id);


--
-- Name: tblUsers tblusers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUsers"
    ADD CONSTRAINT tblusers_email_key UNIQUE (email);


--
-- Name: tblUsers tblusers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUsers"
    ADD CONSTRAINT tblusers_pkey PRIMARY KEY (user_id);


--
-- Name: tblUsers tblusers_ukey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUsers"
    ADD CONSTRAINT tblusers_ukey UNIQUE (user_id);


--
-- Name: tblPrintSerialNoQueue uk_tblPrintSerialNoQueue_serial_no_org_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblPrintSerialNoQueue"
    ADD CONSTRAINT "uk_tblPrintSerialNoQueue_serial_no_org_id" UNIQUE (serial_no, org_id);


--
-- Name: tblTechnicalLogConfig unique_app_log_config; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblTechnicalLogConfig"
    ADD CONSTRAINT unique_app_log_config UNIQUE (app_id);


--
-- Name: tblBranches unique_branch_code; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblBranches"
    ADD CONSTRAINT unique_branch_code UNIQUE (branch_code);


--
-- Name: tblDepartments unique_dept_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDepartments"
    ADD CONSTRAINT unique_dept_id UNIQUE (dept_id);


--
-- Name: tblOrgs unique_org_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblOrgs"
    ADD CONSTRAINT unique_org_id UNIQUE (org_id);


--
-- Name: idx_asset_assignments_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_asset_id ON public."tblAssetAssignments" USING btree (asset_id);


--
-- Name: idx_asset_assignments_dept_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_dept_id ON public."tblAssetAssignments" USING btree (dept_id);


--
-- Name: idx_asset_assignments_latest_flag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_assignments_latest_flag ON public."tblAssetAssignments" USING btree (asset_id, latest_assignment_flag) WHERE (latest_assignment_flag = true);


--
-- Name: idx_asset_depreciation_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_depreciation_asset_id ON public."tblAssetDepHist" USING btree (asset_id);


--
-- Name: idx_asset_depreciation_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_depreciation_org_id ON public."tblAssetDepHist" USING btree (org_id);


--
-- Name: idx_asset_scrap_det_asd_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_scrap_det_asd_id ON public."tblAssetScrapDet" USING btree (asd_id);


--
-- Name: idx_asset_scrap_det_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_scrap_det_asset_id ON public."tblAssetScrapDet" USING btree (asset_id);


--
-- Name: idx_asset_scrap_det_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_scrap_det_org_id ON public."tblAssetScrapDet" USING btree (org_id);


--
-- Name: idx_asset_scrap_det_scrapped_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_scrap_det_scrapped_date ON public."tblAssetScrapDet" USING btree (asset_id, scrapped_date DESC);


--
-- Name: idx_asset_types_asset_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_types_asset_type_id ON public."tblAssetTypes" USING btree (asset_type_id);


--
-- Name: idx_assets_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_id ON public."tblAssets" USING btree (asset_id);


--
-- Name: idx_assets_asset_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_asset_type_id ON public."tblAssets" USING btree (asset_type_id);


--
-- Name: idx_assets_branch_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_branch_id ON public."tblAssets" USING btree (branch_id);


--
-- Name: idx_assets_created_on; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_created_on ON public."tblAssets" USING btree (created_on DESC);


--
-- Name: idx_assets_current_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_current_status ON public."tblAssets" USING btree (current_status);


--
-- Name: idx_assets_purchase_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_purchase_vendor_id ON public."tblAssets" USING btree (purchase_vendor_id);


--
-- Name: idx_assets_purchased_on; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_purchased_on ON public."tblAssets" USING btree (purchased_on);


--
-- Name: idx_assets_service_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_service_vendor_id ON public."tblAssets" USING btree (service_vendor_id);


--
-- Name: idx_assets_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_status_created ON public."tblAssets" USING btree (current_status, created_on DESC);


--
-- Name: idx_assets_type_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_type_status ON public."tblAssets" USING btree (asset_type_id, current_status);


--
-- Name: idx_branches_branch_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_branches_branch_id ON public."tblBranches" USING btree (branch_id);


--
-- Name: idx_departments_dept_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_departments_dept_id ON public."tblDepartments" USING btree (dept_id);


--
-- Name: idx_depreciation_settings_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_depreciation_settings_org_id ON public."tblDepreciationSettings" USING btree (org_id);


--
-- Name: idx_doc_type_objects_doc_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doc_type_objects_doc_type ON public."tblDocTypeObjects" USING btree (doc_type);


--
-- Name: idx_fcm_tokens_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fcm_tokens_active ON public."tblFCMTokens" USING btree (is_active);


--
-- Name: idx_fcm_tokens_user_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fcm_tokens_user_active ON public."tblFCMTokens" USING btree (user_id, is_active);


--
-- Name: idx_fcm_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fcm_tokens_user_id ON public."tblFCMTokens" USING btree (user_id);


--
-- Name: idx_notification_history_sent_on; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_history_sent_on ON public."tblNotificationHistory" USING btree (sent_on);


--
-- Name: idx_notification_history_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_history_type ON public."tblNotificationHistory" USING btree (notification_type);


--
-- Name: idx_notification_history_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_history_user_id ON public."tblNotificationHistory" USING btree (user_id);


--
-- Name: idx_notification_history_user_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_history_user_type ON public."tblNotificationHistory" USING btree (user_id, notification_type);


--
-- Name: idx_notification_preferences_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_preferences_type ON public."tblNotificationPreferences" USING btree (notification_type);


--
-- Name: idx_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_preferences_user_id ON public."tblNotificationPreferences" USING btree (user_id);


--
-- Name: idx_notification_preferences_user_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_preferences_user_type ON public."tblNotificationPreferences" USING btree (user_id, notification_type);


--
-- Name: idx_scrap_sales_d_asd_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_d_asd_id ON public."tblScrapSales_D" USING btree (asd_id);


--
-- Name: idx_scrap_sales_d_ssh_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_d_ssh_id ON public."tblScrapSales_D" USING btree (ssh_id);


--
-- Name: idx_scrap_sales_h_buyer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_h_buyer_name ON public."tblScrapSales_H" USING btree (buyer_name);


--
-- Name: idx_scrap_sales_h_created_on; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_h_created_on ON public."tblScrapSales_H" USING btree (created_on);


--
-- Name: idx_scrap_sales_h_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_h_org_id ON public."tblScrapSales_H" USING btree (org_id);


--
-- Name: idx_scrap_sales_h_sale_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_h_sale_date ON public."tblScrapSales_H" USING btree (sale_date);


--
-- Name: idx_scrap_sales_h_ssh_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scrap_sales_h_ssh_id ON public."tblScrapSales_H" USING btree (ssh_id);


--
-- Name: idx_tblPrintSerialNoQueue_serial_no_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_tblPrintSerialNoQueue_serial_no_org_id" ON public."tblPrintSerialNoQueue" USING btree (serial_no, org_id);


--
-- Name: idx_technical_log_config_app_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_technical_log_config_app_id ON public."tblTechnicalLogConfig" USING btree (app_id);


--
-- Name: idx_technical_log_config_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_technical_log_config_enabled ON public."tblTechnicalLogConfig" USING btree (enabled);


--
-- Name: idx_vendors_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_vendor_id ON public."tblVendors" USING btree (vendor_id);


--
-- Name: idx_wfamsh_existing_ams; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wfamsh_existing_ams ON public."tblWFAssetMaintSch_H" USING btree (existing_ams_id) WHERE (existing_ams_id IS NOT NULL);


--
-- Name: tblTechnicalLogConfig trigger_update_technical_log_config_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_technical_log_config_timestamp BEFORE UPDATE ON public."tblTechnicalLogConfig" FOR EACH ROW EXECUTE FUNCTION public.update_technical_log_config_timestamp();


--
-- Name: tblFCMTokens update_fcm_tokens_updated_on; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_fcm_tokens_updated_on BEFORE UPDATE ON public."tblFCMTokens" FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_column();


--
-- Name: tblNotificationPreferences update_notification_preferences_updated_on; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_preferences_updated_on BEFORE UPDATE ON public."tblNotificationPreferences" FOR EACH ROW EXECUTE FUNCTION public.update_updated_on_column();


--
-- Name: tblAssetUsageReg fk_asset; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetUsageReg"
    ADD CONSTRAINT fk_asset FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tblAssetGroup_H fk_assetgroup_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroup_H"
    ADD CONSTRAINT fk_assetgroup_branch FOREIGN KEY (branch_code) REFERENCES public."tblBranches"(branch_code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblAssetMaintSch fk_assetmaintsched_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT fk_assetmaintsched_branch FOREIGN KEY (branch_code) REFERENCES public."tblBranches"(branch_code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblDepartments fk_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDepartments"
    ADD CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES public."tblBranches"(branch_id) ON DELETE CASCADE;


--
-- Name: tblEmployees fk_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblEmployees"
    ADD CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES public."tblBranches"(branch_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblDeptAdmins fk_deptadmins_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT fk_deptadmins_branch FOREIGN KEY (branch_id) REFERENCES public."tblBranches"(branch_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblScrapSales_H fk_scrapsales_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_H"
    ADD CONSTRAINT fk_scrapsales_branch FOREIGN KEY (branch_code) REFERENCES public."tblBranches"(branch_code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblUsers fk_users_employee; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUsers"
    ADD CONSTRAINT fk_users_employee FOREIGN KEY (emp_int_id) REFERENCES public."tblEmployees"(emp_int_id);


--
-- Name: tblVendors fk_vendor_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendors"
    ADD CONSTRAINT fk_vendor_branch FOREIGN KEY (branch_code) REFERENCES public."tblBranches"(branch_code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblWFAssetMaintSch_H fk_wfassetmaintsch_branch; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT fk_wfassetmaintsch_branch FOREIGN KEY (branch_code) REFERENCES public."tblBranches"(branch_code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tblAssetBRDet tblATBRRC_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetBRDet"
    ADD CONSTRAINT "tblATBRRC_FK" FOREIGN KEY (atbrrc_id) REFERENCES public."tblATBRReasonCodes"(atbrrc_id);


--
-- Name: tblAssetMaintSch tblATMainFreq_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblATMainFreq_FK" FOREIGN KEY (at_main_freq_id) REFERENCES public."tblATMaintFreq"(at_main_freq_id) NOT VALID;


--
-- Name: tblWFAssetMaintSch_H tblATMainFreqs; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblATMainFreqs" FOREIGN KEY (at_main_freq_id) REFERENCES public."tblATMaintFreq"(at_main_freq_id) NOT VALID;


--
-- Name: tblATMaintCheckList tblATMaintFreq_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintCheckList"
    ADD CONSTRAINT "tblATMaintFreq_FK" FOREIGN KEY (at_main_freq_id) REFERENCES public."tblATMaintFreq"(at_main_freq_id) NOT VALID;


--
-- Name: tblAuditLogConfig tblApp_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogConfig"
    ADD CONSTRAINT "tblApp_FK" FOREIGN KEY (app_id) REFERENCES public."tblApps"(app_id) ON UPDATE CASCADE;


--
-- Name: tblAuditLogs tblApps_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogs"
    ADD CONSTRAINT "tblApps_FK" FOREIGN KEY (app_id) REFERENCES public."tblApps"(app_id) ON UPDATE CASCADE;


--
-- Name: tblAssetDepHist tblAssetDepreciation_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetDepHist"
    ADD CONSTRAINT "tblAssetDepreciation_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) ON DELETE CASCADE;


--
-- Name: tblProdServs tblAssetType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblProdServs"
    ADD CONSTRAINT "tblAssetType_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblATMaintFreq tblAssetType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintFreq"
    ADD CONSTRAINT "tblAssetType_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblATMaintCheckList tblAssetType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintCheckList"
    ADD CONSTRAINT "tblAssetType_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblAssets tblAssetType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssets"
    ADD CONSTRAINT "tblAssetType_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblATBRReasonCodes tblAssetTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATBRReasonCodes"
    ADD CONSTRAINT "tblAssetTypes_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblATDocs tblAssetTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATDocs"
    ADD CONSTRAINT "tblAssetTypes_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblDeptAssetTypes tblAssetTypes_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAssetTypes"
    ADD CONSTRAINT "tblAssetTypes_FKEY" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblAssetPropValues tblAsset_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropValues"
    ADD CONSTRAINT "tblAsset_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblAssetGroupDocs tblAssetsGroup_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroupDocs"
    ADD CONSTRAINT "tblAssetsGroup_FK" FOREIGN KEY (asset_group_id) REFERENCES public."tblAssetGroup_H"(assetgroup_h_id);


--
-- Name: tblScrapSales_D tblAssetsScrapDet_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_D"
    ADD CONSTRAINT "tblAssetsScrapDet_FKEY" FOREIGN KEY (asd_id) REFERENCES public."tblAssetScrapDet"(asd_id) NOT VALID;


--
-- Name: tblAssetMaintSch tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblWFAssetMaintSch_H tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblAssetScrapDet tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetScrapDet"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblAssetBRDet tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetBRDet"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id);


--
-- Name: tblAssetDocs tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetDocs"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id);


--
-- Name: tblAssetMaintDocs tblAssets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintDocs"
    ADD CONSTRAINT "tblAssets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblAssets tblBranches_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssets"
    ADD CONSTRAINT "tblBranches_FK" FOREIGN KEY (branch_id) REFERENCES public."tblBranches"(branch_id) NOT VALID;


--
-- Name: tblDeptAdmins tblDepartmens_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT "tblDepartmens_FKEY" FOREIGN KEY (dept_id) REFERENCES public."tblDepartments"(dept_id) NOT VALID;


--
-- Name: tblWFJobRole tblDepartments_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblDepartments_FK" FOREIGN KEY (dept_id) REFERENCES public."tblDepartments"(dept_id) NOT VALID;


--
-- Name: tblDeptAssetTypes tblDepartments_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAssetTypes"
    ADD CONSTRAINT "tblDepartments_FKEY" FOREIGN KEY (dept_id) REFERENCES public."tblDepartments"(dept_id) NOT VALID;


--
-- Name: tblEmployees tblDept_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblEmployees"
    ADD CONSTRAINT "tblDept_FK" FOREIGN KEY (dept_id) REFERENCES public."tblDepartments"(dept_id) NOT VALID;


--
-- Name: tblScrapSalesDocs tblDocType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSalesDocs"
    ADD CONSTRAINT "tblDocType_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblAssetDocs tblDocType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetDocs"
    ADD CONSTRAINT "tblDocType_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblVendorDocs tblDocType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorDocs"
    ADD CONSTRAINT "tblDocType_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblAssetGroupDocs tblDocTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroupDocs"
    ADD CONSTRAINT "tblDocTypes_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblAssetMaintDocs tblDocTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintDocs"
    ADD CONSTRAINT "tblDocTypes_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblATDocs tblDocTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATDocs"
    ADD CONSTRAINT "tblDocTypes_FK" FOREIGN KEY (dto_id) REFERENCES public."tblDocTypeObjects"(dto_id) NOT VALID;


--
-- Name: tblAssetScrapDet tblEmployee_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetScrapDet"
    ADD CONSTRAINT "tblEmployee_FK" FOREIGN KEY (scrapped_by) REFERENCES public."tblEmployees"(emp_int_id) NOT VALID;


--
-- Name: tblAssetAssignments tblEmployees_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetAssignments"
    ADD CONSTRAINT "tblEmployees_FK" FOREIGN KEY (employee_int_id) REFERENCES public."tblEmployees"(emp_int_id) NOT VALID;


--
-- Name: tblWFJobRole tblEmployees_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblEmployees_FK" FOREIGN KEY (emp_int_id) REFERENCES public."tblEmployees"(emp_int_id) NOT VALID;


--
-- Name: tblAuditLogs tblEvents; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogs"
    ADD CONSTRAINT "tblEvents" FOREIGN KEY (event_id) REFERENCES public."tblEvents"(event_id) NOT VALID;


--
-- Name: tblAuditLogConfig tblEvents_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogConfig"
    ADD CONSTRAINT "tblEvents_FK" FOREIGN KEY (event_id) REFERENCES public."tblEvents"(event_id) NOT VALID;


--
-- Name: tblFCMTokens tblFCMTokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblFCMTokens"
    ADD CONSTRAINT "tblFCMTokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."tblUsers"(user_id) ON DELETE CASCADE;


--
-- Name: tblJobRoleNav tblJobRoles-FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblJobRoleNav"
    ADD CONSTRAINT "tblJobRoles-FK" FOREIGN KEY (job_role_id) REFERENCES public."tblJobRoles"(job_role_id) NOT VALID;


--
-- Name: tblUserJobRoles tblJobRoles_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUserJobRoles"
    ADD CONSTRAINT "tblJobRoles_FK" FOREIGN KEY (job_role_id) REFERENCES public."tblJobRoles"(job_role_id) NOT VALID;


--
-- Name: tblWFJobRole tblJobRoles_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblJobRoles_FK" FOREIGN KEY (job_role_id) REFERENCES public."tblJobRoles"(job_role_id) NOT VALID;


--
-- Name: tblWFAssetMaintSch_H tblMaintTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblMaintTypes_FK" FOREIGN KEY (maint_type_id) REFERENCES public."tblMaintTypes"(maint_type_id) NOT VALID;


--
-- Name: tblAssetMaintSch tblMaintTypes_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblMaintTypes_FK" FOREIGN KEY (maint_type_id) REFERENCES public."tblMaintTypes"(maint_type_id) NOT VALID;


--
-- Name: tblATMaintFreq tblMainttype_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintFreq"
    ADD CONSTRAINT "tblMainttype_FK" FOREIGN KEY (maint_type_id) REFERENCES public."tblMaintTypes"(maint_type_id) NOT VALID;


--
-- Name: tblNotificationHistory tblNotificationHistory_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationHistory"
    ADD CONSTRAINT "tblNotificationHistory_token_id_fkey" FOREIGN KEY (token_id) REFERENCES public."tblFCMTokens"(token_id) ON DELETE SET NULL;


--
-- Name: tblNotificationHistory tblNotificationHistory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationHistory"
    ADD CONSTRAINT "tblNotificationHistory_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."tblUsers"(user_id) ON DELETE CASCADE;


--
-- Name: tblNotificationPreferences tblNotificationPreferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblNotificationPreferences"
    ADD CONSTRAINT "tblNotificationPreferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."tblUsers"(user_id) ON DELETE CASCADE;


--
-- Name: tblAssetAssignments tblOrg_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetAssignments"
    ADD CONSTRAINT "tblOrg_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblATMaintFreq tblOrg_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintFreq"
    ADD CONSTRAINT "tblOrg_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssets tblOrgs; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssets"
    ADD CONSTRAINT "tblOrgs" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetScrapDet tblOrgs; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetScrapDet"
    ADD CONSTRAINT "tblOrgs" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetBRDet tblOrgsFK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetBRDet"
    ADD CONSTRAINT "tblOrgsFK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id);


--
-- Name: tblProdServs tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblProdServs"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblVendorProdService tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorProdService"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblJobRoleNav tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblJobRoleNav"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblProps tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblProps"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetTypeProps tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypeProps"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetPropListValues tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropListValues"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetPropValues tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropValues"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblVendors tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendors"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblMaintTypes tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblMaintTypes"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblMaintStatus tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblMaintStatus"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblATMaintCheckList tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATMaintCheckList"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblWFAssetMaintSch_H tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblWFAssetMaintHist tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintHist"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetMaintSch tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblWFSteps tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFSteps"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id);


--
-- Name: tblWFJobRole tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblPrintSerialNoQueue tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblPrintSerialNoQueue"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblBranches tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblBranches"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblATBRReasonCodes tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblATBRReasonCodes"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblScrapSalesDocs tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSalesDocs"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAuditLogConfig tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogConfig"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAuditLogs tblOrgs_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAuditLogs"
    ADD CONSTRAINT "tblOrgs_FK" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblAssetTypes tblOrgs_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypes"
    ADD CONSTRAINT "tblOrgs_FKEY" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblDeptAdmins tblOrgs_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT "tblOrgs_FKEY" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblDeptAssetTypes tblOrgs_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAssetTypes"
    ADD CONSTRAINT "tblOrgs_FKEY" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblScrapSales_H tblOrgs_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_H"
    ADD CONSTRAINT "tblOrgs_FKEY" FOREIGN KEY (org_id) REFERENCES public."tblOrgs"(org_id) NOT VALID;


--
-- Name: tblVendorProdService tblProdServer_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorProdService"
    ADD CONSTRAINT "tblProdServer_FK" FOREIGN KEY (prod_serv_id) REFERENCES public."tblProdServs"(prod_serv_id) NOT VALID;


--
-- Name: tblAssetTypeProps tblProps_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypeProps"
    ADD CONSTRAINT "tblProps_FK" FOREIGN KEY (prop_id) REFERENCES public."tblProps"(prop_id) NOT VALID;


--
-- Name: tblAssetPropListValues tblProps_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetPropListValues"
    ADD CONSTRAINT "tblProps_FK" FOREIGN KEY (prop_id) REFERENCES public."tblProps"(prop_id) NOT VALID;


--
-- Name: tblScrapSalesDocs tblScrapSales_H_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSalesDocs"
    ADD CONSTRAINT "tblScrapSales_H_FK" FOREIGN KEY (ssh_id) REFERENCES public."tblScrapSales_H"(ssh_id) NOT VALID;


--
-- Name: tblScrapSales_D tblScrapSales_H_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblScrapSales_D"
    ADD CONSTRAINT "tblScrapSales_H_FKEY" FOREIGN KEY (ssh_id) REFERENCES public."tblScrapSales_H"(ssh_id) NOT VALID;


--
-- Name: tblUserJobRoles tblUsers_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblUserJobRoles"
    ADD CONSTRAINT "tblUsers_FK" FOREIGN KEY (job_role_id) REFERENCES public."tblJobRoles"(job_role_id) NOT VALID;


--
-- Name: tblDeptAdmins tblUsers_FKEY; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblDeptAdmins"
    ADD CONSTRAINT "tblUsers_FKEY" FOREIGN KEY (user_id) REFERENCES public."tblUsers"(user_id) NOT VALID;


--
-- Name: tblVendorDocs tblVendor_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorDocs"
    ADD CONSTRAINT "tblVendor_FK" FOREIGN KEY (vendor_id) REFERENCES public."tblVendors"(vendor_id) NOT VALID;


--
-- Name: tblVendorProdService tblVendors_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblVendorProdService"
    ADD CONSTRAINT "tblVendors_FK" FOREIGN KEY (vendor_id) REFERENCES public."tblVendors"(vendor_id) NOT VALID;


--
-- Name: tblWFAssetMaintSch_H tblVendors_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintSch_H"
    ADD CONSTRAINT "tblVendors_FK" FOREIGN KEY (vendor_id) REFERENCES public."tblVendors"(vendor_id) NOT VALID;


--
-- Name: tblAssetMaintSch tblVendors_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblVendors_FK" FOREIGN KEY (vendor_id) REFERENCES public."tblVendors"(vendor_id) NOT VALID;


--
-- Name: tblAssets tblVendors_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssets"
    ADD CONSTRAINT "tblVendors_FK" FOREIGN KEY (purchase_vendor_id) REFERENCES public."tblVendors"(vendor_id) NOT VALID;


--
-- Name: tblWFAssetMaintHist tblWFAMSD_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintHist"
    ADD CONSTRAINT "tblWFAMSD_FK" FOREIGN KEY (wfamsd_id) REFERENCES public."tblWFAssetMaintSch_D"(wfamsd_id) NOT VALID;


--
-- Name: tblWFAssetMaintHist tblWFAMSH_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFAssetMaintHist"
    ADD CONSTRAINT "tblWFAMSH_FK" FOREIGN KEY (wfamsh_id) REFERENCES public."tblWFAssetMaintSch_H"(wfamsh_id) NOT VALID;


--
-- Name: tblWFJobRole tblWFSteps_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblWFJobRole"
    ADD CONSTRAINT "tblWFSteps_FK" FOREIGN KEY (wf_steps_id) REFERENCES public."tblWFSteps"(wf_steps_id) NOT VALID;


--
-- Name: tblAssetTypeProps tbl_AssetType_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetTypeProps"
    ADD CONSTRAINT "tbl_AssetType_FK" FOREIGN KEY (asset_type_id) REFERENCES public."tblAssetTypes"(asset_type_id) NOT VALID;


--
-- Name: tblAssetAssignments tbl_Assets_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetAssignments"
    ADD CONSTRAINT "tbl_Assets_FK" FOREIGN KEY (asset_id) REFERENCES public."tblAssets"(asset_id) NOT VALID;


--
-- Name: tblAssetAssignments tbl_departments_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetAssignments"
    ADD CONSTRAINT "tbl_departments_FK" FOREIGN KEY (dept_id) REFERENCES public."tblDepartments"(dept_id) NOT VALID;


--
-- Name: tblAssetGroup_D tblassetgroup_d_asset_group_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetGroup_D"
    ADD CONSTRAINT tblassetgroup_d_asset_group_header_id_fkey FOREIGN KEY (assetgroup_h_id) REFERENCES public."tblAssetGroup_H"(assetgroup_h_id);


--
-- Name: tblAssetMaintSch tblwfamsh_FK; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."tblAssetMaintSch"
    ADD CONSTRAINT "tblwfamsh_FK" FOREIGN KEY (wfamsh_id) REFERENCES public."tblWFAssetMaintSch_H"(wfamsh_id) NOT VALID;


--
-- PostgreSQL database dump complete
--

\unrestrict pXPRz1syk4nspBaGOjL0Una7RnNRMUa5okrig1xOdcvkQs3yMTTKSGB3iRWlNb6

