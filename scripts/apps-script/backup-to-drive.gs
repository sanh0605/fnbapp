const EXPECTED_TABLES = [
  "brands", "product_categories", "item_categories", "units", "suppliers",
  "purchase_sources", "products", "product_variants", "modifiers", "recipes",
  "promotions", "base_ingredients", "semi_products", "purchased_items",
  "uom_conversions", "product_price_history", "orders_v2", "order_lines_v2",
  "order_events", "stock_ledger", "purchase_orders", "purchase_order_lines",
  "stock_adjustments", "production_orders", "production_items", "pos_drafts", "users",
];
const RETENTION_COUNT = 30;
const BACKUP_PREFIX = "fnbapp-backup-";
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
      throw new Error(`Snapshot endpoint returned ${response.getResponseCode()}: ${response.getContentText()}`);
    }

    const content = response.getContentText();
    const bundle = JSON.parse(content);
    validateBundle_(bundle);
    const fileName = buildFileName_(bundle.capturedAt);
    const folder = DriveApp.getFolderById(folderId);
    const existing = collectFilesByName_(folder, fileName);

    // Create first. Old same-day files are trashed only after the new file exists.
    const created = folder.createFile(Utilities.newBlob(content, "application/json", fileName));
    existing.forEach(file => file.setTrashed(true));
    pruneBackups_(folder, created.getId());
    console.log(JSON.stringify({
      success: true,
      fileName,
      fileId: created.getId(),
      sizeBytes: created.getSize(),
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
  if (!bundle || bundle.schemaVersion !== 1 || !bundle.tables || !bundle.capturedAt) {
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

function buildFileName_(capturedAt) {
  const date = Utilities.formatDate(new Date(capturedAt), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  return `${BACKUP_PREFIX}${date}.json`;
}

function collectFilesByName_(folder, fileName) {
  const files = [];
  const iterator = folder.getFilesByName(fileName);
  while (iterator.hasNext()) files.push(iterator.next());
  return files;
}

function pruneBackups_(folder, currentFileId) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (/^fnbapp-backup-\d{4}-\d{2}-\d{2}\.json$/.test(file.getName())) files.push(file);
  }
  files.sort((left, right) => right.getName().localeCompare(left.getName())
    || right.getDateCreated().getTime() - left.getDateCreated().getTime());
  files.slice(RETENTION_COUNT).forEach(file => {
    if (file.getId() !== currentFileId) file.setTrashed(true);
  });
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
  return value;
}
