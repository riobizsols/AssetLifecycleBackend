/**
 * Manually trigger asset expiry notifications (for testing).
 *
 * Usage:
 *   node scripts/trigger-asset-expiry-notifications.js
 *   node scripts/trigger-asset-expiry-notifications.js --days=30
 *   node scripts/trigger-asset-expiry-notifications.js --asset-id=ASS141 --org-id=ORG001
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const {
  ensureAssetExpiryNotificationsForWindowAllOrgs,
  createAssetExpiryNotificationsForAsset,
} = require("../models/assetWarrantyNotifyModel");

const parseArgs = () => {
  const args = { days: 5, assetId: null, orgId: null };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--days=")) args.days = Number(arg.split("=")[1]);
    if (arg.startsWith("--asset-id=")) args.assetId = arg.split("=")[1];
    if (arg.startsWith("--org-id=")) args.orgId = arg.split("=")[1];
  }
  return args;
};

async function main() {
  const { days, assetId, orgId } = parseArgs();

  console.log("Triggering asset expiry notifications...");
  console.log(`Window: next ${days} day(s)`);

  if (assetId && orgId) {
    const result = await createAssetExpiryNotificationsForAsset({
      assetId,
      orgId,
    });
    console.log("Single asset result:", result);
    console.log(
      result.created > 0
        ? "Notification created. Refresh All Notifications and enable Asset Expiry filter."
        : "No notification created (check expiry_date, notif_warranty on job role, or duplicate open alert)."
    );
    return;
  }

  const result = await ensureAssetExpiryNotificationsForWindowAllOrgs({ days });
  console.log(JSON.stringify(result, null, 2));

  if (result.created === 0) {
    console.log("\nNo notifications created. To test:");
    console.log("1. In Assets, edit an asset and set Expiry Date within", days, "days from today.");
    console.log("2. In Job Roles, enable 'Warranty Notification' (notif_warranty) for your role.");
    console.log("3. Re-run: node scripts/trigger-asset-expiry-notifications.js");
    console.log("   Or for one asset: node scripts/trigger-asset-expiry-notifications.js --asset-id=YOUR_ASSET --org-id=YOUR_ORG");
  } else {
    console.log("\nDone. Log out/in or refresh All Notifications page.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
