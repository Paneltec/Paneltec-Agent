import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { filesApi } from "../lib/api";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

function highlight(text, q) {
  if (!q) return text;
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return text;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="ptec-mark">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function FileViewer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    filesApi
      .get(id)
      .then(setDoc)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <main className="mx-auto max-w-[900px] px-6 py-20 text-center font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
        Loading file…
      </main>
    );
  if (!doc)
    return (
      <main className="mx-auto max-w-[900px] px-6 py-20 text-center text-sm text-[var(--ptec-text-muted)]">
        File not found.
      </main>
    );

  const isCode = ["code"].includes(doc.category);

  return (
    <main className="mx-auto max-w-[1000px] px-6 pt-8 pb-24">
      <Link
        to={q ? `/search?q=${encodeURIComponent(q)}` : "/library"}
        data-testid="back-link"
        className="font-mono-ptec inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)] hover:text-[var(--ptec-text)]"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <div className="mt-6 border border-[var(--ptec-border)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-[var(--ptec-blue)]" />
              <span className="font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
                {doc.category}
              </span>
            </div>
            <h1
              data-testid="file-name"
              className="font-display mt-1 truncate text-2xl tracking-tight text-[var(--ptec-text)]"
            >
              {doc.name}
            </h1>
            <div className="font-mono-ptec mt-1 truncate text-[11px] text-[var(--ptec-text-muted)]">
              {doc.path}
            </div>
          </div>
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              data-testid="open-on-github"
              className="font-mono-ptec inline-flex shrink-0 items-center gap-1.5 border border-[var(--ptec-text)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--ptec-text)] transition-colors duration-150 hover:bg-[var(--ptec-text)] hover:text-white"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <pre
          data-testid="file-content"
          className={`max-h-[70vh] overflow-auto p-6 text-[13px] leading-6 ${
            isCode ? "font-mono-ptec" : "font-mono-ptec"
          } whitespace-pre-wrap break-words text-[var(--ptec-text)]`}
        >
          {highlight(doc.content || "(empty)", q)}
        </pre>
      </div>
    </main>
  );
}
