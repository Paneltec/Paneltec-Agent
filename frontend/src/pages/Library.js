import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CategoryChips from "../components/CategoryChips";
import { filesApi } from "../lib/api";
import { FileText, Search } from "lucide-react";

export default function Library() {
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    filesApi
      .list(category, q)
      .then((r) => setFiles(r.files || []))
      .finally(() => setLoading(false));
  }, [category, q]);

  return (
    <main className="mx-auto max-w-[1100px] px-6 pt-10 pb-24">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono-ptec text-[11px] uppercase tracking-[0.22em] text-[var(--ptec-text-secondary)]">
          Library · Indexed Corpus
        </span>
      </div>
      <h1 className="font-display text-4xl tracking-tight text-[var(--ptec-text)] md:text-5xl">
        Every file in the index.
      </h1>

      <div className="mt-8 flex items-center gap-3 border border-[var(--ptec-border)] bg-white px-4 py-2.5">
        <Search className="h-4 w-4 text-[var(--ptec-text-muted)]" />
        <input
          data-testid="library-filter-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by file name or path…"
          className="flex-1 border-0 bg-transparent text-base focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <CategoryChips value={category} onChange={setCategory} />
      </div>

      <div className="mt-8 border border-[var(--ptec-border)]">
        <div className="grid grid-cols-[1fr_120px_80px_120px] gap-2 border-b border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-4 py-2 font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
          <span>Path / Name</span>
          <span>Category</span>
          <span className="text-right">Chunks</span>
          <span className="text-right">Indexed</span>
        </div>
        {loading ? (
          <div className="px-4 py-12 text-center font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
            Loading library…
          </div>
        ) : files.length === 0 ? (
          <div
            data-testid="library-empty"
            className="px-4 py-16 text-center text-sm text-[var(--ptec-text-muted)]"
          >
            Nothing indexed yet. Head to{" "}
            <Link to="/dashboard" className="underline">
              Indexing
            </Link>{" "}
            and run a sync.
          </div>
        ) : (
          <div data-testid="library-list">
            {files.map((f, i) => (
              <Link
                key={f.id}
                to={`/file/${f.id}`}
                data-testid={`library-row-${i}`}
                className="grid grid-cols-[1fr_120px_80px_120px] gap-2 border-b border-[var(--ptec-border)] px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-[var(--ptec-surface)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ptec-blue)]" />
                    <span className="truncate text-sm font-medium text-[var(--ptec-text)]">
                      {f.name}
                    </span>
                  </div>
                  <div className="font-mono-ptec truncate text-[10px] text-[var(--ptec-text-muted)]">
                    {f.path}
                  </div>
                </div>
                <span className="self-center font-mono-ptec text-[10px] uppercase tracking-wide text-[var(--ptec-text-secondary)]">
                  {f.category}
                </span>
                <span className="self-center text-right font-mono-ptec text-xs text-[var(--ptec-text)]">
                  {f.chunk_count}
                </span>
                <span className="self-center text-right font-mono-ptec text-[10px] text-[var(--ptec-text-muted)]">
                  {f.indexed_at?.slice(0, 10)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
