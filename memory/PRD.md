# Paneltec Group Portal — AI Search Agent · PRD

## Original Problem Statement
> "i have a portal named paneltec Group Portal, would there be a ai agent that could do a global search on every word / sentence etc this very extensive database like manuals and apps"

User clarifications:
- Data source: public GitHub repo `Paneltec/The-Paneltec-Group-New` (all files: docs, code, markdown, PDFs)
- Search type: Both semantic + keyword
- Model: Claude Sonnet 4.5 via Emergent Universal LLM key
- Auth: None — agent is intended to be embedded into the existing Paneltec Group Portal
- Vision: "Total global portal search as if it was Google in my private data"

## Architecture
- Backend: FastAPI + MongoDB
- Indexer: GitHub public API → fetch repo tree → fetch raw blobs → extract text (pypdf for PDFs) → 1.2k-char chunks with 200-char overlap → MongoDB text index
- Search: MongoDB `$text` (BM25-style ranking)
- AI (RAG): top-8 chunks → Claude Sonnet 4.5 via `emergentintegrations.LlmChat` → answer with inline `[n]` citations
- Frontend: React + Tailwind, Swiss/high-contrast design (Cabinet Grotesk + IBM Plex Sans + JetBrains Mono, Klein Blue accent)

## Endpoints
- `GET  /api/` — health
- `GET  /api/index/stats` — files / chunks / categories / last_job / repo
- `POST /api/index/sync` — start indexing (returns existing job if running)
- `GET  /api/index/job/{id}` — job status
- `GET  /api/search?q=&category=&limit=` — keyword search
- `POST /api/ai/ask` — RAG answer + citations
- `GET  /api/files/list?category=&q=` — browse indexed files
- `GET  /api/files/{id}` — full file content

## What's been implemented (2026-02 / first build)
- Full backend with GitHub crawler, indexer, search, and Claude Sonnet 4.5 RAG
- Initial corpus indexed: **344 files / 9,258 chunks** from `Paneltec/The-Paneltec-Group-New@main`
- Categories detected: manual (5), app (28), doc (10), code (257), other (44)
- 5 pages: Home (hero), Search Results (AI answer + citations + matches), Library (browse all), Indexing Dashboard, File Viewer
- Suggestion chips on Home are pre-tuned to real content in the corpus
- All interactive elements have `data-testid` attributes
- Backend + frontend tested end-to-end via testing agent (15/15 backend pytest pass, all UI flows pass)

## User Personas
- **Paneltec staff** — wants to find an answer fast across manuals, apps, docs, code, ops runbooks
- **Operations / IT** — re-runs the indexer when the repo changes
- **Engineers** — uses code-filtered search to find an implementation across the monorepo

## Core Requirements (static)
- Google-style global search across the whole private corpus
- AI conversational answers with verifiable inline source citations
- Category filtering (manuals / apps / docs / code / other)
- File viewer with query highlighting and link back to GitHub
- Re-indexable on demand

## Prioritised Backlog
### P0 (next)
- Embed-mode (`/embed`) route — minimal chrome, postMessage size events — for embedding inside the existing Paneltec portal as an iframe
- Auto re-index on schedule (e.g. nightly cron) or via GitHub webhook

### P1
- Streaming AI answer (SSE) for faster perceived latency
- Conversation memory (multi-turn follow-ups using `session_id`)
- Recently searched / popular queries panel
- Markdown-aware rendering inside the file viewer (currently raw text)
- Syntax highlighting for code files (Prism/Shiki)

### P2
- Multi-repo support (add more GitHub sources from Dashboard)
- Optional auth (JWT or Emergent Google) if the embed host requires it
- Vector embeddings (when available via Emergent integrations) for true semantic recall
- Per-user search history & saved queries
- Export answer to PDF / share link

## Next tasks list
- Build `/embed` route + iframe-friendly CORS / styling
- Add GitHub webhook endpoint to auto-trigger re-index on push
- Add server-sent events for streaming AI answer
- Wire up multi-turn chat history using the existing `conversations` collection
