"use client";

import React, { useEffect, useId, useRef } from "react";
import { ModalPortal } from "./ModalPortal";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dismissible) {
          e.stopImmediatePropagation();
          onClose();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([aria-hidden="true"]), ' +
        '[href]:not([aria-hidden="true"]), ' +
        'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]), ' +
        'select:not([disabled]):not([aria-hidden="true"]), ' +
        'textarea:not([disabled]):not([aria-hidden="true"]), ' +
        '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        containerRef.current.focus();
      }
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose, dismissible]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-4 pb-6 md:p-4 overscroll-behavior-contain"
        onMouseDown={(e) => {
          mouseDownTarget.current = e.target;
        }}
        onClick={(e) => {
          if (
            dismissible &&
            e.target === e.currentTarget &&
            mouseDownTarget.current === e.currentTarget
          ) {
            onClose();
          }
          mouseDownTarget.current = null;
        }}
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className="bg-surface-card rounded-card border border-border shadow-lg w-full max-w-md max-h-[90vh] flex flex-col outline-none overflow-hidden"
        >
          {title && (
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng"
                  className="text-text-muted hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none rounded p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="p-4 flex-1 overflow-y-auto text-text-primary">
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
