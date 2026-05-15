# Paneltec AI Search — Portal Integration Guide

This folder contains everything needed to add the **Paneltec AI Search agent**
to the existing **Paneltec Group Portal**. Two integration paths are supported:

| Path                  | When to use                                                      |
| --------------------- | ---------------------------------------------------------------- |
| **A. React component** | Recommended. Portal is already React; native SPA routing.       |
| **B. Vanilla HTML**    | Quick win. Drop into any HTML page, no React dependency.        |

The agent runs at the deployed URL and exposes `/embed`, a minimal-chrome view
designed for iframing.

---

## A · Drop-in React component (recommended)

### Step 1 — Copy two files into the portal repo

In `Paneltec/The-Paneltec-Group-New`, create a folder
`frontend/src/paneltec-ai-search/` and copy:

- `PaneltecAiSearch.jsx`  → the widget
- (optional) `example-usage.jsx` → reference wiring

### Step 2 — Wire it into your Search page

```jsx
import { useNavigate } from "react-router-dom";
import PaneltecAiSearch from "../paneltec-ai-search/PaneltecAiSearch";

export default function SearchPage() {
  const navigate = useNavigate();
  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Portal Search</h1>
      <PaneltecAiSearch navigate={navigate} height={760} />
    </main>
  );
}
```

That's it. The widget will:
- Render the AI agent inside the page
- Intercept `paneltec-navigate` messages and call `navigate(path)` so clicks
  on action cards stay inside the SPA (no page reload)

### Optional — `onNavigate` for total control

```jsx
<PaneltecAiSearch
  navigate={navigate}
  onNavigate={(msg) => {
    // msg = { path, url, label, confidence }
    // e.g. add analytics / guards before routing
    analytics.track("portal-ai-navigate", msg);
    navigate(msg.path);
  }}
/>
```

### Optional — push a query into the widget

```jsx
<PaneltecAiSearch navigate={navigate} defaultQuery="make a PIN for the gate" />
```

Useful when linking from elsewhere in the portal:
`<a href="/search?q=make a PIN">…</a>` → on that page, read `?q=` and pass it
as `defaultQuery`.

---

## B · Vanilla HTML snippet

Paste this anywhere in your portal's HTML where you want the search to appear.

```html
<!-- Paneltec AI Search · embed snippet -->
<div id="paneltec-ai-search" style="width:100%;max-width:980px;margin:0 auto;">
  <iframe
    src="https://6ca6db79-a5ea-44be-8fdd-0f68b6a9f102.preview.emergentagent.com/embed"
    title="Paneltec AI Search"
    style="width:100%;height:720px;border:1px solid #E5E5E5;background:#fff;"
    allow="clipboard-write"
  ></iframe>
</div>
<script>
  window.addEventListener("message", function (e) {
    var msg = e && e.data;
    if (!msg || msg.type !== "paneltec-navigate") return;
    // Option A: SPA navigation (uncomment if your portal uses a client router)
    // window.history.pushState({}, "", msg.path);
    // window.dispatchEvent(new PopStateEvent("popstate"));
    // Option B: full navigation (default)
    window.location.assign(msg.url || msg.path);
  });
</script>
```

The same snippet is generated dynamically on the agent's `/admin` page with a
one-click **Copy** button.

---

## Cross-frame postMessage protocol

The agent communicates with the parent portal via `window.postMessage`. Two
message types exist:

### Outbound (iframe → portal)

```ts
{ type: "paneltec-navigate", path: string, url: string,
  label: string, confidence: number }
```

Sent when the user clicks an AI action card.

### Inbound (portal → iframe)

```ts
{ type: "paneltec-query", q: string }
```

Programmatically run a query. Useful when navigating to your portal's Search
page with a `?q=` param.

```js
const iframe = document.querySelector("iframe");
iframe.contentWindow.postMessage(
  { type: "paneltec-query", q: "open weighbridge" },
  "*"
);
```

---

## Pre-flight checklist

Before going live, in the agent's `/admin` page:

1. **Set the Portal Base URL** to your actual portal origin
   (e.g. `https://portal.paneltec.com.au`). This is used as a fallback when
   the agent is NOT iframed (e.g. someone visits the agent's `/search` page
   directly).
2. Click **Auto-Extract from Code** so the actions catalog includes every
   route from the latest portal codebase. Re-run after each portal release.
3. Review the **Actions Catalog**. Add missing custom actions — especially
   the ones with a specific user intent like "Make a Gate PIN" pointing to
   `/gate-pass?action=create`.

---

## Where it lives

- **Agent app**: `frontend/` and `backend/` of the Emergent project
- **Embed view**: `/embed` (no top-nav)
- **Admin / wiring**: `/admin`
- **API**: `/api/ai/route`, `/api/ai/ask`, `/api/search`, etc.

For the full API reference see `/app/backend/server.py`.
