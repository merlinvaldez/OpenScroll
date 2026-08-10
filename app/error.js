"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
export default function ErrorPage({ reset }) {
  return <main className="system-state" role="alert"><AlertTriangle aria-hidden="true"/><h1>Something went wrong</h1><button className="icon-control icon-control--labeled" onClick={reset}><RotateCcw aria-hidden="true"/><span>Try again</span></button></main>;
}
