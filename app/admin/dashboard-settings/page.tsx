import { findAll } from "@/lib/db/tables";
import { getProductTypes } from "@/app/admin/products/types/actions";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import type { DBProduct } from "@/types/db";
import { getDashboardSettings } from "./actions";
import { DashboardSettingsForm } from "./components/DashboardSettingsForm";

import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const [settings, products, typeRows, auth] = await Promise.all([
    getDashboardSettings(),
    findAll("Products") as Promise<DBProduct[]>,
    getProductTypes(),
    resolveActor(),
  ]);

  const isOwner = Boolean(
    auth.ok && (auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM")
  );

  const types = typeRows.map((r) => r.type);

  if (!settings) {
    return (
      <div className="space-y-6">
        <BackLink href="/admin" label="Tổng quan" />
        <PageHeader
          title="Cài đặt Tổng quan"
          subtitle="Chỉnh các mốc báo động và các cột của bảng 7 ngày."
        />
        <Alert variant="danger">
          Chưa có dòng cài đặt. Báo lại cho người làm phần mềm.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Tổng quan" />
      <PageHeader
        title="Cài đặt Tổng quan"
        subtitle="Chỉnh các mốc báo động và các cột của bảng 7 ngày."
      />
      <DashboardSettingsForm
        settings={settings}
        products={products}
        types={types}
        isOwner={isOwner}
      />
    </div>
  );
}
