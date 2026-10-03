"use server";

import { findAll, findAllWhere, findAllWhereInBatches, insert, generateNewId } from "@/lib/db/tables";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/db/shared-actions";
import { describeActionError } from "@/lib/shared/action-error";
import { requireAdmin } from "@/lib/auth/auth";
import {
  buildAssetSchedule,
  chargeForMonth,
  summarizeAsset,
  validateDisposalDate,
  type AssetSummary,
  type DisposalInput,
} from "@/lib/assets/asset-depreciation";
import {
  buildAssetItemDetail,
  groupAssetItems,
  type AssetItemDetail,
  type AssetItemRow,
  type AssetLotInput,
  type DisposalRowInput,
} from "@/lib/assets/asset-items";
import type { DBAsset, DBAssetDisposal, DBPurchaseOrderLine, DBPurchasedItem } from "@/types/db";

const ASSETS_SHEET = "assets";
const DISPOSALS_SHEET = "asset_disposals";
const PATH = "/admin/inventory/assets";

export type AssetView = AssetSummary;

// 7-hour Saigon offset, matching lib/shared/report-time.ts's SAIGON_OFFSET_MS --
// month-granularity only, no time-of-day precision needed here.
function currentSaigonMonth(): string {
  const saigonNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return saigonNow.toISOString().slice(0, 7);
}

// section
// 3.3: same Saigon-offset computation as currentSaigonMonth above, day
// granularity instead of month -- the server's own "today", never the
// client's clock, for validateDisposalDate's upper bound.
function currentSaigonDate(): string {
  const saigonNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return saigonNow.toISOString().slice(0, 10);
}

function toDisposalInputs(disposals: DBAssetDisposal[]): DisposalInput[] {
  return disposals.map(d => ({ quantity: Number(d.quantity), disposed_date: d.disposed_date }));
}

function summarizeDbAsset(asset: DBAsset, disposals: DBAssetDisposal[], asOfMonth: string): AssetView {
  return summarizeAsset(
    {
      id: asset.id,
      name: asset.name_snapshot,
      acquired_date: asset.acquired_date,
      unit_cost: Number(asset.unit_cost),
      total_cost: Number(asset.total_cost),
      quantity: Number(asset.quantity),
      term_months: Number(asset.term_months),
    },
    toDisposalInputs(disposals),
    asOfMonth,
  );
}

export async function getAssetsData(): Promise<AssetView[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [assets, disposals] = await Promise.all([
      findAll(ASSETS_SHEET) as Promise<DBAsset[]>,
      findAll(DISPOSALS_SHEET) as Promise<DBAssetDisposal[]>,
    ]);
    // assets.status is the ordinary ACTIVE/INACTIVE administrative flag
    // (CLAUDE.md "Luật dữ liệu" -- mark inactive, never delete), for correcting
    // a genuine data-entry mistake; it is not how "còn dùng / đã hết khấu
    // hao / đã thanh lý" is decided -- summarizeAsset derives that.
    const activeAssets = assets.filter(a => a.status !== "INACTIVE");
    const disposalsByAsset = new Map<string, DBAssetDisposal[]>();
    for (const d of disposals) {
      const list = disposalsByAsset.get(d.asset_id) ?? [];
      list.push(d);
      disposalsByAsset.set(d.asset_id, list);
    }

    const thisMonth = currentSaigonMonth();

    return activeAssets
      .map(asset =>
        summarizeDbAsset(asset, disposalsByAsset.get(asset.id) ?? [], thisMonth),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } catch (error) {
    // rethrow instead of a fabricated empty list -- app/error.tsx handles it.
    console.error("Loi getAssetsData:", error);
    throw error;
  }
}

function toLotInput(asset: DBAsset, purchaseOrderId: string | null): AssetLotInput {
  return {
    id: asset.id,
    purchased_item_id: asset.purchased_item_id,
    purchase_order_id: purchaseOrderId,
    name_snapshot: asset.name_snapshot,
    acquired_date: asset.acquired_date,
    unit_cost: Number(asset.unit_cost),
    total_cost: Number(asset.total_cost),
    quantity: Number(asset.quantity),
    term_months: Number(asset.term_months),
  };
}

function toDisposalRows(disposals: DBAssetDisposal[]): DisposalRowInput[] {
  return disposals.map(d => ({
    id: d.id,
    asset_id: d.asset_id,
    quantity: Number(d.quantity),
    disposed_date: d.disposed_date,
    reason: d.reason ?? null,
  }));
}

// Read-only: one row per purchased item (lots of the same item folded
// together), ACTIVE lots only. Items that are fully disposed are still returned
// with fullyDisposed = true; the page decides whether to show them.
export async function getAssetItemsData(): Promise<AssetItemRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const [assets, disposals] = await Promise.all([
      findAll(ASSETS_SHEET) as Promise<DBAsset[]>,
      findAll(DISPOSALS_SHEET) as Promise<DBAssetDisposal[]>,
    ]);
    const lots = assets.filter(a => a.status !== "INACTIVE");
    const itemIds = [...new Set(lots.map(a => a.purchased_item_id))];
    const items = await findAllWhereInBatches<DBPurchasedItem>("purchased_items", "id", itemIds);
    const names = new Map(items.map(i => [i.id, i.name]));
    return groupAssetItems(
      lots.map(a => toLotInput(a, null)),
      toDisposalRows(disposals),
      names,
      currentSaigonMonth(),
    );
  } catch (error) {
    console.error("Loi getAssetItemsData:", error);
    throw error;
  }
}

// Read-only: one purchased item's lots, disposals (with the amount each one
// charged into its month) and monthly depreciation. null = no ACTIVE lot.
export async function getAssetItemDetail(itemId: string): Promise<AssetItemDetail | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const assets = (await findAllWhere<DBAsset>(ASSETS_SHEET, { eq: { purchased_item_id: itemId } }))
      .filter(a => a.status !== "INACTIVE");
    if (assets.length === 0) return null;

    const lineIds = assets.map(a => a.purchase_order_line_id).filter((id): id is string => !!id);
    const [disposals, lines, items] = await Promise.all([
      findAllWhereInBatches<DBAssetDisposal>(DISPOSALS_SHEET, "asset_id", assets.map(a => a.id)),
      findAllWhereInBatches<DBPurchaseOrderLine>("purchase_order_lines", "id", lineIds),
      findAllWhere<DBPurchasedItem>("purchased_items", { eq: { id: itemId } }),
    ]);
    const orderByLine = new Map(lines.map(l => [l.id, l.purchase_order_id]));
    return buildAssetItemDetail(
      itemId,
      assets.map(a => toLotInput(a, a.purchase_order_line_id ? orderByLine.get(a.purchase_order_line_id) ?? null : null)),
      toDisposalRows(disposals),
      items[0]?.name,
      currentSaigonMonth(),
    );
  } catch (error) {
    console.error("Loi getAssetItemDetail:", error);
    throw error;
  }
}

// Maps an old lot code (TS-...) to its purchased item so old links can
// redirect. null = unknown or administratively INACTIVE.
export async function findItemIdForAsset(assetId: string): Promise<string | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  try {
    const rows = await findAllWhere<DBAsset>(ASSETS_SHEET, { eq: { id: assetId } });
    const row = rows[0];
    if (!row || row.status === "INACTIVE") return null;
    return row.purchased_item_id;
  } catch (error) {
    console.error("Loi findItemIdForAsset:", error);
    throw error;
  }
}

// Section 5.2: "Show the amount that will be charged this month before
// confirming." Builds the schedule WITH the hypothetical disposal already
// appended and reads off that disposal's own month -- the exact number
// disposeAsset below will actually charge if confirmed.
export async function previewDisposalCharge(
  assetId: string,
  quantity: number,
  disposedDate: string,
): Promise<{ charge: number } | { error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  try {
    const [assets, disposals] = await Promise.all([
      findAll(ASSETS_SHEET) as Promise<DBAsset[]>,
      findAll(DISPOSALS_SHEET) as Promise<DBAssetDisposal[]>,
    ]);
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return { error: "Không tìm thấy tài sản" };

    const existingDisposals = disposals.filter(d => d.asset_id === assetId);
    const disposedQuantity = existingDisposals.reduce((sum, d) => sum + Number(d.quantity), 0);
    const remaining = Number(asset.quantity) - disposedQuantity;
    if (quantity <= 0 || quantity > remaining) {
      return { error: `Số lượng không hợp lệ -- còn lại ${remaining}` };
    }

    const dateCheck = validateDisposalDate(disposedDate, asset.acquired_date, currentSaigonDate());
    if (!dateCheck.ok) return { error: dateCheck.error };

    const schedule = buildAssetSchedule(
      {
        acquired_date: asset.acquired_date,
        total_cost: Number(asset.total_cost),
        quantity: Number(asset.quantity),
        term_months: Number(asset.term_months),
      },
      [...toDisposalInputs(existingDisposals), { quantity, disposed_date: disposedDate }],
    );
    const month = disposedDate.slice(0, 7);
    return { charge: chargeForMonth(schedule, month) };
  } catch (error: unknown) {
    // This function's return type is narrower than ActionResponse (no
    // errorDetail) -- same generic-vs-verbatim decision, just the { error }
    // half of it.
    return { error: describeActionError(error).error! };
  }
}

// Section 3.3: inserts a row, never updates assets.quantity downward and
// never deletes -- remaining quantity is derived (assets.quantity minus
// the sum of disposals), so a mistaken entry is reversible by a
// compensating row rather than by editing the past.
export async function disposeAsset(formData: FormData): Promise<ActionResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const asset_id = formData.get("asset_id") as string;
  const quantity = Number(formData.get("quantity"));
  const disposed_date = formData.get("disposed_date") as string;
  const reason = (formData.get("reason") as string) || "";

  if (!asset_id) return fail("Thiếu tài sản");
  if (!Number.isFinite(quantity) || quantity <= 0) return fail("Số lượng không hợp lệ");
  if (!disposed_date) return fail("Vui lòng chọn ngày");

  try {
    const [assets, disposals] = await Promise.all([
      findAll(ASSETS_SHEET) as Promise<DBAsset[]>,
      findAll(DISPOSALS_SHEET) as Promise<DBAssetDisposal[]>,
    ]);
    const asset = assets.find(a => a.id === asset_id);
    if (!asset) return fail("Không tìm thấy tài sản");

    const existingDisposals = disposals.filter(d => d.asset_id === asset_id);
    const disposedQuantity = existingDisposals.reduce((sum, d) => sum + Number(d.quantity), 0);
    const remaining = Number(asset.quantity) - disposedQuantity;
    if (quantity > remaining) {
      return fail(`Số lượng thanh lý (${quantity}) vượt quá số lượng còn lại (${remaining})`);
    }

    // section 3.3: server-side, day-granular, before buildAssetSchedule's
    // own opaque month-level guard can fire -- see validateDisposalDate's
    // own comment for why a second check is needed here at all.
    const dateCheck = validateDisposalDate(disposed_date, asset.acquired_date, currentSaigonDate());
    if (!dateCheck.ok) return fail(dateCheck.error);

    // Validate the schedule can be built with this disposal added -- the
    // same guard buildAssetSchedule already enforces (date order, no
    // over-disposal), run here before writing so a bad row is refused
    // rather than silently accepted.
    buildAssetSchedule(
      {
        acquired_date: asset.acquired_date,
        total_cost: Number(asset.total_cost),
        quantity: Number(asset.quantity),
        term_months: Number(asset.term_months),
      },
      [...toDisposalInputs(existingDisposals), { quantity, disposed_date }],
    );

    const id = await generateNewId(DISPOSALS_SHEET, "TL");
    await insert(DISPOSALS_SHEET, {
      id,
      asset_id,
      quantity,
      disposed_date,
      reason,
      created_by_id: auth.actor.id,
      created_by_name: auth.actor.name,
    });
    revalidatePath(PATH);
    return ok();
  } catch (error: unknown) {
    return describeActionError(error);
  }
}
