from fastapi.testclient import TestClient

from backend.app import main


def test_serves_built_frontend_without_shadowing_api(tmp_path, monkeypatch):
    (tmp_path / "frontend" / "dist").mkdir(parents=True)
    (tmp_path / "frontend" / "dist" / "index.html").write_text("<html>kitchen</html>")
    monkeypatch.setattr(main, "ROOT", tmp_path)
    with TestClient(main.create_app(tmp_path / "t.sqlite3")) as client:  # mount happens at startup
        assert "kitchen" in client.get("/").text
        r = client.get("/.well-known/agent-commerce.json")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/json")
