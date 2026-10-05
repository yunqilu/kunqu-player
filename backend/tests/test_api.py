import pytest
from fastapi.testclient import TestClient

from app import api

TOLERANCE = 0.02


@pytest.fixture(scope="module")
def client():
    return TestClient(api.app)


@pytest.fixture(scope="module")
def body(client):
    response = client.get("/api/pieces/xunmeng/phrases")
    assert response.status_code == 200
    return response.json()


def test_pieces_lists_xunmeng(client):
    response = client.get("/api/pieces")

    assert response.status_code == 200
    assert response.json() == [{"id": "xunmeng", "title": "寻梦（牡丹亭）"}]


def test_phrases_match_pipeline_output(body, result):
    assert body == result


def test_phrases_stats_and_first_phrase(body):
    stats = body["stats"]

    assert (stats["source_chars"], stats["chars"], stats["excluded"]) == (427, 426, 1)
    assert body["phrases"][0]["text"] == "一径行来"


def test_phrases_have_all_top_level_parts(body):
    assert set(body) == {
        "meta", "sections", "phrases", "tracks", "omitted", "excluded", "stats",
    }


def test_response_chars_account_for_every_source_char(body):
    indexes = [c["i"] for p in body["phrases"] for c in p["chars"]]

    assert indexes == sorted(indexes)
    assert len(set(indexes)) == len(indexes) == body["stats"]["chars"]
    assert len(indexes) + len(body["excluded"]) == body["stats"]["source_chars"]


def test_response_phrases_do_not_overlap(body):
    phrases = body["phrases"]

    for previous, current in zip(phrases, phrases[1:]):
        assert previous["s"] < current["s"]
        assert previous["e"] <= current["s"] + TOLERANCE


def test_unknown_piece_is_404_with_explanation(client):
    response = client.get("/api/pieces/mudanting/phrases")

    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "mudanting" in detail
    assert "xunmeng" in detail


def test_pipeline_error_is_reported_as_readable_500(client, monkeypatch):
    def broken(piece_id):
        raise ValueError("尾段文字与 overrides 不一致")

    monkeypatch.setattr(api, "phrase_model", broken)
    response = client.get("/api/pieces/xunmeng/phrases")

    assert response.status_code == 500
    assert "尾段文字与 overrides 不一致" in response.json()["detail"]
