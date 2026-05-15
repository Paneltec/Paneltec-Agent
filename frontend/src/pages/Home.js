import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { indexApi } from "../lib/api";
import { Database, GitBranch, Layers, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "How do I onboard a new technician?",
  "Where is the panel installation safety checklist?",
  "List every app available in the portal",
  "What does the warranty policy say about water damage?",
  "Show me the API for the inventory app",
];

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    indexApi.stats().then(setStats).catch(() => {});
  }, []);

  const onSubmit = (q) => navigate(`/search?q=${encodeURIComponent(q)}`);

  return (
    <main className="relative">
      <div className="mx-auto max-w-[1100px] px-6 pt-16 pb-24 md:pt-28">
        <div className="mb-6 flex items-center gap-2">
          <span className="font-mono-ptec text-[11px] uppercase tracking-[0.22em] text-[var(--ptec-text-secondary)]">
            Paneltec Group · Private AI Search Portal
          </span>
        </div>
        <h1
          data-testid="hero-title"
          className="font-display max-w-3xl text-5xl leading-[0.95] tracking-tight text-[var(--ptec-text)] md:text-6xl lg:text-7xl"
        >
          Ask anything across every
          <br />
          manual, app & line of{" "}
          <span className="text-[var(--ptec-blue)]">corporate truth.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--ptec-text-secondary)] md:text-lg">
          A private Google for your organisation. Indexed from
          <span className="font-mono-ptec mx-1.5 inline-flex items-center gap-1 border border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-1.5 py-0.5 text-[12px] text-[var(--ptec-text)]">
            <GitBranch className="h-3 w-3" />
            {stats?.repo || "Paneltec/The-Paneltec-Group-New@main"}
          </span>
          — answered by Claude Sonnet 4.5 with verifiable source citations.
        </p>

        <div className="mt-10">
          <SearchBar size="hero" onSubmit={onSubmit} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-muted)]">
            Try
          </span>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              data-testid={`suggestion-${i}`}
              onClick={() => onSubmit(s)}
              className="border border-[var(--ptec-border)] bg-white px-2.5 py-1 text-xs text-[var(--ptec-text-secondary)] transition-colors duration-150 hover:border-[var(--ptec-text)] hover:text-[var(--ptec-text)]"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 gap-px border border-[var(--ptec-border)] bg-[var(--ptec-border)] md:grid-cols-4">
          <StatBox
            label="Files indexed"
            value={stats?.files ?? "—"}
            icon={<Database className="h-4 w-4" />}
            testId="stat-files"
          />
          <StatBox
            label="Searchable chunks"
            value={stats?.chunks ?? "—"}
            icon={<Layers className="h-4 w-4" />}
            testId="stat-chunks"
          />
          <StatBox
            label="Categories"
            value={
              stats?.categories
                ? Object.keys(stats.categories).length
                : "—"
            }
            icon={<Sparkles className="h-4 w-4" />}
            testId="stat-categories"
          />
          <StatBox
            label="Source"
            value="GitHub · public"
            mono
            icon={<GitBranch className="h-4 w-4" />}
            testId="stat-source"
          />
        </div>
      </div>
    </main>
  );
}

function StatBox({ label, value, icon, mono, testId }) {
  return (
    <div data-testid={testId} className="bg-white p-6">
      <div className="flex items-center gap-2 text-[var(--ptec-text-muted)]">
        {icon}
        <span className="font-mono-ptec text-[10px] uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-3xl text-[var(--ptec-text)] ${
          mono ? "font-mono-ptec text-base" : "font-display"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
