import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import AIAnswer from "../components/AIAnswer";
import ActionCards from "../components/ActionCards";
import ResultCard from "../components/ResultCard";
import CategoryChips from "../components/CategoryChips";
import { searchApi } from "../lib/api";

export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [category, setCategory] = useState("all");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResp, setAiResp] = useState(null);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const runQuery = useCallback(
    async (query, cat) => {
      if (!query) return;
      setAiLoading(true);
      setAiResp(null);
      setResultsLoading(true);
      setResults([]);
      try {
        const r = await searchApi.search(query, cat);
        setResults(r.hits || []);
      } finally {
        setResultsLoading(false);
      }
      try {
        const a = await searchApi.ask(query, null, cat);
        setAiResp(a);
      } finally {
        setAiLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    runQuery(q, category);
  }, [q, category, runQuery]);

  const submit = (newQ) => navigate(`/search?q=${encodeURIComponent(newQ)}`);

  return (
    <main className="mx-auto max-w-[1100px] px-6 pt-8 pb-24">
      <div className="mb-6">
        <SearchBar size="compact" initial={q} onSubmit={submit} autoFocus={false} />
      </div>
      <div className="mb-8">
        <CategoryChips value={category} onChange={setCategory} />
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <ActionCards query={q} />
          <AIAnswer
            loading={aiLoading}
            answer={aiResp?.answer || ""}
            citations={aiResp?.citations || []}
            query={q}
          />

          <div className="mt-12">
            <div className="mb-3 flex items-end justify-between border-b border-[var(--ptec-border)] pb-2">
              <h2 className="font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
                Top Matches
              </h2>
              <span
                data-testid="results-count"
                className="font-mono-ptec text-[11px] text-[var(--ptec-text-muted)]"
              >
                {resultsLoading
                  ? "searching…"
                  : `${results.length} result${results.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {resultsLoading ? (
              <div className="py-12 text-center font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
                Scanning corpus…
              </div>
            ) : results.length === 0 ? (
              <div
                data-testid="empty-results"
                className="py-16 text-center text-sm text-[var(--ptec-text-muted)]"
              >
                No matches found. Try a different query or run a re-sync from the
                Indexing dashboard.
              </div>
            ) : (
              <div data-testid="results-list">
                {results.map((h, i) => (
                  <ResultCard key={`${h.file_id}-${h.chunk_index}`} hit={h} query={q} index={i} />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-6 border border-[var(--ptec-border)] p-5">
            <div>
              <div className="font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-muted)]">
                Query
              </div>
              <div className="mt-1 break-words text-sm font-medium text-[var(--ptec-text)]">
                {q || "—"}
              </div>
            </div>
            <div className="border-t border-[var(--ptec-border)] pt-4">
              <div className="font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-muted)]">
                How it works
              </div>
              <ol className="mt-2 space-y-2 text-[13px] leading-relaxed text-[var(--ptec-text-secondary)]">
                <li>
                  <span className="font-mono-ptec text-[var(--ptec-blue)]">01.</span>{" "}
                  Keyword search across all chunks
                </li>
                <li>
                  <span className="font-mono-ptec text-[var(--ptec-blue)]">02.</span>{" "}
                  Top sources fed to Claude Sonnet 4.5
                </li>
                <li>
                  <span className="font-mono-ptec text-[var(--ptec-blue)]">03.</span>{" "}
                  Answer cites every fact with [n]
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
