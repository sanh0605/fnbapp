import React from "react";

export interface PhoneRowData {
  title: React.ReactNode;
  value?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
}

function renderMeta(meta: React.ReactNode): React.ReactNode {
  if (typeof meta !== "string") return meta;
  // Split with one capture group puts every code at an odd index; a code must never break at its hyphen.
  return meta.split(/([A-Z]{1,5}-\d+)/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function PhoneRow({ title, value, meta, badge }: PhoneRowData) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-base text-text-primary line-clamp-2 break-words">{title}</div>
        {value != null && <div className="shrink-0 text-base text-text-primary tabular-nums whitespace-nowrap">{value}</div>}
      </div>
      {(meta != null || badge != null) && (
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <div className="min-w-0 line-clamp-2 break-words text-sm text-text-secondary">{renderMeta(meta)}</div>
          {badge != null && <div className="shrink-0 flex items-center gap-1">{badge}</div>}
        </div>
      )}
    </div>
  );
}
