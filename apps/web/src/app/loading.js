export default function Loading() {
  return (
    <main className="system-page" aria-busy="true" aria-label="Loading OpenScroll">
      <p className="eyebrow">Opening the collection</p>
      <span className="skeleton" style={{ width: "min(540px, 80vw)", height: 42 }} aria-hidden="true" />
      <span className="skeleton" style={{ width: "min(380px, 62vw)" }} aria-hidden="true" />
    </main>
  );
}
