import { useState } from "react";
import { FileText, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

function renderWithCitations(text, citations, onJump) {
  if (!text) return null;
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, idx) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const exists = citations?.some((c) => c.n === n);
      return (
        <button
          key={idx}
          onClick={() => exists && onJump?.(n)}
          data-testid={`citation-inline-${n}`}
          className={`mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center align-baseline border px-1 text-[10px] font-mono-ptec font-semibold transition-colors duration-150 ${
            exists
              ? "border-[var(--ptec-blue)] bg-[var(--ptec-blue)]/10 text-[var(--ptec-blue)] hover:bg-[var(--ptec-blue)] hover:text-white cursor-pointer"
              : "border-[var(--ptec-border)] text-[var(--ptec-text-muted)]"
          }`}
        >
          {n}
        </button>
      );
    }
    return (
      <span key={idx} className="whitespace-pre-wrap">
        {p}
      </span>
    );
  });
}

export default function AIAnswer({ loading, answer, citations = [], query }) {
  const [hi, setHi] = useState(null);

  return (
    <section
      data-testid="ai-answer-section"
      className="ptec-fade-in border-l-2 border-[var(--ptec-blue)] pl-6"
    >
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--ptec-blue)]" />
        <span>Answer · Claude Sonnet 4.5</span>
      </div>
      {loading ? (
        <div data-testid="ai-answer-loading" className="space-y-3">
          <div className="ptec-typing">
            <span />
            <span />
            <span />
          </div>
          <div className="font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
            Searching corpus, ranking chunks, synthesising…
          </div>
        </div>
      ) : (
        <div
          data-testid="ai-answer-text"
          className="text-[15px] leading-7 text-[var(--ptec-text)]"
        >
          {renderWithCitations(answer, citations, setHi)}
        </div>
      )}

      {!loading && citations.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
            Sources ({citations.length})
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {citations.map((c) => (
              <Link
                key={c.n}
                to={`/file/${c.file_id}?q=${encodeURIComponent(query || "")}`}
                data-testid={`citation-card-${c.n}`}
                className={`group flex items-start gap-3 border p-3 transition-colors duration-150 ${
                  hi === c.n
                    ? "border-[var(--ptec-blue)] bg-[var(--ptec-blue)]/5"
                    : "border-[var(--ptec-border)] hover:border-[var(--ptec-text)] hover:bg-[var(--ptec-surface)]"
                }`}
              >
                <div className="font-mono-ptec mt-0.5 flex h-5 w-6 shrink-0 items-center justify-center border border-[var(--ptec-blue)] bg-[var(--ptec-blue)] text-[10px] font-bold text-white">
                  {c.n}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-[var(--ptec-text-muted)]" />
                    <span className="truncate text-sm font-semibold text-[var(--ptec-text)]">
                      {c.name}
                    </span>
                    <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  </div>
                  <div className="font-mono-ptec mt-0.5 truncate text-[10px] text-[var(--ptec-text-muted)]">
                    {c.path}
                  </div>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-[var(--ptec-text-secondary)]">
                    {c.snippet}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
