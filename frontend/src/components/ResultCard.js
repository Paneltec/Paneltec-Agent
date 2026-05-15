import { Link } from "react-router-dom";
import { FileText, Code2, BookOpen, Boxes, File } from "lucide-react";

const ICON = {
  manual: BookOpen,
  app: Boxes,
  code: Code2,
  doc: FileText,
  other: File,
};

function highlight(snippet, q) {
  if (!q) return snippet;
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return snippet;
  const re = new RegExp(`(${tokens.join("|")})`, "ig");
  const parts = snippet.split(re);
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

export default function ResultCard({ hit, query, index }) {
  const Icon = ICON[hit.category] || File;
  return (
    <Link
      to={`/file/${hit.file_id}?q=${encodeURIComponent(query || "")}`}
      data-testid={`result-card-${index}`}
      className="group flex items-start gap-4 border-b border-[var(--ptec-border)] py-5 transition-colors duration-150 hover:bg-[var(--ptec-surface)]"
    >
      <div className="font-mono-ptec mt-1 w-8 shrink-0 text-right text-[10px] text-[var(--ptec-text-muted)]">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[var(--ptec-blue)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ptec-text-secondary)]">
            {hit.category}
          </span>
          <span className="text-[var(--ptec-text-muted)]">·</span>
          <span className="font-mono-ptec truncate text-[11px] text-[var(--ptec-text-muted)]">
            {hit.path}
          </span>
        </div>
        <h3 className="font-display mt-1 text-lg tracking-tight text-[var(--ptec-text)] group-hover:text-[var(--ptec-blue)]">
          {hit.name}
        </h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[var(--ptec-text-secondary)]">
          {highlight(hit.snippet, query)}
        </p>
      </div>
      <div className="font-mono-ptec shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-wider text-[var(--ptec-text-muted)]">
          score
        </div>
        <div className="text-sm font-semibold text-[var(--ptec-text)]">
          {hit.score.toFixed(2)}
        </div>
      </div>
    </Link>
  );
}
