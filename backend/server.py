"""
Paneltec Group Portal — AI Search Backend
A private Google + Perplexity for indexed corporate documents (GitHub repo).
"""
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import io
import uuid
import logging
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Config -----------------------------------------------------------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GITHUB_OWNER = os.environ.get('GITHUB_OWNER', 'Paneltec')
GITHUB_REPO = os.environ.get('GITHUB_REPO', 'The-Paneltec-Group-New')
GITHUB_BRANCH = os.environ.get('GITHUB_BRANCH', 'main')

# --- Logging ----------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("paneltec")

# --- DB ---------------------------------------------------------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
files_col = db.indexed_files
chunks_col = db.indexed_chunks
jobs_col = db.index_jobs
conv_col = db.conversations
actions_col = db.portal_actions
settings_col = db.portal_settings

# --- App --------------------------------------------------------------------
app = FastAPI(title="Paneltec Group AI Search")
api_router = APIRouter(prefix="/api")


# --- Models -----------------------------------------------------------------
class IndexedFile(BaseModel):
    id: str
    path: str
    name: str
    ext: str
    category: str  # manual | app | code | doc | other
    size: int
    sha: Optional[str] = None
    url: Optional[str] = None
    indexed_at: str
    chunk_count: int = 0


class FileListResp(BaseModel):
    files: List[IndexedFile]
    total: int


class SearchHit(BaseModel):
    file_id: str
    path: str
    name: str
    category: str
    snippet: str
    score: float
    chunk_index: int


class SearchResp(BaseModel):
    query: str
    total: int
    hits: List[SearchHit]


class AskReq(BaseModel):
    query: str
    session_id: Optional[str] = None
    category: Optional[str] = None  # filter


class Citation(BaseModel):
    n: int
    file_id: str
    path: str
    name: str
    snippet: str


class AskResp(BaseModel):
    answer: str
    citations: List[Citation]
    session_id: str
    query: str


class IndexJob(BaseModel):
    id: str
    status: str  # queued | running | done | error
    progress: int = 0
    total: int = 0
    message: str = ""
    started_at: str
    finished_at: Optional[str] = None
    files_indexed: int = 0
    chunks_indexed: int = 0


class StatsResp(BaseModel):
    files: int
    chunks: int
    categories: Dict[str, int]
    last_job: Optional[IndexJob] = None
    repo: str


# --- Helpers ----------------------------------------------------------------
TEXT_EXTS = {
    ".md", ".markdown", ".txt", ".rst",
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".c", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".m",
    ".html", ".htm", ".css", ".scss", ".less",
    ".json", ".yml", ".yaml", ".xml", ".toml", ".ini", ".cfg",
    ".sh", ".bash", ".sql", ".env.example", ".gitignore",
    ".csv", ".tsv", ".log",
}
PDF_EXTS = {".pdf"}
MAX_FILE_BYTES = 2 * 1024 * 1024  # 2MB

# Category detection
def categorize(path: str, ext: str) -> str:
    p = path.lower()
    if ext in PDF_EXTS or "manual" in p or "guide" in p or "handbook" in p:
        return "manual"
    if "/apps/" in p or "app/" in p or p.startswith("apps/"):
        return "app"
    if ext in {".md", ".markdown", ".txt", ".rst"} or "docs/" in p or "readme" in p:
        return "doc"
    if ext in {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".c", ".cpp", ".cs",
               ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".m", ".sh", ".sql",
               ".html", ".css", ".scss"}:
        return "code"
    return "other"


def chunk_text(text: str, size: int = 1200, overlap: int = 200) -> List[str]:
    text = text or ""
    if not text.strip():
        return []
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        # try to break on newline near the end
        if end < n:
            cut = text.rfind("\n", start, end)
            if cut > start + size // 2:
                end = cut
        chunks.append(text[start:end].strip())
        if end >= n:
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_snippet(text: str, query: str, length: int = 220) -> str:
    if not text:
        return ""
    q = (query or "").strip().lower()
    if q:
        # find first occurrence of any query token
        tokens = [t for t in re.split(r"\W+", q) if len(t) > 1]
        idx = -1
        for t in tokens:
            i = text.lower().find(t)
            if i != -1 and (idx == -1 or i < idx):
                idx = i
        if idx != -1:
            start = max(0, idx - 60)
            end = min(len(text), start + length)
            snip = text[start:end].strip()
            return ("…" if start > 0 else "") + snip + ("…" if end < len(text) else "")
    return text[:length].strip() + ("…" if len(text) > length else "")


# --- GitHub crawler ---------------------------------------------------------
GITHUB_API = "https://api.github.com"
RAW_BASE = "https://raw.githubusercontent.com"


async def github_list_tree(owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, headers={"Accept": "application/vnd.github+json"})
        if r.status_code == 404:
            raise HTTPException(404, f"GitHub repo {owner}/{repo}@{branch} not found")
        r.raise_for_status()
        data = r.json()
        return [t for t in data.get("tree", []) if t.get("type") == "blob"]


async def github_fetch_raw(owner: str, repo: str, branch: str, path: str) -> bytes:
    url = f"{RAW_BASE}/{owner}/{repo}/{branch}/{path}"
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        r = await c.get(url)
        if r.status_code != 200:
            return b""
        return r.content


def extract_pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(parts)
    except Exception as e:
        logger.warning("PDF parse failed: %s", e)
        return ""


def file_url(owner: str, repo: str, branch: str, path: str) -> str:
    return f"https://github.com/{owner}/{repo}/blob/{branch}/{path}"


# --- Indexing pipeline ------------------------------------------------------
async def run_index_job(job_id: str):
    started = now_iso()
    await jobs_col.update_one(
        {"id": job_id},
        {"$set": {"status": "running", "started_at": started, "message": "Fetching tree…"}},
    )
    try:
        tree = await github_list_tree(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH)
    except Exception as e:
        await jobs_col.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "message": str(e), "finished_at": now_iso()}},
        )
        return

    # filter to supported files
    eligible = []
    for node in tree:
        path = node["path"]
        ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
        size = node.get("size", 0) or 0
        if size > MAX_FILE_BYTES:
            continue
        if ext in TEXT_EXTS or ext in PDF_EXTS or path.lower().endswith("readme"):
            eligible.append(node)

    total = len(eligible)
    await jobs_col.update_one({"id": job_id}, {"$set": {"total": total, "message": f"Indexing {total} files…"}})

    # Clear previous index
    await files_col.delete_many({})
    await chunks_col.delete_many({})

    files_indexed = 0
    chunks_indexed = 0

    # Process with mild concurrency
    sem = asyncio.Semaphore(8)

    async def process_node(node):
        nonlocal files_indexed, chunks_indexed
        async with sem:
            path = node["path"]
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
            data = await github_fetch_raw(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, path)
            if not data:
                return
            if ext in PDF_EXTS:
                text = extract_pdf_text(data)
            else:
                try:
                    text = data.decode("utf-8", errors="ignore")
                except Exception:
                    return
            if not text.strip():
                return
            file_id = str(uuid.uuid4())
            name = path.rsplit("/", 1)[-1]
            category = categorize(path, ext)
            doc = {
                "id": file_id,
                "path": path,
                "name": name,
                "ext": ext,
                "category": category,
                "size": node.get("size", len(data)),
                "sha": node.get("sha"),
                "url": file_url(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, path),
                "indexed_at": now_iso(),
                "content": text[:200000],  # cap stored content
                "chunk_count": 0,
            }
            chunks = chunk_text(text)
            chunk_docs = [
                {
                    "id": str(uuid.uuid4()),
                    "file_id": file_id,
                    "path": path,
                    "name": name,
                    "category": category,
                    "chunk_index": i,
                    "content": ch,
                }
                for i, ch in enumerate(chunks)
            ]
            doc["chunk_count"] = len(chunk_docs)
            await files_col.insert_one(doc)
            if chunk_docs:
                await chunks_col.insert_many(chunk_docs)
            files_indexed += 1
            chunks_indexed += len(chunk_docs)
            await jobs_col.update_one(
                {"id": job_id},
                {"$set": {
                    "progress": files_indexed,
                    "files_indexed": files_indexed,
                    "chunks_indexed": chunks_indexed,
                    "message": f"Indexed {files_indexed}/{total}: {path}",
                }},
            )

    await asyncio.gather(*[process_node(n) for n in eligible], return_exceptions=True)

    # Build text index
    try:
        await chunks_col.create_index([("content", "text"), ("name", "text"), ("path", "text")])
    except Exception as e:
        logger.warning("Index creation issue: %s", e)

    await jobs_col.update_one(
        {"id": job_id},
        {"$set": {
            "status": "done",
            "finished_at": now_iso(),
            "message": f"Indexed {files_indexed} files, {chunks_indexed} chunks.",
            "files_indexed": files_indexed,
            "chunks_indexed": chunks_indexed,
            "progress": files_indexed,
        }},
    )


# --- Routes -----------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "Paneltec Group Portal — AI Search", "status": "ok"}


@api_router.get("/index/stats", response_model=StatsResp)
async def index_stats():
    files = await files_col.count_documents({})
    chunks = await chunks_col.count_documents({})
    cats: Dict[str, int] = {}
    async for d in files_col.aggregate([{"$group": {"_id": "$category", "n": {"$sum": 1}}}]):
        cats[d["_id"] or "other"] = d["n"]
    last = await jobs_col.find_one({}, {"_id": 0}, sort=[("started_at", -1)])
    last_job = IndexJob(**last) if last else None
    return StatsResp(
        files=files, chunks=chunks, categories=cats, last_job=last_job,
        repo=f"{GITHUB_OWNER}/{GITHUB_REPO}@{GITHUB_BRANCH}",
    )


@api_router.post("/index/sync", response_model=IndexJob)
async def index_sync(bg: BackgroundTasks):
    # Reject if a job is currently running
    running = await jobs_col.find_one({"status": {"$in": ["queued", "running"]}}, {"_id": 0})
    if running:
        return IndexJob(**running)
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "total": 0,
        "message": "Queued",
        "started_at": now_iso(),
        "finished_at": None,
        "files_indexed": 0,
        "chunks_indexed": 0,
    }
    await jobs_col.insert_one(dict(job))
    bg.add_task(run_index_job, job_id)
    return IndexJob(**job)


@api_router.get("/index/job/{job_id}", response_model=IndexJob)
async def index_job(job_id: str):
    j = await jobs_col.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Job not found")
    return IndexJob(**j)


@api_router.get("/search", response_model=SearchResp)
async def search(q: str, category: Optional[str] = None, limit: int = 20):
    if not q or not q.strip():
        return SearchResp(query=q, total=0, hits=[])

    base_filter: Dict[str, Any] = {"$text": {"$search": q}}
    if category and category != "all":
        base_filter["category"] = category

    try:
        cursor = chunks_col.find(
            base_filter,
            {"_id": 0, "score": {"$meta": "textScore"}, "content": 1, "file_id": 1,
             "path": 1, "name": 1, "category": 1, "chunk_index": 1},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)
        results = await cursor.to_list(limit)
    except Exception:
        # Fallback regex search if index not yet built
        regex = re.compile(re.escape(q), re.IGNORECASE)
        f: Dict[str, Any] = {"content": regex}
        if category and category != "all":
            f["category"] = category
        results = await chunks_col.find(f, {"_id": 0}).limit(limit).to_list(limit)
        for r in results:
            r["score"] = 1.0

    hits = [
        SearchHit(
            file_id=r["file_id"],
            path=r["path"],
            name=r["name"],
            category=r.get("category", "other"),
            snippet=make_snippet(r["content"], q),
            score=float(r.get("score", 0.0)),
            chunk_index=r.get("chunk_index", 0),
        )
        for r in results
    ]
    return SearchResp(query=q, total=len(hits), hits=hits)


@api_router.post("/ai/ask", response_model=AskResp)
async def ai_ask(req: AskReq):
    if not req.query or not req.query.strip():
        raise HTTPException(400, "Empty query")
    session_id = req.session_id or str(uuid.uuid4())

    # Retrieve top chunks
    base_filter: Dict[str, Any] = {"$text": {"$search": req.query}}
    if req.category and req.category != "all":
        base_filter["category"] = req.category

    try:
        cursor = chunks_col.find(
            base_filter,
            {"_id": 0, "score": {"$meta": "textScore"}, "content": 1, "file_id": 1,
             "path": 1, "name": 1, "category": 1, "chunk_index": 1},
        ).sort([("score", {"$meta": "textScore"})]).limit(8)
        top = await cursor.to_list(8)
    except Exception:
        top = []

    # Build context
    citations: List[Citation] = []
    context_parts: List[str] = []
    seen_files = set()
    n = 0
    for r in top:
        n += 1
        snippet = r["content"][:1200]
        context_parts.append(f"[{n}] FILE: {r['path']}\n{snippet}")
        citations.append(Citation(
            n=n,
            file_id=r["file_id"],
            path=r["path"],
            name=r["name"],
            snippet=make_snippet(r["content"], req.query, 260),
        ))
        seen_files.add(r["file_id"])

    if not context_parts:
        answer = (
            "I couldn't find anything in the Paneltec Group Portal index matching that query. "
            "Try rephrasing, or run a re-sync from the Dashboard if you expect the content to be there."
        )
        await conv_col.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "query": req.query,
            "answer": answer,
            "created_at": now_iso(),
        })
        return AskResp(answer=answer, citations=[], session_id=session_id, query=req.query)

    system = (
        "You are the Paneltec Group Portal's internal AI search agent. "
        "You answer the user's question using ONLY the provided source excerpts from "
        "Paneltec's internal manuals, apps, code, and docs. "
        "Always cite sources with inline numeric citations in square brackets like [1], [2] "
        "matching the source numbers given. Be concise, factual, and structured. "
        "If the answer is not in the sources, say so plainly and suggest where the user "
        "might look. Never invent facts."
    )
    context = "\n\n".join(context_parts)

    # Multi-turn memory: pull last 3 turns from same session
    history_block = ""
    try:
        prior_cursor = conv_col.find(
            {"session_id": session_id},
            {"_id": 0, "query": 1, "answer": 1, "created_at": 1},
        ).sort("created_at", -1).limit(3)
        prior = await prior_cursor.to_list(3)
        prior = list(reversed(prior))  # chronological
        if prior:
            lines = []
            for p in prior:
                a = (p.get("answer") or "").strip()
                # trim long answers
                if len(a) > 400:
                    a = a[:400] + "…"
                lines.append(f"Q: {p.get('query','')}\nA: {a}")
            history_block = (
                "Previous conversation (most recent last) — use only as context:\n"
                + "\n\n".join(lines)
                + "\n\n"
            )
    except Exception as e:
        logger.warning("History fetch failed: %s", e)

    user_text = (
        f"{history_block}"
        f"Question: {req.query}\n\n"
        f"Sources (cite by number):\n{context}\n\n"
        f"Answer with inline [n] citations."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=user_text)
        answer = await chat.send_message(msg)
        if not isinstance(answer, str):
            answer = str(answer)
    except Exception as e:
        logger.exception("LLM failed")
        answer = f"(AI synthesis unavailable: {e}). Top matches are listed below."

    await conv_col.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "query": req.query,
        "answer": answer,
        "created_at": now_iso(),
    })
    return AskResp(answer=answer, citations=citations, session_id=session_id, query=req.query)


@api_router.get("/files/list", response_model=FileListResp)
async def files_list(category: Optional[str] = None, q: Optional[str] = None, limit: int = 500):
    f: Dict[str, Any] = {}
    if category and category != "all":
        f["category"] = category
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        f["$or"] = [{"name": regex}, {"path": regex}]
    cursor = files_col.find(f, {"_id": 0, "content": 0}).sort("path", 1).limit(limit)
    files = await cursor.to_list(limit)
    return FileListResp(files=[IndexedFile(**d) for d in files], total=len(files))


@api_router.get("/files/{file_id}")
async def files_get(file_id: str):
    d = await files_col.find_one({"id": file_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "File not found")
    return d


# ============================================================================
# PORTAL ACTIONS — natural-language launcher for the Paneltec portal
# ============================================================================
class PortalAction(BaseModel):
    id: str
    path: str  # "/equipment-finance"
    label: str  # human-readable
    description: Optional[str] = ""
    keywords: Optional[List[str]] = []
    source: str = "custom"  # extracted | custom
    source_file_id: Optional[str] = None
    source_path: Optional[str] = None
    created_at: str


class PortalActionCreate(BaseModel):
    path: str
    label: str
    description: Optional[str] = ""
    keywords: Optional[List[str]] = []


class PortalActionUpdate(BaseModel):
    path: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None


class RouteReq(BaseModel):
    query: str
    limit: int = 3


class RouteHit(BaseModel):
    id: str
    path: str
    label: str
    description: str
    confidence: float
    reason: str


class RouteResp(BaseModel):
    query: str
    portal_base_url: str
    hits: List[RouteHit]
    ranking_method: str = "llm"  # "llm" | "keyword" | "none"


class PortalSettings(BaseModel):
    portal_base_url: str = ""
    iframe_origin: str = "*"  # accepted parent origin for postMessage


# --- Settings ---------------------------------------------------------------
async def get_settings_doc() -> Dict[str, Any]:
    d = await settings_col.find_one({"id": "main"}, {"_id": 0})
    if not d:
        d = {"id": "main", "portal_base_url": "", "iframe_origin": "*"}
        await settings_col.insert_one(dict(d))
    return d


@api_router.get("/settings", response_model=PortalSettings)
async def settings_get():
    d = await get_settings_doc()
    return PortalSettings(portal_base_url=d.get("portal_base_url", ""), iframe_origin=d.get("iframe_origin", "*"))


@api_router.post("/settings", response_model=PortalSettings)
async def settings_update(s: PortalSettings):
    base = (s.portal_base_url or "").strip().rstrip("/")
    origin = (s.iframe_origin or "*").strip()
    await settings_col.update_one(
        {"id": "main"},
        {"$set": {"portal_base_url": base, "iframe_origin": origin}},
        upsert=True,
    )
    return PortalSettings(portal_base_url=base, iframe_origin=origin)


# --- Actions extraction -----------------------------------------------------
ROUTE_RE = re.compile(
    r"""<Route\s+[^>]*?path=["']([^"']+)["'][^>]*?element=\{<\s*(\w+)""",
    re.VERBOSE,
)
TESTID_RE = re.compile(r'data-testid=["\']([a-z][a-z0-9-]*?)-page["\']')


def humanize(component: str) -> str:
    # split CamelCase into words
    parts = re.findall(r"[A-Z][a-z0-9]+|[A-Z]+(?=[A-Z])", component)
    return " ".join(parts) if parts else component


GENERIC_COMPS = {
    "ProtectedRoute", "PrivateRoute", "PublicRoute", "Outlet",
    "Layout", "Suspense", "Fragment", "Navigate", "Redirect",
    "RequireAuth", "AuthGuard", "Route",
}


def label_from_path(path: str) -> str:
    p = path.strip("/").split("?")[0]
    if not p:
        return "Home"
    last = p.split("/")[-1]
    last = last.split(":")[0]  # strip route params
    words = re.split(r"[-_]+", last)
    words = [w for w in words if w and not w.startswith(":")]
    if not words:
        return path
    return " ".join(w.capitalize() for w in words)


def pick_label(component: str, path: str) -> str:
    if component in GENERIC_COMPS:
        return label_from_path(path)
    h = humanize(component)
    # If humanized form is short/cryptic, prefer the path-based label
    if len(h) < 3:
        return label_from_path(path)
    return h


def derive_keywords(label: str, path: str) -> List[str]:
    raw = re.split(r"[\s/_\-]+", f"{label} {path}".lower())
    return sorted({w for w in raw if len(w) > 2})


@api_router.post("/actions/extract")
async def actions_extract():
    """Mine the indexed corpus for React Router routes and turn them into actions.

    Atomic-ish: stage new actions under source='extracted_new', then swap in one shot
    so the catalog is never empty during re-extraction.
    """
    cursor = files_col.find(
        {"$or": [
            {"name": {"$regex": "^App\\.jsx?$"}},
            {"name": {"$regex": "Router\\.jsx?$"}},
            {"path": {"$regex": "routes\\.jsx?$"}},
        ]},
        {"_id": 0, "content": 1, "id": 1, "path": 1, "name": 1},
    )
    sources = await cursor.to_list(100)

    found: Dict[str, Dict[str, Any]] = {}
    for src in sources:
        text = src.get("content", "") or ""
        for m in ROUTE_RE.finditer(text):
            path = m.group(1).strip()
            comp = m.group(2).strip()
            if not path or path == "*":
                continue
            label = pick_label(comp, path)
            key = path
            if key in found:
                continue
            found[key] = {
                "id": str(uuid.uuid4()),
                "path": path if path.startswith("/") else f"/{path}",
                "label": label or path,
                "description": f"Open the {label} page in the Paneltec Group Portal.",
                "keywords": derive_keywords(label, path),
                "source": "extracted_new",  # staged
                "source_file_id": src["id"],
                "source_path": src["path"],
                "created_at": now_iso(),
            }

    # Clean any leftover stage from a previous failed run
    try:
        await actions_col.delete_many({"source": "extracted_new"})
    except Exception as e:
        logger.warning("Stage cleanup failed: %s", e)

    inserted_ok = False
    if found:
        try:
            await actions_col.insert_many(list(found.values()))
            inserted_ok = True
        except Exception as e:
            logger.exception("Stage insert failed: %s", e)
            # Drop any partials and bail without touching live catalog
            await actions_col.delete_many({"source": "extracted_new"})
            raise HTTPException(500, f"Action extraction failed: {e}")

    # Swap: delete old 'extracted' then promote 'extracted_new' → 'extracted'
    if inserted_ok or not found:
        try:
            await actions_col.delete_many({"source": "extracted"})
            if inserted_ok:
                await actions_col.update_many(
                    {"source": "extracted_new"},
                    {"$set": {"source": "extracted"}},
                )
        except Exception as e:
            logger.exception("Promotion failed: %s", e)
            raise HTTPException(500, f"Action promotion failed: {e}")

    try:
        await actions_col.create_index(
            [("label", "text"), ("description", "text"), ("path", "text"), ("keywords", "text")]
        )
    except Exception:
        pass

    return {"extracted": len(found), "from_files": len(sources)}


@api_router.get("/actions")
async def actions_list(q: Optional[str] = None, source: Optional[str] = None):
    f: Dict[str, Any] = {}
    if source and source != "all":
        f["source"] = source
    if q:
        regex = re.compile(re.escape(q), re.IGNORECASE)
        f["$or"] = [{"label": regex}, {"path": regex}, {"description": regex}]
    cursor = actions_col.find(f, {"_id": 0}).sort("path", 1).limit(500)
    items = await cursor.to_list(500)
    return {"actions": items, "total": len(items)}


@api_router.post("/actions", response_model=PortalAction)
async def actions_create(a: PortalActionCreate):
    path = a.path if a.path.startswith("/") else f"/{a.path}"
    doc = {
        "id": str(uuid.uuid4()),
        "path": path,
        "label": a.label,
        "description": a.description or "",
        "keywords": a.keywords or derive_keywords(a.label, path),
        "source": "custom",
        "source_file_id": None,
        "source_path": None,
        "created_at": now_iso(),
    }
    await actions_col.insert_one(dict(doc))
    try:
        await actions_col.create_index(
            [("label", "text"), ("description", "text"), ("path", "text"), ("keywords", "text")]
        )
    except Exception:
        pass
    return PortalAction(**doc)


@api_router.put("/actions/{action_id}", response_model=PortalAction)
async def actions_update(action_id: str, u: PortalActionUpdate):
    cur = await actions_col.find_one({"id": action_id}, {"_id": 0})
    if not cur:
        raise HTTPException(404, "Action not found")
    upd = {k: v for k, v in u.model_dump().items() if v is not None}
    if "path" in upd and not upd["path"].startswith("/"):
        upd["path"] = "/" + upd["path"]
    cur.update(upd)
    await actions_col.update_one({"id": action_id}, {"$set": upd})
    return PortalAction(**cur)


@api_router.delete("/actions/{action_id}")
async def actions_delete(action_id: str):
    r = await actions_col.delete_one({"id": action_id})
    return {"deleted": r.deleted_count}


# --- AI Router (natural language → portal deep-link) ------------------------
import json as _json


async def _candidates_for_query(query: str, limit: int = 12) -> List[Dict[str, Any]]:
    # Try text search first
    try:
        cursor = actions_col.find(
            {"$text": {"$search": query}},
            {"_id": 0, "score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)
        results = await cursor.to_list(limit)
        if results:
            return results
    except Exception:
        pass
    # Fallback regex match
    regex = re.compile("|".join(re.escape(t) for t in re.split(r"\W+", query) if len(t) > 1), re.IGNORECASE)
    cursor = actions_col.find(
        {"$or": [{"label": regex}, {"description": regex}, {"path": regex}, {"keywords": regex}]},
        {"_id": 0},
    ).limit(limit)
    return await cursor.to_list(limit)


@api_router.post("/ai/route", response_model=RouteResp)
async def ai_route(req: RouteReq):
    settings = await get_settings_doc()
    base = settings.get("portal_base_url", "")

    if not req.query or not req.query.strip():
        return RouteResp(query=req.query or "", portal_base_url=base, hits=[])

    candidates = await _candidates_for_query(req.query, limit=12)
    if not candidates:
        return RouteResp(query=req.query, portal_base_url=base, hits=[])

    # Build prompt for Claude to rank
    rows = []
    for i, c in enumerate(candidates, start=1):
        rows.append(
            f"{i}. path={c['path']} | label={c['label']} | desc={c.get('description','')}"
        )
    candidate_text = "\n".join(rows)

    system = (
        "You are the Paneltec Group Portal's intent router. Given a user's natural-language "
        "request and a list of candidate portal destinations (deep-links), pick the BEST 1 to 3 "
        "destinations that the user most likely wants to open. "
        "Output strictly valid JSON of the form: "
        '{"hits":[{"n":<int>,"confidence":<0..1>,"reason":"<short why>"}]} '
        "where n is the 1-based index of the candidate above. "
        "If nothing fits well, return {\"hits\": []}. Never invent destinations not in the list."
    )
    user_text = (
        f"User request: {req.query}\n\n"
        f"Candidates:\n{candidate_text}\n\n"
        f"Return JSON now."
    )

    hits: List[RouteHit] = []
    ranking_method = "llm"
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"router-{uuid.uuid4()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        raw = await chat.send_message(UserMessage(text=user_text))
        if not isinstance(raw, str):
            raw = str(raw)
        # Extract JSON object
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            data = _json.loads(m.group(0))
            for h in (data.get("hits") or [])[: req.limit]:
                idx = int(h.get("n", 0)) - 1
                if 0 <= idx < len(candidates):
                    c = candidates[idx]
                    hits.append(RouteHit(
                        id=c["id"],
                        path=c["path"],
                        label=c["label"],
                        description=c.get("description", ""),
                        confidence=float(h.get("confidence", 0.5)),
                        reason=str(h.get("reason", "")),
                    ))
    except Exception as e:
        logger.warning("AI route ranking failed: %s", e)
        ranking_method = "keyword"

    # Fallback: if Claude returned nothing, pick top text-score candidates
    if not hits:
        ranking_method = "keyword"
        for c in candidates[: req.limit]:
            hits.append(RouteHit(
                id=c["id"],
                path=c["path"],
                label=c["label"],
                description=c.get("description", ""),
                confidence=float(c.get("score", 0.5)) / 3.0 if c.get("score") else 0.4,
                reason="keyword match",
            ))

    return RouteResp(
        query=req.query, portal_base_url=base, hits=hits, ranking_method=ranking_method
    )


# --- Mount router & middleware ---------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Ensure text index exists if chunks already there
    try:
        await chunks_col.create_index([("content", "text"), ("name", "text"), ("path", "text")])
    except Exception:
        pass
    try:
        await actions_col.create_index(
            [("label", "text"), ("description", "text"), ("path", "text"), ("keywords", "text")]
        )
    except Exception:
        pass


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
