"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function IconButton({ label, children, expanded = false, className = "", ...props }) {
  return <button className={`icon-control ${expanded ? "icon-control--labeled" : ""} ${className}`} aria-label={label} title={expanded ? undefined : label} {...props}>{children}{expanded ? <span>{label}</span> : null}</button>;
}
export function Chip({ selected, children, ...props }) { return <button className="chip" aria-pressed={selected} {...props}>{children}</button>; }
export function Skeleton({ label = "Loading" }) { return <div className="skeleton-stack" aria-busy="true"><span className="skeleton"/><span className="skeleton skeleton--short"/><span className="sr-only">{label}</span></div>; }
export function Toast({ message }) { return <div className={`toast ${message ? "toast--visible" : ""}`} role="status" aria-live="polite">{message}</div>; }
export function Sheet({ open, title, onClose, children }) {
  const dialog = useRef(null); const titleId = useId();
  useEffect(() => { const node = dialog.current; if (!node) return; if (open && !node.open) node.showModal(); if (!open && node.open) node.close(); }, [open]);
  return <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}><div className="sheet__surface"><header><h2 id={titleId}>{title}</h2><IconButton label="Close" onClick={onClose}><X aria-hidden="true"/></IconButton></header>{children}</div></dialog>;
}
