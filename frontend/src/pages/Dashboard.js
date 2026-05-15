import { useEffect, useState, useRef } from "react";
import { indexApi } from "../lib/api";
import { RefreshCw, Database, Layers, GitBranch, CheckCircle2, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [job, setJob] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef(null);

  const loadStats = async () => {
    try {
      const s = await indexApi.stats();
      setStats(s);
      if (s.last_job) setJob(s.last_job);
    } catch {}
  };

  useEffect(() => {
    loadStats();
    return () => pollRef.current && clearInterval(pollRef.current);
  }, []);

  const startSync = async () => {
    setSyncing(true);
    try {
      const j = await indexApi.sync();
      setJob(j);
      pollRef.current && clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const cur = await indexApi.job(j.id);
          setJob(cur);
          if (cur.status === "done" || cur.status === "error") {
            clearInterval(pollRef.current);
            setSyncing(false);
            loadStats();
          }
        } catch {}
      }, 1500);
    } catch (e) {
      setSyncing(false);
    }
  };

  const isRunning = job && (job.status === "queued" || job.status === "running");
  const pct = job && job.total ? Math.min(100, Math.round((job.progress / job.total) * 100)) : 0;

  return (
    <main className="mx-auto max-w-[1100px] px-6 pt-10 pb-24">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono-ptec text-[11px] uppercase tracking-[0.22em] text-[var(--ptec-text-secondary)]">
          Indexing · Control Room
        </span>
      </div>
      <h1 className="font-display text-4xl tracking-tight text-[var(--ptec-text)] md:text-5xl">
        Sync the corpus.
      </h1>
      <p className="mt-3 max-w-2xl text-base text-[var(--ptec-text-secondary)]">
        Pull the latest manuals, apps, and documents from the connected GitHub
        repository. Re-indexing replaces the previous corpus.
      </p>

      {/* Repo & action */}
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <div className="border border-[var(--ptec-border)] p-5">
          <div className="font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-muted)]">
            Connected repository
          </div>
          <div className="mt-2 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[var(--ptec-blue)]" />
            <span className="font-mono-ptec text-base text-[var(--ptec-text)]">
              {stats?.repo || "—"}
            </span>
          </div>
        </div>
        <button
          data-testid="sync-button"
          onClick={startSync}
          disabled={syncing || isRunning}
          className="flex items-center justify-center gap-2 bg-[var(--ptec-text)] px-6 py-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--ptec-blue)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing || isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Indexing…" : "Run Full Re-Index"}
        </button>
      </div>

      {/* Job status */}
      {job && (
        <div
          data-testid="job-status"
          className="mt-6 border border-[var(--ptec-border)] p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--ptec-blue)]" />
              ) : job.status === "error" ? (
                <AlertCircle className="h-4 w-4 text-[var(--ptec-red)]" />
              ) : (
                <RefreshCw className="h-4 w-4 animate-spin text-[var(--ptec-blue)]" />
              )}
              <span className="font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text)]">
                Job · {job.status}
              </span>
            </div>
            <span className="font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
              {job.progress}/{job.total || "?"} · {pct}%
            </span>
          </div>
          <div className="mt-3 h-1 w-full bg-[var(--ptec-border)]">
            <div
              className="h-full bg-[var(--ptec-blue)] transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="font-mono-ptec mt-3 truncate text-[11px] text-[var(--ptec-text-secondary)]">
            {job.message}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Bento label="Files" value={stats?.files ?? "—"} icon={<Database className="h-4 w-4" />} testId="bento-files" />
        <Bento label="Chunks" value={stats?.chunks ?? "—"} icon={<Layers className="h-4 w-4" />} testId="bento-chunks" />
        <Bento
          label="Last sync"
          value={
            stats?.last_job?.finished_at
              ? new Date(stats.last_job.finished_at).toLocaleString()
              : "—"
          }
          mono
          testId="bento-last-sync"
        />
        <Bento
          label="Status"
          value={stats?.last_job?.status || "idle"}
          mono
          testId="bento-status"
        />
      </div>

      {/* Categories breakdown */}
      <div className="mt-8">
        <div className="mb-3 font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
          Categories
        </div>
        <div className="grid grid-cols-2 gap-px border border-[var(--ptec-border)] bg-[var(--ptec-border)] md:grid-cols-5">
          {["manual", "app", "doc", "code", "other"].map((k) => (
            <div key={k} data-testid={`cat-${k}`} className="bg-white p-4">
              <div className="font-mono-ptec text-[10px] uppercase tracking-[0.16em] text-[var(--ptec-text-muted)]">
                {k}
              </div>
              <div className="font-display mt-1 text-2xl text-[var(--ptec-text)]">
                {stats?.categories?.[k] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Bento({ label, value, icon, mono, testId }) {
  return (
    <div
      data-testid={testId}
      className="border border-[var(--ptec-border)] bg-white p-5"
    >
      <div className="flex items-center gap-2 text-[var(--ptec-text-muted)]">
        {icon}
        <span className="font-mono-ptec text-[10px] uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-[var(--ptec-text)] ${
          mono ? "font-mono-ptec text-sm break-words" : "font-display text-2xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
