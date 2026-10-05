import pytest

from app.pipeline import attach_tracks


def phrase(s, e):
    return {"s": s, "e": e}


def model(**overrides):
    base = {
        "breaths": [],
        "tracks": [
            {"name": "腔格轨", "blocks": [], "points": []},
            {"name": "临时腔格轨", "blocks": [], "points": []},
            {"name": "动作", "blocks": [], "points": []},
            {"name": "临时动作轨", "blocks": [], "points": []},
        ],
    }
    for name, content in overrides.items():
        if name == "breaths":
            base["breaths"] = content
        else:
            track = next(t for t in base["tracks"] if t["name"] == name)
            track.update(content)
    return base


def test_block_spanning_two_phrases_is_clipped_and_flagged():
    phrases = [phrase(0, 10), phrase(12, 20)]
    attach_tracks(phrases, model(腔格轨={"blocks": [{"s": 8, "e": 15, "t": "擞腔"}]}))

    assert phrases[0]["qiangge"] == [
        {"t": "擞腔", "s": 8, "e": 15, "cs": 8, "ce": 10, "cont_prev": False, "cont_next": True}
    ]
    assert phrases[1]["qiangge"] == [
        {"t": "擞腔", "s": 8, "e": 15, "cs": 12, "ce": 15, "cont_prev": True, "cont_next": False}
    ]


def test_block_touching_phrase_end_does_not_leak_into_next():
    phrases = [phrase(0, 10), phrase(10, 20)]
    attach_tracks(phrases, model(腔格轨={"blocks": [{"s": 5, "e": 10, "t": "豁腔"}]}))

    assert len(phrases[0]["qiangge"]) == 1
    assert phrases[1]["qiangge"] == []


def test_action_blocks_from_provisional_track_are_marked():
    phrases = [phrase(0, 10)]
    attach_tracks(phrases, model(
        动作={"blocks": [{"s": 1, "e": 2, "t": "指"}]},
        临时动作轨={"blocks": [{"s": 3, "e": 4, "t": "换边"}]},
    ))

    assert [(a["t"], a["provisional"]) for a in phrases[0]["actions"]] == [
        ("指", False), ("换边", True),
    ]


def test_points_come_from_action_and_provisional_qiangge_tracks():
    phrases = [phrase(0, 10), phrase(12, 20)]
    attach_tracks(phrases, model(
        动作={"points": [{"t": 13, "l": "点头", "tk": "打点轨 1"}]},
        临时腔格轨={"points": [{"t": 5, "l": "打音", "tk": "打点轨 1"}]},
    ))

    assert phrases[0]["points"] == [{"t": 5, "l": "打音", "tk": "打点轨 1", "provisional": True}]
    assert phrases[1]["points"] == [{"t": 13, "l": "点头", "tk": "打点轨 1", "provisional": False}]


def test_breath_in_gap_belongs_to_previous_phrase():
    phrases = [phrase(0, 10), phrase(12, 20)]
    breaths = [{"t": 10, "l": "", "tk": "a"}, {"t": 11, "l": "", "tk": "b"}, {"t": 12, "l": "", "tk": "c"}]
    attach_tracks(phrases, model(breaths=breaths))

    assert [b["tk"] for b in phrases[0]["breaths"]] == ["a", "b"]
    assert [b["tk"] for b in phrases[1]["breaths"]] == ["c"]


def test_breath_on_shared_boundary_belongs_to_previous_phrase():
    phrases = [phrase(0, 10), phrase(10, 20)]
    attach_tracks(phrases, model(breaths=[{"t": 10, "l": "", "tk": "a"}]))

    assert len(phrases[0]["breaths"]) == 1
    assert phrases[1]["breaths"] == []


def test_breath_before_first_phrase_belongs_to_first_phrase():
    phrases = [phrase(5, 10)]
    attach_tracks(phrases, model(breaths=[{"t": 1, "l": "", "tk": "a"}]))

    assert len(phrases[0]["breaths"]) == 1


# ── 真实数据 ─────────────────────────────────────────────────────────────────


def distinct(result, key):
    return {(x["t"], x.get("s"), x.get("e")) for p in result["phrases"] for x in p[key]}


def test_every_qiangge_block_is_assigned(result, inputs):
    track = next(t for t in inputs["model"]["tracks"] if t["name"] == "腔格轨")

    assert len(track["blocks"]) == 106
    assert distinct(result, "qiangge") == {(b["t"], b["s"], b["e"]) for b in track["blocks"]}


def test_every_action_block_is_assigned(result):
    actions = [a for p in result["phrases"] for a in p["actions"]]

    assert len(distinct(result, "actions")) == 8
    assert {a["t"] for a in actions if a["provisional"]} == {"换边", "扇花"}


def test_every_point_and_breath_is_assigned_exactly_once(result, inputs):
    points = [x for p in result["phrases"] for x in p["points"]]
    breaths = [x for p in result["phrases"] for x in p["breaths"]]

    assert len(points) == 7
    assert sorted(x["l"] for x in points if x["provisional"]) == ["打音"] * 3
    assert len(breaths) == len(inputs["model"]["breaths"]) == 309


def test_breaths_sit_in_their_phrase_or_the_gap_after_it(result):
    phrases = result["phrases"]

    for phrase, following in zip(phrases, phrases[1:] + [None]):
        limit = following["s"] if following else float("inf")
        for breath in phrase["breaths"]:
            assert breath["t"] < limit or breath["t"] <= phrase["e"]
            assert breath["t"] >= phrase["s"] or phrase["index"] == 0


def test_clipped_times_stay_inside_the_phrase(result):
    for phrase in result["phrases"]:
        for item in phrase["qiangge"] + phrase["actions"]:
            assert phrase["s"] <= item["cs"] < item["ce"] <= phrase["e"]
            if item["s"] >= phrase["s"]:
                assert not item["cont_prev"]
            if item["e"] <= phrase["e"]:
                assert not item["cont_next"]


def test_continuation_flags_pair_up_across_phrases(result):
    phrases = result["phrases"]

    for phrase, following in zip(phrases, phrases[1:]):
        for key in ("qiangge", "actions"):
            leaving = {(x["t"], x["s"], x["e"]) for x in phrase[key] if x["cont_next"]}
            arriving = {(x["t"], x["s"], x["e"]) for x in following[key] if x["cont_prev"]}
            assert leaving == arriving


def test_souqiang_block_under_hushan_phrase_keeps_original_start(result):
    phrase = next(p for p in result["phrases"] if p["text"] == "那一答可是湖山石边")
    starts = [q["s"] for q in phrase["qiangge"] if q["t"] == "擞腔"]

    assert any(s == pytest.approx(114.4, abs=0.05) for s in starts)


def test_tracks_follow_viewer_filter(result):
    assert [t["name"] for t in result["tracks"]] == ["腔格轨", "动作"]
    for track in result["tracks"]:
        assert all("点状腔格" not in p["tk"] for p in track["points"])
