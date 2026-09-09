import { resolveActor } from "@/lib/auth/auth";
import { getFinancePageData } from "./actions";
import { CashEntriesList } from "./components/CashEntriesList";
import { CashEntryForm } from "./components/CashEntryForm";
import { FinanceFilterBar } from "./components/FinanceFilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { DATE_RANGE_PRESETS, resolvePreset, type DateRangePresetKey } from "@/lib/shared/date-range-presets";
import { toSaigonIsoString } from "@/lib/shared/datetime";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePresetParam(value: string | undefined): DateRangePresetKey {
  const found = DATE_RANGE_PRESETS.find((p) => p.key === value);
  return found ? found.key : "THIS_MONTH";
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const today = toSaigonIsoString(new Date()).slice(0, 10);

  let preset = parsePresetParam(readParam(searchParams?.preset));
  const startParam = readParam(searchParams?.start);
  const endParam = readParam(searchParams?.end);

  let start: string;
  let end: string;
  if (preset === "CUSTOM" && startParam && endParam) {
    start = startParam;
    end = endParam;
  } else {
    // No usable custom range in the URL -- fall back to the default preset
    // rather than querying with an empty "" start/end.
    if (preset === "CUSTOM") preset = "THIS_MONTH";
    const resolved = resolvePreset(preset, today);
    start = resolved.start;
    end = resolved.end;
  }

  const [{ entries, categories, accounts }, auth] = await Promise.all([
    getFinancePageData(start, end),
    resolveActor(),
  ]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sổ thu chi"
        subtitle="Ghi khoản chi, khoản thu khác và vốn góp. Không phải sổ kế toán, không có bút toán kép."
        actions={<CashEntryForm categories={categories} accounts={accounts} />}
      />
      <FinanceFilterBar value={{ preset, start, end }} today={today} />
      <CashEntriesList entries={entries} categories={categories} accounts={accounts} canDelete={canDelete} />
    </div>
  );
}
