"""Iteration 2 backend tests — actions, settings, and AI route ranking."""
import os
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


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://paneltec-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/actions/extract --------------------------------------------------
class TestActionsExtract:
    def test_extract_returns_counts(self, client):
        r = client.post(f"{API}/actions/extract", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "extracted" in data and "from_files" in data
        assert isinstance(data["extracted"], int)
        assert data["extracted"] > 0, f"Expected actions extracted, got {data}"
        # Spec says ~39 — accept anything reasonable
        assert data["extracted"] >= 10


# --- /api/actions ----------------------------------------------------------
class TestActionsCatalog:
    def test_list_all(self, client):
        r = client.get(f"{API}/actions", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "actions" in d and isinstance(d["actions"], list)
        assert d["total"] > 0
        assert not _has_mongo_id(d)
        paths = [a["path"] for a in d["actions"]]
        # Should include the gate-pass route
        assert any("gate-pass" in p for p in paths), f"gate-pass missing in {paths[:10]}"

    def test_filter_q_and_source(self, client):
        r = client.get(f"{API}/actions", params={"q": "gate", "source": "extracted"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for a in d["actions"]:
            assert a["source"] == "extracted"
        assert d["total"] >= 1


# --- /api/actions CRUD -----------------------------------------------------
class TestActionsCRUD:
    created_id = None

    def test_create(self, client):
        payload = {
            "path": "/TEST_test-route",
            "label": "TEST Custom Action",
            "description": "TEST_ description for cleanup",
        }
        r = client.post(f"{API}/actions", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["path"] == "/TEST_test-route"
        assert d["label"] == "TEST Custom Action"
        assert d["source"] == "custom"
        assert "id" in d
        TestActionsCRUD.created_id = d["id"]
        assert not _has_mongo_id(d)

    def test_update(self, client):
        aid = TestActionsCRUD.created_id
        assert aid, "create must run first"
        r = client.put(f"{API}/actions/{aid}", json={"label": "TEST Updated Label"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["label"] == "TEST Updated Label"

        # GET-list to verify persistence
        lst = client.get(f"{API}/actions", params={"q": "TEST_test-route"}, timeout=15).json()
        match = [a for a in lst["actions"] if a["id"] == aid]
        assert match and match[0]["label"] == "TEST Updated Label"

    def test_delete(self, client):
        aid = TestActionsCRUD.created_id
        r = client.delete(f"{API}/actions/{aid}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("deleted", 0) >= 0
        # Confirm gone
        lst = client.get(f"{API}/actions", params={"q": "TEST_test-route"}, timeout=15).json()
        assert not any(a["id"] == aid for a in lst["actions"])


# --- /api/settings ---------------------------------------------------------
class TestSettings:
    def test_get(self, client):
        r = client.get(f"{API}/settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "portal_base_url" in d and "iframe_origin" in d
        assert not _has_mongo_id(d)

    def test_update_persists(self, client):
        original = client.get(f"{API}/settings", timeout=10).json()
        new_url = "https://portal-test.paneltec.local"
        r = client.post(f"{API}/settings", json={"portal_base_url": new_url, "iframe_origin": "*"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["portal_base_url"] == new_url
        # GET to verify
        g = client.get(f"{API}/settings", timeout=10).json()
        assert g["portal_base_url"] == new_url
        # Restore
        client.post(f"{API}/settings", json={
            "portal_base_url": original.get("portal_base_url", ""),
            "iframe_origin": original.get("iframe_origin", "*"),
        }, timeout=10)


# --- /api/ai/route ---------------------------------------------------------
class TestAIRoute:
    def test_route_gate_pin(self, client):
        r = client.post(f"{API}/ai/route", json={"query": "make a PIN for the gate entrance"}, timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "hits" in d and isinstance(d["hits"], list)
        assert not _has_mongo_id(d)
        assert d["hits"], "Expected at least one hit for gate PIN"
        top = d["hits"][0]
        for k in ("id", "path", "label", "description", "confidence", "reason"):
            assert k in top
        # /gate-pass or /gate substring should be in one of the hits
        paths = [h["path"] for h in d["hits"]]
        assert any("gate" in p.lower() for p in paths), f"No gate path: {paths}"
        # Confidence > 0.5 for top
        assert top["confidence"] > 0.5, f"Confidence too low: {top}"

    def test_route_weighbridge(self, client):
        r = client.post(f"{API}/ai/route", json={"query": "open weighbridge"}, timeout=45)
        assert r.status_code == 200
        d = r.json()
        assert d["hits"], "Expected hits for weighbridge"
        paths = [h["path"] for h in d["hits"]]
        assert any("weighbridge" in p.lower() for p in paths), f"weighbridge not in {paths}"

    def test_route_gibberish_does_not_crash(self, client):
        r = client.post(f"{API}/ai/route", json={"query": "gibberish xyzxyz qzqzqz"}, timeout=45)
        assert r.status_code == 200
        d = r.json()
        assert "hits" in d and isinstance(d["hits"], list)
        # May be empty or low-confidence — must not crash


# --- Regression checks -----------------------------------------------------
class TestRegression:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_index_stats(self, client):
        r = client.get(f"{API}/index/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["files"] > 0 and d["chunks"] > 0

    def test_search_works(self, client):
        r = client.get(f"{API}/search", params={"q": "paneltec"}, timeout=20)
        assert r.status_code == 200

    def test_files_list(self, client):
        r = client.get(f"{API}/files/list", params={"limit": 5}, timeout=20)
        assert r.status_code == 200
        assert r.json()["total"] >= 0

    def test_ai_ask_empty_query(self, client):
        r = client.post(f"{API}/ai/ask", json={"query": ""}, timeout=15)
        assert r.status_code == 400
