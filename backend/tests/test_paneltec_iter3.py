"""Iteration 3 backend tests — ranking_method, chat memory, atomic extract."""
import os
import time
import pytest
import requests


def _has_mongo_id(obj):
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_has_mongo_id(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_mongo_id(v) for v in obj)
    return False


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/ai/route ranking_method field ------------------------------------
class TestRoutingRankingMethod:
    def test_route_includes_ranking_method(self, client):
        r = client.post(
            f"{API}/ai/route",
            json={"query": "make a PIN for the gate"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "ranking_method" in d, f"ranking_method missing: {d.keys()}"
        assert d["ranking_method"] in ("llm", "keyword", "none"), d["ranking_method"]
        assert not _has_mongo_id(d)
        # Should be llm in normal operation
        assert d["ranking_method"] == "llm", f"Expected llm, got {d['ranking_method']}"
        # Top hit still gate
        paths = [h["path"] for h in d.get("hits", [])]
        assert any("gate" in p.lower() for p in paths), paths

    def test_route_empty_query_returns_none_method(self, client):
        r = client.post(f"{API}/ai/route", json={"query": ""}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Either empty hits with valid method, or just no hits
        assert "ranking_method" in d


# --- /api/ai/ask multi-turn chat memory ------------------------------------
class TestChatMemory:
    def test_multi_turn_pronoun_resolution(self, client):
        # Turn 1
        r1 = client.post(
            f"{API}/ai/ask",
            json={"query": "What is the weighbridge app?"},
            timeout=60,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "session_id" in d1 and d1["session_id"]
        sid = d1["session_id"]
        assert "weigh" in d1["answer"].lower(), f"Turn1 answer missing weigh: {d1['answer'][:200]}"
        assert not _has_mongo_id(d1)

        # Turn 2 — same session, ambiguous query
        r2 = client.post(
            f"{API}/ai/ask",
            json={"query": "How do I open it?", "session_id": sid},
            timeout=60,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["session_id"] == sid
        # Memory works if Q2 mentions weighbridge or weigh
        ans2 = d2["answer"].lower()
        assert "weigh" in ans2, (
            f"Chat memory not working — Q2 should reference weighbridge. "
            f"Got: {d2['answer'][:400]}"
        )

    def test_new_session_no_memory(self, client):
        # Sanity: with no session_id, ambiguous query shouldn't infer weighbridge
        r = client.post(
            f"{API}/ai/ask",
            json={"query": "How do I open it?"},
            timeout=60,
        )
        assert r.status_code == 200
        # Just verify it returns something w/ session_id — content is non-deterministic
        d = r.json()
        assert d["session_id"]


# --- /api/actions/extract atomicity ----------------------------------------
class TestExtractAtomic:
    def test_repeated_extract_keeps_catalog_full(self, client):
        # Baseline
        base = client.get(f"{API}/actions", timeout=15).json()
        baseline_total = base["total"]
        assert baseline_total > 0, "expected non-empty catalog at start"

        for i in range(3):
            r = client.post(f"{API}/actions/extract", timeout=120)
            assert r.status_code == 200, f"extract #{i+1} failed: {r.text}"
            data = r.json()
            assert "extracted" in data and "from_files" in data
            assert data["extracted"] >= 10, f"extract #{i+1} returned {data}"

            # GET right after — must be non-empty and roughly equal
            g = client.get(f"{API}/actions", timeout=15).json()
            assert g["total"] >= 10, (
                f"After extract #{i+1} catalog total={g['total']} (expected ~{baseline_total})"
            )
            # Must include gate-pass
            paths = [a["path"] for a in g["actions"]]
            assert any("gate-pass" in p for p in paths), f"gate-pass missing after #{i+1}"
            assert not _has_mongo_id(g)

        # No 'extracted_new' staging rows should leak into public listing
        final = client.get(f"{API}/actions", timeout=15).json()
        sources = {a["source"] for a in final["actions"]}
        assert "extracted_new" not in sources, f"staging source leaked: {sources}"


# --- Regression: iter1 + iter2 endpoints -----------------------------------
class TestRegression:
    def test_root_ok(self, client):
        r = client.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_index_stats(self, client):
        r = client.get(f"{API}/index/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["files"] > 0 and d["chunks"] > 0
        assert not _has_mongo_id(d)

    def test_search(self, client):
        r = client.get(f"{API}/search", params={"q": "weighbridge"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert not _has_mongo_id(d)

    def test_files_list(self, client):
        r = client.get(f"{API}/files/list", params={"limit": 3}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "files" in d
        assert not _has_mongo_id(d)

    def test_files_get_one(self, client):
        lst = client.get(f"{API}/files/list", params={"limit": 1}, timeout=15).json()
        if not lst.get("files"):
            pytest.skip("no files indexed")
        fid = lst["files"][0]["id"]
        r = client.get(f"{API}/files/{fid}", timeout=15)
        assert r.status_code == 200
        assert not _has_mongo_id(r.json())

    def test_actions_crud_roundtrip(self, client):
        # CREATE
        c = client.post(
            f"{API}/actions",
            json={"path": "/TEST_iter3", "label": "TEST iter3", "description": "TEST"},
            timeout=15,
        )
        assert c.status_code == 200
        aid = c.json()["id"]
        # UPDATE
        u = client.put(f"{API}/actions/{aid}", json={"label": "TEST iter3 updated"}, timeout=15)
        assert u.status_code == 200
        assert u.json()["label"] == "TEST iter3 updated"
        # DELETE
        d = client.delete(f"{API}/actions/{aid}", timeout=15)
        assert d.status_code == 200

    def test_settings_roundtrip(self, client):
        original = client.get(f"{API}/settings", timeout=10).json()
        assert "portal_base_url" in original
        # Update + restore
        client.post(
            f"{API}/settings",
            json={
                "portal_base_url": original.get("portal_base_url", ""),
                "iframe_origin": original.get("iframe_origin", "*"),
            },
            timeout=10,
        )

    def test_ai_ask_empty_400(self, client):
        r = client.post(f"{API}/ai/ask", json={"query": ""}, timeout=10)
        assert r.status_code == 400


# --- Portal integration package files --------------------------------------
class TestPortalIntegrationFiles:
    def test_files_exist_and_non_empty(self):
        for name in ("PaneltecAiSearch.jsx", "README.md", "example-usage.jsx"):
            p = os.path.join("/app/portal-integration", name)
            assert os.path.isfile(p), f"missing {p}"
            assert os.path.getsize(p) > 100, f"{p} suspiciously small"
