import functools
import http.server
import threading
import zipfile

import pytest

from hn_mcp import index


@pytest.fixture
def serve(tmp_path):
    """Serve files from a folder over local HTTP; yields the base URL."""
    root = tmp_path / "www"
    root.mkdir()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield root, f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


def test_pack_and_download_round_trip(tmp_path, monkeypatch, serve):
    www, base = serve
    monkeypatch.setenv("HN_MCP_DATA", str(tmp_path / "src"))
    (index.stories_dir() / "2020-01.parquet").write_bytes(b"month")
    (index.live_dir() / "2026-11-01.parquet").write_bytes(b"day")
    assert index.pack(www / "hn-index.zip") == 2

    monkeypatch.setenv("HN_MCP_DATA", str(tmp_path / "dst"))
    assert index.download_snapshot(f"{base}/hn-index.zip", log=lambda _: None) == 2
    assert (index.stories_dir() / "2020-01.parquet").read_bytes() == b"month"
    assert (index.live_dir() / "2026-11-01.parquet").read_bytes() == b"day"
    assert not (index.data_dir() / "snapshot.zip.part").exists()


def test_download_rejects_paths_outside_data_dir(tmp_path, monkeypatch, serve):
    www, base = serve
    with zipfile.ZipFile(www / "evil.zip", "w") as zf:
        zf.writestr("stories/../../evil.parquet", b"x")
    monkeypatch.setenv("HN_MCP_DATA", str(tmp_path / "dst"))
    with pytest.raises(ValueError, match="Unsafe path"):
        index.download_snapshot(f"{base}/evil.zip", log=lambda _: None)
    assert not (tmp_path / "evil.parquet").exists()
