import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bootstrap-state">
      <div className="bootstrap-mark bootstrap-mark--error">?</div>
      <h1>We could not find that page</h1>
      <p>The link may be out of date, or the record may have been removed.</p>
      <Link className="button button--primary" href="/overview">Back to Overview</Link>
    </main>
  );
}
