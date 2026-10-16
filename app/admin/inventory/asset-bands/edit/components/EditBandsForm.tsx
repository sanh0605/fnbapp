"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Alert } from "@/components/ui/Alert";
import { NumberInput } from "@/components/ui/NumberInput";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import { safeReturnTo } from "@/lib/shared/return-to";
import { saveAssetBands } from "../../actions";
import type { DBAssetDepreciationBand } from "@/types/db";

export interface FormBandRow {
  clientId: string;
  id: string | null;
  min_unit_price: number | null;
  term_months: number | null;
}

export interface EditBandsFormProps {
  bands: DBAssetDepreciationBand[];
  returnTo?: string;
  canRemove?: boolean;
}

function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function EditBandsForm({
  bands,
  returnTo: rawReturnTo,
  canRemove = false,
}: EditBandsFormProps) {
  const router = useRouter();
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/asset-bands");

  const [rows, setRows] = useState<FormBandRow[]>(() => {
    const sorted = [...bands].sort((a, b) => a.min_unit_price - b.min_unit_price);
    if (sorted.length === 0) {
      return [
        {
          clientId: "initial-0",
          id: null,
          min_unit_price: 0,
          term_months: null,
        },
      ];
    }
    return sorted.map((b, idx) => ({
      clientId: b.id || `band-${idx}`,
      id: b.id,
      min_unit_price: idx === 0 ? 0 : b.min_unit_price,
      term_months: b.term_months,
    }));
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getNextMinText(index: number): string {
    if (index === rows.length - 1) {
      return "Không giới hạn";
    }
    const next = rows[index + 1];
    if (
      next &&
      next.min_unit_price !== null &&
      next.min_unit_price !== undefined &&
      Number.isFinite(next.min_unit_price)
    ) {
      return `${formatNumber(next.min_unit_price)}đ`;
    }
    return "—";
  }

  function handleAddRow() {
    setRows((prev) => [
      ...prev,
      {
        clientId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        id: null,
        min_unit_price: null,
        term_months: null,
      },
    ]);
  }

  function handleRemoveRow(index: number) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length > 0) {
        next[0] = { ...next[0], min_unit_price: 0 };
      }
      return next;
    });
  }

  function handleMinChange(index: number, val: number | null) {
    if (index === 0) return;
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], min_unit_price: val };
      return next;
    });
  }

  function handleTermChange(index: number, val: number | null) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], term_months: val };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const candidateRows = rows.map((r, idx) => ({
      id: r.id,
      min_unit_price: idx === 0 ? 0 : r.min_unit_price,
      term_months: r.term_months,
    }));

    for (let i = 0; i < candidateRows.length; i++) {
      const r = candidateRows[i];
      if (r.min_unit_price === null || !Number.isFinite(r.min_unit_price)) {
        setLoading(false);
        setError(`Dòng ${i + 1}: Vui lòng nhập "Từ giá"`);
        return;
      }
      if (
        r.term_months === null ||
        !Number.isFinite(r.term_months) ||
        r.term_months <= 0
      ) {
        setLoading(false);
        setError(
          `Dòng ${i + 1}: Vui lòng nhập "Số tháng" hợp lệ (tối thiểu 1 tháng)`
        );
        return;
      }
    }

    const formData = new FormData();
    formData.append(
      "bands",
      JSON.stringify(
        candidateRows.map((r) => ({
          id: r.id,
          min_unit_price: Number(r.min_unit_price),
          term_months: Number(r.term_months),
        }))
      )
    );

    try {
      const res = await saveAssetBands(formData);
      setLoading(false);
      if (res?.error || (res as any)?.ok === false) {
        setError(res.error || "Có lỗi xảy ra khi lưu khung khấu hao");
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } catch (err: unknown) {
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : "Có lỗi xảy ra khi lưu khung khấu hao"
      );
    }
  }

  const showTrash = canRemove && rows.length > 1;

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        {/* Desktop view: Table */}
        <div className="hidden md:block">
          <Table aria-label="Khung khấu hao">
            <TableHead>
              <TableHeaderCell>Từ giá (đ)</TableHeaderCell>
              <TableHeaderCell>Đến dưới</TableHeaderCell>
              <TableHeaderCell>Số tháng</TableHeaderCell>
              {showTrash && (
                <TableHeaderCell>
                  <span className="sr-only">Thao tác</span>
                </TableHeaderCell>
              )}
            </TableHead>
            <TableBody>
              {rows.map((row, index) => {
                const nextMinText = getNextMinText(index);
                return (
                  <TableRow key={row.clientId}>
                    <TableCell>
                      <NumberInput
                        id={`min-desktop-${row.clientId}`}
                        aria-label="Từ giá (đ)"
                        decimals={0}
                        unit="đ"
                        min={0}
                        example="150,000"
                        value={index === 0 ? 0 : row.min_unit_price}
                        onValueChange={(val) => handleMinChange(index, val)}
                        disabled={index === 0}
                      />
                    </TableCell>
                    <TableCell>
                      {nextMinText}
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        id={`term-desktop-${row.clientId}`}
                        aria-label="Số tháng"
                        decimals={0}
                        min={1}
                        example="12"
                        value={row.term_months}
                        onValueChange={(val) => handleTermChange(index, val)}
                      />
                    </TableCell>
                    {showTrash && (
                      <TableCell>
                        <button
                          type="button"
                          title="Xoá"
                          aria-label="Xoá"
                          onClick={() => handleRemoveRow(index)}
                          className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors inline-flex items-center justify-center min-w-[36px] min-h-[36px]"
                        >
                          <TrashIcon />
                          <span className="sr-only">Xoá</span>
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile view: Cards */}
        <div className="block md:hidden space-y-4" data-testid="mobile-bands">
          {rows.map((row, index) => {
            const nextMinText = getNextMinText(index);
            return (
              <div
                key={row.clientId}
                className="p-4 rounded-xl border border-border bg-surface-card space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-secondary uppercase">
                    Khung {index + 1}
                  </span>
                  {showTrash && (
                    <button
                      type="button"
                      title="Xoá"
                      aria-label="Xoá"
                      onClick={() => handleRemoveRow(index)}
                      className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                    >
                      <TrashIcon />
                      <span className="sr-only">Xoá</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor={`min-mobile-${row.clientId}`}
                    className="text-sm text-text-secondary"
                  >
                    Từ giá (đ)
                  </label>
                  <NumberInput
                    id={`min-mobile-${row.clientId}`}
                    aria-label="Từ giá (đ)"
                    decimals={0}
                    unit="đ"
                    min={0}
                    example="150,000"
                    value={index === 0 ? 0 : row.min_unit_price}
                    onValueChange={(val) => handleMinChange(index, val)}
                    disabled={index === 0}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-text-secondary">Đến dưới</div>
                  <div className="text-sm font-medium text-text-primary px-3 py-2 bg-surface-secondary/50 rounded-button">
                    {nextMinText}
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor={`term-mobile-${row.clientId}`}
                    className="text-sm text-text-secondary"
                  >
                    Số tháng
                  </label>
                  <NumberInput
                    id={`term-mobile-${row.clientId}`}
                    aria-label="Số tháng"
                    decimals={0}
                    min={1}
                    example="12"
                    value={row.term_months}
                    onValueChange={(val) => handleTermChange(index, val)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add row button */}
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddRow}
            className="w-full sm:w-auto"
          >
            Thêm khung
          </Button>
        </div>

        {/* Note */}
        <p className="text-[13px] md:text-xs text-text-muted">
          Sửa khung chỉ áp dụng cho tài sản mua sau khi lưu -- tài sản đã có giữ nguyên số tháng đã tính lúc mua.
        </p>

        <FormActionBar
          mode="edit"
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
