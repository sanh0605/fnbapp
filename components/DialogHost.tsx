"use client";

import React, { useSyncExternalStore } from "react";
import { dialogStore, dismiss, type AlertOptions, type ConfirmOptions } from "@/lib/dialog";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

export function DialogHost() {
  const state = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot, dialogStore.getSnapshot);

  if (!state) return null;

  const { type, options } = state;
  const { title, message, variant = type === "confirm" ? "warning" : "info" } = options;

  let okText = "Đã hiểu";
  let cancelText = "Huỷ";
  if ("okText" in options && options.okText) okText = options.okText;
  if ("cancelText" in options && options.cancelText) cancelText = options.cancelText;

  const handleOk = () => {
    dismiss(type === "confirm" ? true : undefined);
  };

  const handleCancel = () => {
    dismiss(type === "confirm" ? false : undefined);
  };

  return (
    <Dialog isOpen={true} onClose={handleCancel} title={title} dismissible={true}>
      <div className="mb-6 mt-2">
        <p>{message}</p>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
        {type === "confirm" && (
          <Button variant="secondary" onClick={handleCancel}>
            {cancelText}
          </Button>
        )}
        <Button variant={variant === "warning" || variant === "danger" ? "danger" : "primary"} onClick={handleOk}>
          {okText}
        </Button>
      </div>
    </Dialog>
  );
}
