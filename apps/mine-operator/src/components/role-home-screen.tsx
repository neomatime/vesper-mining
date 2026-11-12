import { ArrowRight, Clock3, Target, UsersRound } from "lucide-react";
import Link from "next/link";
import { formatDay } from "@/lib/shift-format";
import type { HomeModel } from "@/lib/role-home";
import { StatusBadge } from "./status-badge";

/**
 * A home for one role: the one thing that needs them first, the next two, a row of figures that matter to that
 * role, and two lists they work from. The content comes from a model built in `lib/role-home`, so this stays plain layout.
 */
export function RoleHomeScreen({ model, persona, siteName, now, shiftLabel }: { model: HomeModel; persona: string; siteName: string; now: string; shiftLabel?: string }) {
  const { lead, nextUp, figures, panels } = model;
  return (
    <div className="dashboard-page">
      <section className="dashboard-greeting">
        <div>
          <span className="eyebrow">{model.eyebrow}</span>
          <h1>Good morning, {persona.split(" ")[0]}</h1>
          <p>{model.subtitle(siteName)}</p>
        </div>
        <div className="context-pills">
          <span><Clock3 /> {formatDay(now)}</span>
          {shiftLabel ? <span><UsersRound /> {shiftLabel}</span> : null}
          <span className="context-pills__freshness"><span /> Updated 4 min ago</span>
        </div>
      </section>

      <section className="needs-now" aria-labelledby="needs-now-title">
        <header className="section-heading">
          <h2 id="needs-now-title">Needs you now</h2>
          <p>{nextUp.length === 0 ? "One thing, and nothing waiting behind it" : `${nextUp.length + 1} things, most urgent first`}</p>
        </header>

        <div className="needs-now__main needs-now__main--wide">
          <article className="hero-card">
            <div className="hero-card__art" aria-hidden="true" />
            <div className="hero-card__content">
              <div className="hero-card__eyebrow"><Target /> {lead.eyebrow} <span>{lead.chip}</span></div>
              <h2>{lead.title}</h2>
              <p>{lead.description}</p>
              <div className="hero-card__footer">
                {lead.facts.length > 0 ? (
                  <div className="hero-card__facts">
                    {lead.facts.map((fact) => <span key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></span>)}
                  </div>
                ) : <span />}
                <Link href={lead.action.href} className="button button--light">{lead.action.label} <ArrowRight /></Link>
              </div>
              <small className="hero-card__note">{lead.note}</small>
            </div>
          </article>

          {nextUp.length > 0 ? (
            <div className="attention-grid" aria-label="Also needs you">
              {nextUp.map((item) => (
                <article className="card attention-card" key={item.id}>
                  <div className="attention-card__main">
                    <StatusBadge value={item.status} label={item.statusLabel} />
                    <h3>{item.title}</h3>
                    <p>{item.reason}</p>
                  </div>
                  <Link className="button button--quiet" href={item.href}>{item.action} <ArrowRight /></Link>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {figures.length > 0 ? (
        <section className="figure-row" aria-label="Summary">
          {figures.map((figure) => (
            <article className="figure-tile" key={figure.label}>
              <small>{figure.label}</small>
              <strong>{figure.value}</strong>
              <p>{figure.hint}</p>
            </article>
          ))}
        </section>
      ) : null}

      {panels.length > 0 ? (
        <section className="home-panels">
          {panels.map((panel) => (
            <article className="card home-panel" key={panel.id} aria-labelledby={`panel-${panel.id}`}>
              <header className="card__header">
                <div><span className="eyebrow">{panel.eyebrow}</span><h2 id={`panel-${panel.id}`}>{panel.title}</h2></div>
                {panel.link ? <Link href={panel.link.href}>{panel.link.label} <ArrowRight /></Link> : null}
              </header>
              {panel.rows.length === 0 ? (
                <p className="home-panel__empty">{panel.empty}</p>
              ) : (
                <ul className="home-rows">
                  {panel.rows.map((row) => (
                    <li key={row.id}>
                      <Link href={row.href} className="home-row">
                        <span className="home-row__copy"><strong>{row.title}</strong><small>{row.detail}</small></span>
                        {row.status ? <StatusBadge value={row.status.value} label={row.status.label} /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
