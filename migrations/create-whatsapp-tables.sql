-- WhatsApp Cloud API tables/columns for tenant databases.
-- Also applied automatically by utils/ensureWhatsAppSchema.js.

ALTER TABLE "tblUsers"
  ADD COLUMN IF NOT EXISTS whatsapp_phone character varying(20),
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_on timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_tblUsers_whatsapp_phone
  ON "tblUsers" (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;

ALTER TABLE "tblNotificationPreferences"
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "tblWhatsAppMessages" (
  message_id character varying(50) PRIMARY KEY,
  user_id character varying(50),
  org_id character varying(10),
  direction character varying(10) NOT NULL,
  phone character varying(20) NOT NULL,
  notification_type character varying(80),
  title character varying(255),
  body text,
  payload jsonb,
  wamid character varying(128),
  template_name character varying(128),
  status character varying(30) NOT NULL DEFAULT 'queued',
  error_message text,
  created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tblWhatsAppEvents" (
  event_id character varying(50) PRIMARY KEY,
  wamid character varying(128) NOT NULL,
  event_type character varying(40) NOT NULL,
  phone character varying(20),
  payload jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (wamid, event_type)
);

CREATE TABLE IF NOT EXISTS "tblWhatsAppApprovals" (
  token character varying(40) PRIMARY KEY,
  user_id character varying(50) NOT NULL,
  org_id character varying(10) NOT NULL,
  kind character varying(30) NOT NULL,
  notification_type character varying(80),
  wfamsh_id character varying(50),
  wfamsd_id character varying(50),
  wfaiish_id character varying(50),
  wfaiisd_id character varying(50),
  asset_id character varying(50),
  asset_name character varying(255),
  status character varying(20) NOT NULL DEFAULT 'pending',
  result_message text,
  expires_on timestamp with time zone NOT NULL,
  created_on timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acted_on timestamp with time zone
);
