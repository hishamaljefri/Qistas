"use client";
import { useEffect, useRef } from "react";
import { Button } from "./Button";

/** Modal confirmation on native <dialog>: focus starts on Cancel, Esc closes, focus returns to the trigger. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d || !open) return;
    const trigger = document.activeElement as HTMLElement | null;
    d.showModal();
    cancel.current?.focus();
    return () => {
      d.close();
      trigger?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[420px] rounded-card border-0 bg-surface p-[26px] text-text shadow-dialog"
    >
      <h2 id="confirm-title" className="text-xl font-semibold">
        {title}
      </h2>
      <p id="confirm-body" className="mt-3.5 text-[15px] leading-[1.8] text-muted">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <Button ref={cancel} variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="danger-solid" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
