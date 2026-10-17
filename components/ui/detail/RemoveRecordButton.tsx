"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { confirm } from "@/lib/shared/dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

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
}: RemoveRecordButtonProps) {
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
      <Button
        type="button"
        variant="delete"
        title={`${verb} ${name}`}
        loading={isPending}
        onClick={handleClick}
      >
        {verb}
      </Button>
      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}
    </div>
  );
}
