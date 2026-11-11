import Link from "next/link";

export default function NotFound() {
  return <main className="bootstrap-state"><div className="bootstrap-mark bootstrap-mark--error">?</div><h1>Fictional record not found</h1><p>The route or record is unavailable in this demonstration context.</p><Link href="/overview" className="button button--primary">Return to Overview</Link></main>;
}
