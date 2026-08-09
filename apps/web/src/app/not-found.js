import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-page">
      <p className="eyebrow">Not found</p>
      <h1>This path is not in the collection.</h1>
      <p>Return to the foundation and explore again.</p>
      <Link className="button button--primary" href="/">Return home</Link>
    </main>
  );
}
