"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="bootstrap-state" role="alert">
      <div className="bootstrap-mark bootstrap-mark--error">!</div>
      <h1>This page could not be loaded</h1>
      <p>Your work is saved. Try again, and if it keeps happening, let your administrator know.</p>
      <button className="button button--primary" onClick={reset}>Try again</button>
    </main>
  );
}
