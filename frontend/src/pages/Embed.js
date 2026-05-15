import { useState, useEffect, useCallback } from "react";
import SearchBar from "../components/SearchBar";
import AIAnswer from "../components/AIAnswer";
import ActionCards from "../components/ActionCards";
import { searchApi } from "../lib/api";

/**
 * Embed mode — minimal chrome, designed for iframing inside the Paneltec portal.
 * No top nav, no library/dashboard. Just the search → action cards + AI answer flow.
 */
export default function Embed() {
  const [query, setQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResp, setAiResp] = useState(null);

  const run = useCallback(async (q) => {
    setQuery(q);
    setAiLoading(true);
    setAiResp(null);
    try {
      const r = await searchApi.ask(q);
      setAiResp(r);
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Listen for queries pushed from the parent portal: postMessage({type:'paneltec-query', q:'…'})
  useEffect(() => {
    const handler = (e) => {
      const m = e && e.data;
      if (m && m.type === "paneltec-query" && typeof m.q === "string") run(m.q);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [run]);

  return (
    <main
      data-testid="embed-root"
      className="mx-auto max-w-[980px] px-5 py-5"
      style={{ background: "transparent" }}
    >
      <div className="mb-4">
        <SearchBar
          size="compact"
          initial={query}
          onSubmit={run}
          autoFocus
          placeholder="Search the Paneltec portal…  e.g. 'make a PIN for the gate'"
        />
      </div>

      {query && <ActionCards query={query} />}

      {query ? (
        <AIAnswer
          loading={aiLoading}
          answer={aiResp?.answer || ""}
          citations={aiResp?.citations || []}
          query={query}
        />
      ) : (
        <div className="border border-dashed border-[var(--ptec-border)] px-5 py-10 text-center">
          <p className="font-display text-2xl tracking-tight text-[var(--ptec-text)]">
            Ask the Paneltec portal anything.
          </p>
          <p className="mt-2 text-sm text-[var(--ptec-text-secondary)]">
            Type a question or an action ("create a PIN", "open weighbridge", "show the
            equipment finance app") and the agent will route you to the right page.
          </p>
        </div>
      )}
    </main>
  );
}
