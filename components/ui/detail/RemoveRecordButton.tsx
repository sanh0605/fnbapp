"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirm } from "@/lib/shared/dialog";

export interface RemoveRecordButtonProps {
  verb: string;
  name: string;
  confirmMessage: string;
  remove: () => Promise<{ error?: string }>;
  afterHref: string;
}

export function RemoveRecordButton({
  verb,
  name,
  confirmMessage,
  remove,
  afterHref,
}: RemoveRecordButtonProps): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setError(null);
    const ok = await confirm({
      title: verb,
      message: confirmMessage,
      variant: "danger",
    });
    if (!ok) return;

    setIsPending(true);
    try {
      const res = await remove();
      if (res?.error) {
        setError(res.error);
      } else {
        router.push(afterHref);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        title={`${verb} ${name}`}
        disabled={isPending}
        onClick={handleClick}
        className="px-4 py-2 text-sm font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
      >
        {isPending ? "Đang xử lý..." : verb}
      </button>
      {error && (
        <div
          role="alert"
          className="text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg p-3"
        >
          {error}
        </div>
      )}
    </div>
  );
}
