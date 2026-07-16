"use client";

import React, { useSyncExternalStore } from "react";
import { dialogStore, dismiss, type AlertOptions, type ConfirmOptions } from "@/lib/dialog";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

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

  // Determine icon, background, and text colors based on variant
  let IconComponent = CheckCircle2;
  let iconBgClass = "bg-success/10";
  let iconColorClass = "text-success";

  if (variant === "warning") {
    IconComponent = AlertTriangle;
    iconBgClass = "bg-warning/10";
    iconColorClass = "text-warning";
  } else if (variant === "danger") {
    IconComponent = XCircle;
    iconBgClass = "bg-danger/10";
    iconColorClass = "text-danger";
  }

  return (
    <Dialog isOpen={true} onClose={handleCancel} title={title} dismissible={true}>
      <div className="text-center py-2">
        <div className={`flex items-center justify-center w-12 h-12 mx-auto ${iconBgClass} rounded-full mb-4`}>
          <IconComponent className={`w-6 h-6 ${iconColorClass}`} aria-hidden="true" />
        </div>
        <p className="text-text-primary text-sm whitespace-pre-wrap">{message}</p>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
        {type === "confirm" && (
          <Button variant="secondary" onClick={handleCancel}>
            {cancelText}
          </Button>
        )}
        <Button variant={variant === "warning" ? "warning" : variant === "danger" ? "danger" : "primary"} onClick={handleOk}>
          {okText}
        </Button>
      </div>
    </Dialog>
  );
}
