"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Shared modal built on the native <dialog> element: showModal() gives us
 * role="dialog", aria-modal, a focus trap, Escape-to-close, and focus
 * restoration to the trigger for free -- no hand-rolled a11y plumbing.
 */
export function Modal({
  open,
  onClose,
  title,
  maxWidth = "600px",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="app-modal"
      aria-labelledby={titleId}
      style={{ maxWidth: `min(${maxWidth}, calc(100% - 2rem))` }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="app-modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="button button-quiet" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
