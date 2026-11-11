"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="bootstrap-state" role="alert"><div className="bootstrap-mark bootstrap-mark--error">!</div><h1>This demo view could not be completed</h1><p>No real system was contacted and your current demo context remains local.</p><button className="button button--primary" onClick={reset}>Retry view</button></main>;
}
