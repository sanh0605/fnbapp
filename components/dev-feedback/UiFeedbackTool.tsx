"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildFingerprint, type ElementFingerprint } from "@/lib/dev-feedback/ui-feedback-fingerprint";
import type { FeedbackEntry } from "@/lib/dev-feedback/ui-feedback-store";

// sections 2, 5.
//
// "The comment UI must not touch the page" -- the owner's own condition,
// requirements not suggestions:
//   - Rendered into a dedicated container appended to <body>, via a portal,
//     not nested inside {children}.
//   - No Tailwind classes anywhere in this file -- every style below is
//     inline, so the overlay cannot be affected by (or accidentally affect)
//     the page's own design tokens.
//   - The highlight outline is drawn as a separate element positioned over
//     the hovered target, never by mutating the target's own style.
//   - This overlay div itself is always pointer-events: none, so it can
//     never block the real page -- picking is implemented by a capturing
//     listener on `document` instead of by making the overlay itself
//     clickable and hit-testing through it. Simpler than the elementFromPoint
//     +toggle-pointer-events dance most element pickers use, and gives the
//     exact same guarantee: the page is normally fully interactive, and
//     while picking, the real target's own default action is suppressed
//     rather than the overlay stealing the click.

const CONTAINER_ID = "ui-feedback-tool-root";

function getOrCreateContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    document.body.appendChild(el);
  }
  return el;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 72,
  right: 16,
  width: 320,
  maxHeight: "70vh",
  overflowY: "auto",
  background: "#1f2430",
  color: "#f3f4f6",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  zIndex: 2147483000,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 13,
  lineHeight: 1.5,
};

const buttonStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 2147483000,
  background: "#4f46e5",
  color: "#ffffff",
  border: "none",
  borderRadius: 999,
  padding: "10px 18px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const actionButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "#2d3344",
  color: "#f3f4f6",
  border: "none",
  borderRadius: 8,
  padding: "8px 10px",
  marginBottom: 8,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 70,
  borderRadius: 8,
  border: "1px solid #3f4657",
  background: "#151922",
  color: "#f3f4f6",
  padding: 8,
  fontFamily: "inherit",
  fontSize: 13,
  boxSizing: "border-box",
  marginBottom: 8,
};

export function UiFeedbackTool() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [pendingFingerprint, setPendingFingerprint] = useState<ElementFingerprint | null>(null);
  const [composingGeneral, setComposingGeneral] = useState(false);
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [showEntries, setShowEntries] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setContainer(getOrCreateContainer());
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const composing = pendingFingerprint !== null || composingGeneral;
  const isExpanded = showEntries ?? (entries.length <= 1);

  useEffect(() => {
    if ((!isOpen && !composing) || picking) return;

    function handlePointerDown(e: Event) {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerButtonRef.current?.contains(target)) return;

      setIsOpen(false);
      setComposingGeneral(false);
      setPendingFingerprint(null);
      setEditingId(null);
      setEditingNote("");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, composing, picking]);

  async function loadEntries() {
    try {
      const res = await fetch("/api/dev-feedback");
      if (!res.ok) return;
      const body = await res.json();
      setEntries(body.entries || []);
    } catch {
      // Best-effort -- a dev tool failing to list past comments should
      // never block adding a new one.
    }
  }

  function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      void loadEntries();
    } else {
      setEditingId(null);
      setEditingNote("");
    }
  }

  function startPicking() {
    setIsOpen(false);
    setPicking(true);
    setEditingId(null);
    setEditingNote("");
  }

  useEffect(() => {
    if (!picking) return;

    function handleMouseMove(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || target.closest?.(`#${CONTAINER_ID}`)) return;
      setHoverRect(target.getBoundingClientRect());
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || target.closest?.(`#${CONTAINER_ID}`)) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingFingerprint(buildFingerprint(target));
      setPicking(false);
      setHoverRect(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPicking(false);
        setHoverRect(null);
      }
    }

    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [picking]);

  async function submitNote() {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const fp = pendingFingerprint;
      const res = await fetch("/api/dev-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: trimmed,
          route: fp?.route ?? window.location.pathname,
          viewportWidth: fp?.viewportWidth ?? window.innerWidth,
          selector: fp?.selector ?? null,
          className: fp?.className ?? null,
          textSnippet: fp?.textSnippet ?? null,
          sourceFile: fp?.sourceFile ?? null,
          sourceLine: fp?.sourceLine ?? null,
          sourceColumn: fp?.sourceColumn ?? null,
        }),
      });
      if (res.ok) {
        setNote("");
        setPendingFingerprint(null);
        setComposingGeneral(false);
        setStatusMessage("Đã lưu góp ý.");
        setIsOpen(true);
        await loadEntries();
      } else {
        setStatusMessage("Lưu không thành công.");
      }
    } catch {
      setStatusMessage("Lưu không thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    try {
      await fetch(`/api/dev-feedback?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadEntries();
    } catch {
      setStatusMessage("Xoá không thành công.");
    }
  }

  function startEditing(entry: FeedbackEntry) {
    setEditingId(entry.id);
    setEditingNote(entry.note);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingNote("");
  }

  async function saveEdit(id: string) {
    const trimmed = editingNote.trim();
    if (!trimmed) {
      setStatusMessage("Ghi chú không được để trống.");
      return;
    }
    try {
      const res = await fetch("/api/dev-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, note: trimmed }),
      });
      if (!res.ok) {
        setStatusMessage("Sửa không thành công.");
        return;
      }
      await loadEntries();
      setEditingId(null);
      setEditingNote("");
      setStatusMessage(null);
    } catch {
      setStatusMessage("Sửa không thành công.");
    }
  }

  function cancelComposing() {
    setPendingFingerprint(null);
    setComposingGeneral(false);
    setNote("");
  }

  if (!container) return null;

  return createPortal(
    <div id={CONTAINER_ID} style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      {picking && hoverRect && (
        <div
          style={{
            position: "fixed",
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
            border: "2px solid #4f46e5",
            background: "rgba(79,70,229,0.15)",
            pointerEvents: "none",
            zIndex: 2147483000,
            boxSizing: "border-box",
          }}
        />
      )}

      {picking && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2430",
            color: "#f3f4f6",
            padding: "8px 16px",
            borderRadius: 8,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 13,
            zIndex: 2147483000,
          }}
        >
          Bấm vào phần tử cần góp ý -- Esc để huỷ
        </div>
      )}

      <div style={{ pointerEvents: "auto" }}>
        {!picking && (
          <button ref={triggerButtonRef} type="button" onClick={toggleOpen} style={{ ...buttonStyle, bottom: isMobile ? 76 : 16 }}>
            {isOpen ? "Đóng" : "Góp ý"}
          </button>
        )}

        {isOpen && !composing && (
          <div ref={panelRef} style={{ ...panelStyle, bottom: isMobile ? 132 : 72 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Góp ý giao diện</div>
            <button type="button" style={actionButtonStyle} onClick={startPicking}>
              Chọn phần tử để góp ý
            </button>
            <button
              type="button"
              style={actionButtonStyle}
              onClick={() => {
                setComposingGeneral(true);
                setEditingId(null);
                setEditingNote("");
              }}
            >
              Góp ý chung (không chọn phần tử)
            </button>

            {statusMessage && <div style={{ color: "#a5b4fc", marginBottom: 8 }}>{statusMessage}</div>}

            <div style={{ borderTop: "1px solid #3f4657", marginTop: 8, paddingTop: 8 }}>
              {entries.length === 0 ? (
                <div style={{ color: "#9ca3af" }}>Chưa có góp ý nào.</div>
              ) : (
                <>
                  <button
                    type="button"
                    style={actionButtonStyle}
                    onClick={() => setShowEntries(!isExpanded)}
                  >
                    Góp ý đã gửi ({entries.length})
                  </button>
                  {isExpanded &&
                    entries.map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          background: "#2d3344",
                          borderRadius: 8,
                          padding: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 4 }}>
                          {entry.route} · {entry.viewportWidth}px
                        </div>
                        {editingId === entry.id ? (
                          <div>
                            <textarea
                              style={textareaStyle}
                              value={editingNote}
                              onChange={e => setEditingNote(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => void saveEdit(entry.id)}
                                style={{
                                  ...actionButtonStyle,
                                  marginBottom: 0,
                                  background: "#4f46e5",
                                  textAlign: "center",
                                }}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                style={{
                                  ...actionButtonStyle,
                                  marginBottom: 0,
                                  width: "auto",
                                  flex: "0 0 auto",
                                  background: "#3f4657",
                                  textAlign: "center",
                                }}
                              >
                                Bỏ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}>{entry.note}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => startEditing(entry)}
                                style={{
                                  background: "transparent",
                                  color: "#93c5fd",
                                  border: "none",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteEntry(entry.id)}
                                style={{
                                  background: "transparent",
                                  color: "#f87171",
                                  border: "none",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                Xoá
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>
        )}

        {composing && (
          <div ref={panelRef} style={{ ...panelStyle, bottom: isMobile ? 132 : 72 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              {pendingFingerprint ? "Ghi chú cho phần tử đã chọn" : "Góp ý chung"}
            </div>
            {pendingFingerprint && (
              <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>
                {pendingFingerprint.textSnippet || pendingFingerprint.selector}
              </div>
            )}
            <textarea
              style={textareaStyle}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Điều gì chưa đúng ở đây?"
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={saving || !note.trim()}
                style={{ ...actionButtonStyle, marginBottom: 0, background: "#4f46e5", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
              <button
                type="button"
                onClick={cancelComposing}
                style={{ ...actionButtonStyle, marginBottom: 0, width: "auto", flex: "0 0 auto" }}
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    container,
  );
}
