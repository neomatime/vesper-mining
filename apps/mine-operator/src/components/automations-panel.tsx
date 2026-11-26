"use client";

/**
 * The Automations tab of Administration: seven "when this happens, tell this person" rules. The Mine Manager switches each on or off,
 * chooses who is told and, where it applies, how early or late it counts, then runs them. Rules only notify: they never change a record,
 * approve or send anything, and tell nobody outside VESPER. A rule announces a record once until the problem has cleared.
 */
import { Info, Play } from "lucide-react";
import { formatDemoDateTime } from "@/lib/demo-clock";
import type { AutomationRecipient } from "@/lib/automation-rules";
import { ErrorState, LoadingState } from "./query-state";
import { Select } from "./select";
import { StatusBadge } from "./status-badge";
import { useAutomationMutations, useAutomations, type AutomationsView } from "./use-automations";
import { Busy } from "./busy";

export function AutomationsPanel() {
  const query = useAutomations();
  const { update, run } = useAutomationMutations();
  if (query.isPending) return <LoadingState variant="panel" />;
  if (query.isError && !query.data) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const view: AutomationsView = query.data;
  const anyOn = view.rules.some((item) => item.rule.enabled);

  return (
    <div role="tabpanel" id="panel-automations" aria-labelledby="tab-automations" className="admin-panel">
      <section className="card register-card" aria-labelledby="automations-heading">
        <header className="card__header">
          <div><span className="eyebrow">Operations</span><h2 id="automations-heading">Automations</h2></div>
          <button className="button button--primary" disabled={!anyOn || run.isPending} onClick={() => run.mutate({})}><Play /> <Busy pending={run.isPending} label="Running…">Run all rules now</Busy></button>
        </header>
        <div className="note-bar"><Info /> <span>Rules tell people when something needs them. They never change a record, approve or send anything. They run when you press Run, and notifications stay inside VESPER.</span></div>
        <ul className="automation-list" aria-label="Automations">
          {view.rules.map(({ definition, rule }) => (
            <li className={`automation ${rule.enabled ? "automation--on" : ""}`} key={definition.key}>
              <label className="automation__switch">
                <input type="checkbox" role="switch" checked={rule.enabled} disabled={update.isPending} aria-label={`${definition.name}: ${rule.enabled ? "on" : "off"}`} onChange={(event) => update.mutate({ key: definition.key, enabled: event.target.checked })} />
                <span className="automation__track" aria-hidden="true" />
              </label>
              <div className="automation__body">
                <strong>{definition.name}</strong>
                <p>{definition.description}</p>
                <div className="automation__settings">
                  <label>
                    <span>Tell</span>
                    <Select value={rule.recipient} disabled={update.isPending} onChange={(event) => update.mutate({ key: definition.key, recipient: event.target.value })}>
                      {definition.hasOwner ? <option value="owner">The owner of the record</option> : null}
                      {view.recipients.map((role) => <option key={role} value={role}>{role}</option>)}
                    </Select>
                  </label>
                  {definition.threshold ? (
                    <label>
                      <span>{definition.threshold.label}</span>
                      <span className="automation__number">
                        <input
                          type="number"
                          min={definition.threshold.min}
                          max={definition.threshold.max}
                          defaultValue={rule.threshold ?? definition.threshold.default}
                          key={`${definition.key}-${rule.threshold}`}
                          aria-label={`${definition.name}: ${definition.threshold.label} (${definition.threshold.unit})`}
                          onBlur={(event) => { const value = Number(event.target.value); if (value !== rule.threshold && event.target.value !== "") update.mutate({ key: definition.key, threshold: value }); }}
                        />
                        {definition.threshold.unit}
                      </span>
                    </label>
                  ) : null}
                </div>
              </div>
              <div className="automation__status">
                {rule.lastRunAt ? <><StatusBadge value={rule.lastFound > 0 ? "at_risk" : "complete"} label={rule.lastFound > 0 ? `${rule.lastFound} found` : "Nothing found"} /><small>{rule.lastNotified} notified · {formatDemoDateTime(rule.lastRunAt)}</small></> : <small>{rule.enabled ? "Not run yet" : "Off"}</small>}
                <button className="button button--quiet button--small" disabled={!rule.enabled || run.isPending} aria-label={`Run ${definition.name} now`} onClick={() => run.mutate({ key: definition.key })}>Run</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card register-card" aria-labelledby="automation-history-heading">
        <header className="card__header"><div><span className="eyebrow">History</span><h2 id="automation-history-heading">What ran and what changed</h2></div></header>
        {view.runs.length === 0 ? (
          <div className="empty-inline"><strong>Nothing has run yet</strong><span>Switch a rule on and press Run to see what it finds.</span></div>
        ) : (
          <ul className="timeline-list" aria-label="Automation history">
            {view.runs.map((item) => <li key={item.id}><strong>{item.summary}</strong><small>{formatDemoDateTime(item.at)} · {item.actor}{item.kind === "setting" ? " · setting changed" : ""}</small></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

export type { AutomationRecipient };
