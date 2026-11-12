/** The full-screen moment while VESPER starts: the wordmark, a slow halo and a line of light. */
export function BrandLoader({ label = "Preparing your workspace" }: { label?: string }) {
  return (
    <main className="brand-loader" aria-live="polite" aria-busy="true">
      <div className="brand-loader__halo" aria-hidden="true" />
      <div className="brand-loader__content">
        <span className="brand-loader__mark">VESPER</span>
        <span className="brand-loader__line" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </main>
  );
}
