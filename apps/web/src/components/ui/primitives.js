"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";

export function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ label, children, active = false, className = "", ...props }) {
  return (
    <button
      className={`icon-button ${active ? "icon-button--active" : ""} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Chip({ children, selected = false, onClick }) {
  return (
    <button className="chip" aria-pressed={selected} onClick={onClick}>
      {selected ? <Check size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, description, position, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${position ? `modal--${position}` : ""}`}
      aria-labelledby={`${position || "dialog"}-title`}
      aria-describedby={description ? `${position || "dialog"}-description` : undefined}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <div>
            <p className="eyebrow">OpenScroll foundation</p>
            <h2 id={`${position || "dialog"}-title`}>{title}</h2>
            {description ? <p id={`${position || "dialog"}-description`}>{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose} autoFocus>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Dialog(props) {
  return <Modal {...props} />;
}

export function Sheet(props) {
  return <Modal {...props} position="sheet" />;
}

export function Toast({ message }) {
  return (
    <div className={`toast ${message ? "toast--visible" : ""}`} role="status" aria-live="polite">
      <Check size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function Skeleton({ width = "100%" }) {
  return <span className="skeleton" style={{ width }} aria-hidden="true" />;
}

export function StateCard({ icon, title, message, action }) {
  return (
    <section className="state-card">
      <span className="state-card__icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </section>
  );
}
