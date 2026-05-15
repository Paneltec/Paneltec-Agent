import { useEffect, useState, useMemo } from "react";
import { actionsApi, settingsApi } from "../lib/api";
import { RefreshCw, Plus, Trash2, Save, Copy, Check } from "lucide-react";

export default function Admin() {
  const [settings, setSettings] = useState({ portal_base_url: "", iframe_origin: "*" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [newAction, setNewAction] = useState({ path: "", label: "", description: "" });
  const [copied, setCopied] = useState(false);
  const [snippetTab, setSnippetTab] = useState("html");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        settingsApi.get(),
        actionsApi.list(filter, sourceFilter),
      ]);
      setSettings(s);
      setActions(a.actions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sourceFilter]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const s = await settingsApi.update(settings);
      setSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const runExtract = async () => {
    setExtracting(true);
    try {
      await actionsApi.extract();
      await loadAll();
    } finally {
      setExtracting(false);
    }
  };

  const createAction = async () => {
    if (!newAction.path || !newAction.label) return;
    await actionsApi.create(newAction);
    setNewAction({ path: "", label: "", description: "" });
    await loadAll();
  };

  const removeAction = async (id) => {
    await actionsApi.remove(id);
    await loadAll();
  };

  const embedUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/embed`;
  }, []);

  const snippet = useMemo(
    () => `<!-- Paneltec AI Search · embed snippet -->
<div id="paneltec-ai-search" style="width:100%;max-width:980px;margin:0 auto;">
  <iframe
    src="${embedUrl}"
    title="Paneltec AI Search"
    style="width:100%;height:720px;border:1px solid #E5E5E5;background:#fff;"
    allow="clipboard-write"
  ></iframe>
</div>
<script>
  // Listen for navigation events from the agent and route inside the portal
  window.addEventListener("message", function (e) {
    var msg = e && e.data;
    if (!msg || msg.type !== "paneltec-navigate") return;
    // Option A: SPA navigation (uncomment if your portal uses React Router etc.)
    // window.history.pushState({}, "", msg.path); window.dispatchEvent(new PopStateEvent("popstate"));
    // Option B: full navigation (default)
    window.location.assign(msg.url || msg.path);
  });
</script>`,
    [embedUrl]
  );

  const reactSnippet = useMemo(
    () => `// 1) Save as: frontend/src/paneltec-ai-search/PaneltecAiSearch.jsx
// 2) Use it on your Search page:
import { useNavigate } from "react-router-dom";
import PaneltecAiSearch from "./paneltec-ai-search/PaneltecAiSearch";

export default function SearchPage() {
  const navigate = useNavigate();
  return (
    <main style={{ padding: 24 }}>
      <h1>Portal Search</h1>
      <PaneltecAiSearch
        src="${embedUrl}"
        navigate={navigate}     // SPA routing for action cards
        height={760}
        // defaultQuery="make a PIN for the gate"
      />
    </main>
  );
}

/* The component file itself is at:
   /app/portal-integration/PaneltecAiSearch.jsx
   Full integration guide: /app/portal-integration/README.md          */`,
    [embedUrl]
  );

  const activeSnippet = snippetTab === "html" ? snippet : reactSnippet;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <main className="mx-auto max-w-[1100px] px-6 pt-10 pb-24">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono-ptec text-[11px] uppercase tracking-[0.22em] text-[var(--ptec-text-secondary)]">
          Admin · Portal Wiring
        </span>
      </div>
      <h1 className="font-display text-4xl tracking-tight text-[var(--ptec-text)] md:text-5xl">
        Embed & route into the portal.
      </h1>

      {/* SETTINGS */}
      <section className="mt-10 border border-[var(--ptec-border)]">
        <div className="border-b border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-5 py-3 font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
          1 · Portal Base URL
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[1fr_220px_140px]">
          <input
            data-testid="portal-base-url-input"
            placeholder="https://portal.paneltec.com.au"
            value={settings.portal_base_url || ""}
            onChange={(e) => setSettings({ ...settings, portal_base_url: e.target.value })}
            className="border border-[var(--ptec-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <input
            data-testid="iframe-origin-input"
            placeholder="iframe parent origin (or *)"
            value={settings.iframe_origin || ""}
            onChange={(e) => setSettings({ ...settings, iframe_origin: e.target.value })}
            className="border border-[var(--ptec-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <button
            data-testid="save-settings-button"
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-[var(--ptec-text)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[var(--ptec-blue)] disabled:opacity-60"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved" : saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="px-5 pb-5 text-xs text-[var(--ptec-text-muted)]">
          When a user clicks an action card, we postMessage to the parent (if iframed) or
          navigate to <span className="font-mono-ptec">portal_base_url + action.path</span>.
        </p>
      </section>

      {/* EMBED SNIPPET */}
      <section className="mt-8 border border-[var(--ptec-border)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-5 py-3">
          <span className="font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
            2 · Paste this into your Portal's search area
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[
                { k: "html", label: "Vanilla HTML" },
                { k: "react", label: "React" },
              ].map((t) => (
                <button
                  key={t.k}
                  data-testid={`snippet-tab-${t.k}`}
                  onClick={() => setSnippetTab(t.k)}
                  className={`border px-3 py-1 font-mono-ptec text-[10px] uppercase tracking-[0.14em] ${
                    snippetTab === t.k
                      ? "border-[var(--ptec-text)] bg-[var(--ptec-text)] text-white"
                      : "border-[var(--ptec-border)] text-[var(--ptec-text-secondary)] hover:border-[var(--ptec-text)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              data-testid="copy-snippet-button"
              onClick={copySnippet}
              className="inline-flex items-center gap-1.5 border border-[var(--ptec-text)] px-3 py-1 font-mono-ptec text-[10px] uppercase tracking-[0.14em] text-[var(--ptec-text)] hover:bg-[var(--ptec-text)] hover:text-white"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <pre
          data-testid="embed-snippet"
          className="max-h-[420px] overflow-auto bg-white p-5 font-mono-ptec text-[12px] leading-relaxed text-[var(--ptec-text)]"
        >
{activeSnippet}
        </pre>
        {snippetTab === "react" && (
          <div className="border-t border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-5 py-3 text-xs text-[var(--ptec-text-secondary)]">
            The component file <span className="font-mono-ptec text-[var(--ptec-text)]">PaneltecAiSearch.jsx</span>{" "}
            lives at <span className="font-mono-ptec text-[var(--ptec-text)]">/app/portal-integration/</span>.
            Copy it into <span className="font-mono-ptec text-[var(--ptec-text)]">frontend/src/paneltec-ai-search/</span> in your portal repo.
            Full guide: <span className="font-mono-ptec text-[var(--ptec-text)]">/app/portal-integration/README.md</span>.
          </div>
        )}
      </section>

      {/* ACTIONS CATALOG */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono-ptec text-[11px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
              3 · Actions Catalog
            </div>
            <h2 className="font-display mt-1 text-2xl tracking-tight">
              Pages the AI agent can jump to.
            </h2>
          </div>
          <button
            data-testid="extract-actions-button"
            onClick={runExtract}
            disabled={extracting}
            className="inline-flex items-center gap-2 bg-[var(--ptec-text)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[var(--ptec-blue)] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${extracting ? "animate-spin" : ""}`} />
            {extracting ? "Mining routes…" : "Auto-Extract from Code"}
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            data-testid="actions-filter"
            placeholder="Filter by label, path or description…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 border border-[var(--ptec-border)] bg-white px-3 py-2 text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <div className="flex items-center gap-1">
            {["all", "extracted", "custom"].map((s) => (
              <button
                key={s}
                data-testid={`source-filter-${s}`}
                onClick={() => setSourceFilter(s)}
                className={`border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                  sourceFilter === s
                    ? "border-[var(--ptec-text)] bg-[var(--ptec-text)] text-white"
                    : "border-[var(--ptec-border)] text-[var(--ptec-text-secondary)] hover:border-[var(--ptec-text)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* New action */}
        <div className="mb-6 grid grid-cols-1 gap-3 border border-dashed border-[var(--ptec-border)] p-4 md:grid-cols-[160px_220px_1fr_auto]">
          <input
            data-testid="new-action-path"
            placeholder="/path/in/portal"
            value={newAction.path}
            onChange={(e) => setNewAction({ ...newAction, path: e.target.value })}
            className="border border-[var(--ptec-border)] bg-white px-3 py-2 font-mono-ptec text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <input
            data-testid="new-action-label"
            placeholder="Label e.g. Gate PIN Manager"
            value={newAction.label}
            onChange={(e) => setNewAction({ ...newAction, label: e.target.value })}
            className="border border-[var(--ptec-border)] bg-white px-3 py-2 text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <input
            data-testid="new-action-description"
            placeholder="Short description (helps the AI route correctly)"
            value={newAction.description}
            onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
            className="border border-[var(--ptec-border)] bg-white px-3 py-2 text-sm focus:border-[var(--ptec-blue)] focus:outline-none"
          />
          <button
            data-testid="add-action-button"
            onClick={createAction}
            className="inline-flex items-center justify-center gap-1 bg-[var(--ptec-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[var(--ptec-blue-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {/* Catalog list */}
        <div className="border border-[var(--ptec-border)]">
          <div className="grid grid-cols-[1fr_160px_100px_40px] gap-2 border-b border-[var(--ptec-border)] bg-[var(--ptec-surface)] px-4 py-2 font-mono-ptec text-[10px] uppercase tracking-[0.18em] text-[var(--ptec-text-secondary)]">
            <span>Label / Description</span>
            <span>Path</span>
            <span>Source</span>
            <span></span>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center font-mono-ptec text-xs text-[var(--ptec-text-muted)]">
              Loading actions…
            </div>
          ) : actions.length === 0 ? (
            <div
              data-testid="actions-empty"
              className="px-4 py-12 text-center text-sm text-[var(--ptec-text-muted)]"
            >
              No actions yet. Click <strong>Auto-Extract from Code</strong> to mine routes
              from the indexed repo, or add a custom one above.
            </div>
          ) : (
            <div data-testid="actions-list">
              {actions.map((a, i) => (
                <div
                  key={a.id}
                  data-testid={`action-row-${i}`}
                  className="grid grid-cols-[1fr_160px_100px_40px] gap-2 border-b border-[var(--ptec-border)] px-4 py-3 last:border-b-0 hover:bg-[var(--ptec-surface)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--ptec-text)]">
                      {a.label}
                    </div>
                    <div className="truncate text-xs text-[var(--ptec-text-muted)]">
                      {a.description || "—"}
                    </div>
                  </div>
                  <div className="self-center truncate font-mono-ptec text-[11px] text-[var(--ptec-blue)]">
                    {a.path}
                  </div>
                  <div className="self-center font-mono-ptec text-[10px] uppercase tracking-wide text-[var(--ptec-text-secondary)]">
                    {a.source}
                  </div>
                  <button
                    data-testid={`delete-action-${i}`}
                    onClick={() => removeAction(a.id)}
                    className="self-center text-[var(--ptec-text-muted)] hover:text-[var(--ptec-red)]"
                    title="Delete action"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
