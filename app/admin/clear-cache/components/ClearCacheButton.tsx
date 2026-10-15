"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { clearProductCache } from "../actions";

type Status = "idle" | "success" | "error";

async function handleClearCache(): Promise<Status> {
  try {
    await clearProductCache();
    return "success";
  } catch {
    return "error";
  }
}

export function ClearCacheButton() {
  const [status, formAction, isPending] = useActionState(handleClearCache, "idle" as Status);

  return (
    <div className="space-y-4">
      <form action={formAction}>
        <Button type="submit" loading={isPending} className="w-full md:w-auto">
          Làm mới bộ nhớ đệm
        </Button>
      </form>

      {status === "success" && <Alert variant="success">Đã làm mới bộ nhớ đệm.</Alert>}

      {status === "error" && (
        <Alert variant="danger">Không làm mới được. Thử lại hoặc báo quản trị.</Alert>
      )}
    </div>
  );
}
