import { ArrowRight, Info, Layers, Server } from "lucide-react";
import { environmentDetails, environmentIds, signInDestination, type EnvironmentId } from "@/lib/environments";

const icons: Record<EnvironmentId, typeof Layers> = { uat: Layers, production: Server };

/** The first page a visitor sees: one choice, then the existing sign-in page of that environment. */
export function EnvironmentSelectScreen() {
  return (
    <main className="login">
      <header className="login__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login__mark" src="/images/brand/vesper-mark.png" width={754} height={649} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login__wordmark" src="/images/brand/vesper-wordmark.png" width={1671} height={223} alt="VESPER" />
        <p className="login__tagline">The mining operating system</p>
        <span className="login__rule" aria-hidden="true" />
      </header>

      <section className="login__card login__card--environments" aria-labelledby="environment-heading">
        <div className="login__form">
          <h1 id="environment-heading">Select an Environment</h1>
          <p className="login__lead">Choose where you’d like to access VESPER.</p>

          <ul className="env-list">
            {environmentIds.map((id) => {
              const detail = environmentDetails[id];
              const Icon = icons[id];
              const href = signInDestination(id);
              const body = (
                <>
                  <Icon className="env-option__icon" aria-hidden="true" />
                  <span className="env-option__text">
                    <span className="env-option__title">
                      {detail.title}
                      <span className={`env-badge env-badge--${id}`}>{detail.badge}</span>
                    </span>
                    <span className="env-option__description">{href ? detail.description : "Not available from this address yet."}</span>
                  </span>
                  {href ? <ArrowRight className="env-option__arrow" aria-hidden="true" /> : null}
                </>
              );
              return (
                <li key={id}>
                  {href ? (
                    <a className="env-option" href={href} data-environment={id}>{body}</a>
                  ) : (
                    <div className="env-option env-option--unavailable" aria-disabled="true" data-environment={id}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="env-note"><Info aria-hidden="true" /> For authorised VESPER users only.</p>
      </section>
    </main>
  );
}
