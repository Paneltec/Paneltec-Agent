import { useEffect, useState } from "react";
import { ArrowUpRight, Zap } from "lucide-react";
import { actionsApi, settingsApi } from "../lib/api";

function buildHref(base, path) {
  if (!base) return path;
  return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);
}

export default function ActionCards({ query }) {
  const [hits, setHits] = useState([]);
  const [base, setBase] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHits([]);
    if (!query) return;
    actionsApi
      .route(query, 3)
      .then((r) => {
        if (cancelled) return;
        setHits(r.hits || []);
        setBase(r.portal_base_url || "");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const onOpen = (hit) => {
    const href = buildHref(base, hit.path);
    const inIframe = window.parent && window.parent !== window;
    if (inIframe) {
      try {
        window.parent.postMessage(
          {
            type: "paneltec-navigate",
            path: hit.path,
            url: href,
            label: hit.label,
            confidence: hit.confidence,
          },
          "*"
        );
        return;
      } catch (e) {
        /* fall through */
      }
    }
    if (base) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      // No base configured — best-effort relative navigation
      window.open(hit.path, "_blank", "noopener,noreferrer");
    }
  };

  if (loading && !hits.length)
    return (
      <div
        data-testid="action-cards-loading"
        className="mb-6 border border-dashed border-[var(--ptec-border)] px-4 py-3 font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-muted)]"
      >
        Resolving intent…
      </div>
    );

  if (!hits.length) return null;

  return (
    <section
      data-testid="action-cards"
      className="ptec-fade-in mb-8 border border-[var(--ptec-blue)] bg-[var(--ptec-blue)]/[0.04] p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-[var(--ptec-blue)]" />
        <span className="font-mono-ptec text-[10px] uppercase tracking-[0.22em] text-[var(--ptec-blue)]">
          Jump to a Page · Intent Router
        </span>
        {!base && (
          <span
            data-testid="no-base-warning"
            className="font-mono-ptec ml-auto text-[10px] uppercase tracking-wide text-[var(--ptec-red)]"
            title="No portal base URL configured"
          >
            no portal base set
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {hits.map((h, i) => (
          <button
            key={h.id}
            data-testid={`action-card-${i}`}
            onClick={() => onOpen(h)}
            className="group flex flex-col items-start gap-2 border border-[var(--ptec-border)] bg-white p-3 text-left transition-colors duration-150 hover:border-[var(--ptec-text)] hover:bg-[var(--ptec-surface)]"
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span className="text-sm font-semibold tracking-tight text-[var(--ptec-text)]">
                {h.label}
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ptec-text-muted)] transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ptec-blue)]" />
            </div>
            <div className="font-mono-ptec truncate text-[10px] text-[var(--ptec-blue)]">
              {h.path}
            </div>
            {h.description && (
              <p className="line-clamp-2 text-[12px] leading-snug text-[var(--ptec-text-secondary)]">
                {h.description}
              </p>
            )}
            <div className="mt-1 flex w-full items-center justify-between border-t border-[var(--ptec-border)] pt-2">
              <span className="font-mono-ptec text-[10px] uppercase tracking-wide text-[var(--ptec-text-muted)]">
                {h.reason || "match"}
              </span>
              <span className="font-mono-ptec text-[10px] text-[var(--ptec-text-muted)]">
                {(h.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 font-mono-ptec text-[10px] uppercase tracking-[0.16em] text-[var(--ptec-text-muted)]">
        Open in portal → posts to parent window if embedded · opens portal URL otherwise
      </div>
    </section>
  );
}
