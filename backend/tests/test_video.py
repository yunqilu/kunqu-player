import pytest
from fastapi.testclient import TestClient

from app import api

PAYLOAD = bytes(range(256)) * 4


@pytest.fixture
def client():
    return TestClient(api.app)


@pytest.fixture
def media_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def video(media_dir):
    path = media_dir / "xunmeng.mp4"
    path.write_bytes(PAYLOAD)
    return path


def test_video_is_served_as_mp4(client, video):
    response = client.get("/api/pieces/xunmeng/video")

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert response.content == PAYLOAD


def test_video_supports_range_requests(client, video):
    response = client.get("/api/pieces/xunmeng/video", headers={"Range": "bytes=100-199"})

    assert response.status_code == 206
    assert response.headers["content-range"] == f"bytes 100-199/{len(PAYLOAD)}"
    assert response.content == PAYLOAD[100:200]


def test_video_answers_head_without_a_body(client, video):
    response = client.head("/api/pieces/xunmeng/video")

    assert response.status_code == 200
    assert response.headers["content-length"] == str(len(PAYLOAD))
    assert response.content == b""


def test_missing_video_is_404_saying_where_to_put_it(client, media_dir):
    response = client.get("/api/pieces/xunmeng/video")

    assert response.status_code == 404
    assert "media/xunmeng.mp4" in response.json()["detail"]


def test_missing_video_head_is_404(client, media_dir):
    assert client.head("/api/pieces/xunmeng/video").status_code == 404


def test_unknown_piece_video_is_404(client, video):
    response = client.get("/api/pieces/mudanting/video")

    assert response.status_code == 404
    assert "mudanting" in response.json()["detail"]


@pytest.mark.parametrize("piece_id", ["..%2F..%2Fxunmeng", "%2E%2E", "..%2Fxunmeng.mp4", "xunmeng.mp4"])
def test_path_traversal_piece_ids_are_404(client, video, piece_id):
    outside = video.parent.parent / "xunmeng.mp4"
    outside.write_bytes(b"outside")

    assert client.get(f"/api/pieces/{piece_id}/video").status_code == 404
