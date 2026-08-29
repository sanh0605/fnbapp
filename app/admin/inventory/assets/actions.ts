"use server";

import { findAll, insert, generateNewId } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResponse } from "@/lib/shared-actions";
import { describeActionError } from "@/lib/action-error";
import { requireAdmin } from "@/lib/auth";
import {
  buildAssetSchedule,
  chargeForMonth,
  summarizeAsset,
  type AssetSummary,
  type DisposalInput,
} from "@/lib/asset-depreciation";
import type { DBAsset, DBAssetDisposal } from "@/types/db";

const ASSETS_SHEET = "assets";
const DISPOSALS_SHEET = "asset_disposals";
const PATH = "/admin/inventory/assets";

export type AssetView = AssetSummary;

// 7-hour Saigon offset, matching lib/report-time.ts's SAIGON_OFFSET_MS --
// month-granularity only, no time-of-day precision needed here.
function currentSaigonMonth(): string {
  const saigonNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return saigonNow.toISOString().slice(0, 7);
}

function toDisposalInputs(disposals: DBAssetDisposal[]): DisposalInput[] {
  return disposals.map(d => ({ quantity: Number(d.quantity), disposed_date: d.disposed_date }));
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
    // (CLAUDE.md section 2 -- mark inactive, never delete), for correcting
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
        summarizeAsset(
          {
            id: asset.id,
            name: asset.name_snapshot,
            acquired_date: asset.acquired_date,
            unit_cost: Number(asset.unit_cost),
            total_cost: Number(asset.total_cost),
            quantity: Number(asset.quantity),
            term_months: Number(asset.term_months),
          },
          toDisposalInputs(disposalsByAsset.get(asset.id) ?? []),
          thisMonth,
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } catch (error) {
    // docs/superpowers/plans/2026-08-27-stop-reporting-failures-as-empty.md:
    // rethrow instead of a fabricated empty list -- app/error.tsx handles it.
    console.error("Loi getAssetsData:", error);
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
