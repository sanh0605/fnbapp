const EXPECTED_TABLES = [
  "brands", "product_categories", "item_categories", "units", "suppliers",
  "purchase_sources", "products", "product_variants", "modifiers", "recipes",
  "promotions", "base_ingredients", "semi_products", "purchased_items",
  "uom_conversions", "product_price_history", "orders_v2", "order_lines_v2",
  "order_events", "stock_ledger", "purchase_orders", "purchase_order_lines",
  "stock_adjustments", "production_orders", "production_items", "pos_drafts", "users",
  "sync_state", "data_migration_runs", "data_recovery_changes",
  "audit_baseline_locks", "backdated_ledger_events",
];
const DAILY_RETENTION_COUNT = 180;
const DAILY_PREFIX = "fnbapp-backup-";
const MONTHLY_PREFIX = "fnbapp-monthly-";
const WARNING_BUNDLE_BYTES = 20 * 1024 * 1024;
const MIGRATION_BUNDLE_BYTES = 25 * 1024 * 1024;
const HANDLER_NAME = "runDailyDriveBackup";

function runDailyDriveBackup() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const endpointUrl = requiredProperty_(properties, "BACKUP_ENDPOINT_URL");
    const pullToken = requiredProperty_(properties, "BACKUP_PULL_TOKEN");
    const folderId = requiredProperty_(properties, "GOOGLE_DRIVE_FOLDER_ID");
    const response = UrlFetchApp.fetch(endpointUrl, {
      method: "post",
      headers: { "X-Backup-Token": pullToken },
      contentType: "application/json",
      payload: "{}",
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      if (response.getResponseCode() === 401) {
        throw new Error("Snapshot endpoint returned 401. BACKUP_PULL_TOKEN in Script Properties does not match the Supabase secret.");
      }
      throw new Error(`Snapshot endpoint returned ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    const content = response.getContentText();
    const bundle = JSON.parse(content);
    validateBundle_(bundle);
    const dailyFileName = buildDailyFileName_(bundle.capturedAt);
    const monthlyFileName = buildMonthlyFileName_(bundle.capturedAt);
    const rootFolder = DriveApp.getFolderById(folderId);
    const dailyFolder = getOrCreateFolder_(rootFolder, "daily");
    const monthlyFolder = getOrCreateFolder_(rootFolder, "monthly");
    migrateLegacyRootFiles_(rootFolder, dailyFolder, monthlyFolder);
    const daily = createReplacement_(dailyFolder, content, dailyFileName);
    const monthly = createReplacement_(monthlyFolder, content, monthlyFileName);
    pruneBackups_(dailyFolder, /^fnbapp-backup-\d{4}-\d{2}-\d{2}\.json$/, DAILY_RETENTION_COUNT);
    alertCapacity_(daily.getSize());
    console.log(JSON.stringify({
      success: true,
      dailyFileName,
      dailyFileId: daily.getId(),
      monthlyFileName,
      monthlyFileId: monthly.getId(),
      sizeBytes: daily.getSize(),
      tableCount: EXPECTED_TABLES.length,
    }));
  } catch (error) {
    alertFailure_(error);
    throw error;
  }
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === HANDLER_NAME)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(HANDLER_NAME)
    .timeBased()
    .atHour(2)
    .nearMinute(30)
    .everyDays(1)
    .inTimezone("Asia/Ho_Chi_Minh")
    .create();
}

function validateBundle_(bundle) {
  if (!bundle || bundle.schemaVersion !== 2 || !bundle.tables || !bundle.capturedAt) {
    throw new Error("Snapshot bundle header is invalid");
  }
  const actual = Object.keys(bundle.tables).sort();
  const expected = EXPECTED_TABLES.slice().sort();
  const missing = expected.filter(table => actual.indexOf(table) === -1);
  const unexpected = actual.filter(table => expected.indexOf(table) === -1);
  if (missing.length || unexpected.length) {
    throw new Error(`Snapshot schema mismatch; missing=${missing.join(",")}; unexpected=${unexpected.join(",")}`);
  }
  EXPECTED_TABLES.forEach(table => {
    const entry = bundle.tables[table];
    if (!entry || !Array.isArray(entry.rows) || entry.count !== entry.rows.length) {
      throw new Error(`Snapshot table ${table} has an invalid count`);
    }
  });
}

function buildDailyFileName_(capturedAt) {
  const date = Utilities.formatDate(new Date(capturedAt), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  return `${DAILY_PREFIX}${date}.json`;
}

function buildMonthlyFileName_(capturedAt) {
  const month = Utilities.formatDate(new Date(capturedAt), "Asia/Ho_Chi_Minh", "yyyy-MM");
  return `${MONTHLY_PREFIX}${month}.json`;
}

function collectFilesByName_(folder, fileName) {
  const files = [];
  const iterator = folder.getFilesByName(fileName);
  while (iterator.hasNext()) files.push(iterator.next());
  return files;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function migrateLegacyRootFiles_(rootFolder, dailyFolder, monthlyFolder) {
  const files = rootFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (/^fnbapp-backup-\d{4}-\d{2}-\d{2}\.json$/.test(file.getName())) {
      file.moveTo(dailyFolder);
    } else if (/^fnbapp-monthly-\d{4}-\d{2}\.json$/.test(file.getName())) {
      file.moveTo(monthlyFolder);
    }
  }
}

function createReplacement_(folder, content, fileName) {
  const existing = collectFilesByName_(folder, fileName);
  // Create first. Existing copies are trashed only after the replacement exists.
  const created = folder.createFile(Utilities.newBlob(content, "application/json", fileName));
  existing.forEach(file => file.setTrashed(true));
  return created;
}

function pruneBackups_(folder, pattern, retentionCount) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (pattern.test(file.getName())) files.push(file);
  }
  files.sort((left, right) => right.getName().localeCompare(left.getName())
    || right.getDateCreated().getTime() - left.getDateCreated().getTime());
  files.slice(retentionCount).forEach(file => file.setTrashed(true));
}

function alertCapacity_(sizeBytes) {
  if (sizeBytes < WARNING_BUNDLE_BYTES) return;
  const threshold = sizeBytes >= MIGRATION_BUNDLE_BYTES ? "migration" : "warning";
  const email = Session.getActiveUser().getEmail();
  const message = `Backup bundle ${sizeBytes} bytes reached the ${threshold} threshold. Review R2/B2 migration policy.`;
  console.warn(message);
  if (email) MailApp.sendEmail(email, `[fnbapp] Backup capacity ${threshold}`, message);
}

function alertFailure_(error) {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    console.error(`Backup failed and active-user email is unavailable: ${error}`);
    return;
  }
  MailApp.sendEmail({
    to: email,
    subject: "[fnbapp] Daily Drive backup failed",
    body: `Daily backup failed at ${new Date().toISOString()}\n\n${error && error.stack ? error.stack : error}`,
  });
}

function requiredProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) throw new Error(`Missing Script Property: ${name}`);
  return value.trim();
}
