import copy

import pytest

from app.pipeline import build_phrase_model

from . import expected_phrasing as expected


def by_text(result, text):
    matches = [p for p in result["phrases"] if p["text"] == text]
    assert matches, text
    return matches[0]


def test_phrases_match_expected_sections(result):
    phrases = {p["id"]: p for p in result["phrases"]}
    actual = [
        (s["qupai"], s["kind"], [phrases[i]["text"] for i in s["phrase_ids"]])
        for s in result["sections"]
    ]

    assert actual == expected.SECTIONS


def test_phrase_carries_section_fields(result):
    phrase = by_text(result, "那一答可是湖山石边")

    assert (phrase["qupai"], phrase["kind"]) == ("忒忒令", "唱")
    assert phrase["lyric"] == "那一答可是湖山石边"
    assert phrase["index"] == result["phrases"].index(phrase)


def test_variant_characters(result):
    pairs = [
        (v["performed"], v["lyric"]) for p in result["phrases"] for v in p["variants"]
    ]

    assert pairs == expected.VARIANT_PAIRS


def test_transposed_characters_are_variants_not_attached(result):
    phrase = by_text(result, "但觉思情辗转")

    assert phrase["lyric"] == "但觉情思辗转"
    assert [c["src"] for c in phrase["chars"]] == [
        "lyrics", "lyrics", "variant", "variant", "lyrics", "lyrics",
    ]
    assert {v["i"] for v in phrase["variants"]} == {
        c["i"] for c in phrase["chars"] if c["src"] == "variant"
    }


def test_attached_characters_join_expected_phrases(result):
    attached = [
        (c["ch"], p["text"])
        for p in result["phrases"]
        for c in p["chars"]
        if c["src"] == "attached"
    ]

    assert attached == expected.ATTACHED
    assert by_text(result, "在梅树边")["chars"][0]["src"] == "attached"
    assert by_text(result, "啊线儿春甚金钱啊吊转")["chars"][0]["src"] == "attached"


def test_attached_characters_have_evidence(result):
    for text in ("在梅树边", "啊线儿春甚金钱啊吊转"):
        assert any("不在歌词中" in e for e in by_text(result, text)["evidence"])


def test_dropped_lyric_characters_make_phrase_variant(result):
    for char, text in expected.DROPPED_CHARS.items():
        phrase = by_text(result, text)

        assert phrase["status"] == "variant"
        assert any("未唱" in e and char in e for e in phrase["evidence"])
        assert all(c["src"] == "lyrics" for c in phrase["chars"])


def test_omitted_lists_everything_in_lyrics_but_not_performed(result):
    texts = [o["lyric_text"] for o in result["omitted"]]

    assert "明" in texts and "怨" in texts
    assert any(t.startswith("哦") for t in texts)
    douyehuang = [o for o in result["omitted"] if o["qupai"] == "豆叶黄"]
    assert len(douyehuang) == 1
    assert douyehuang[0]["lyric_text"].startswith("他兴心儿紧咽咽")
    assert douyehuang[0]["lyric_text"].endswith("敢是咱梦魂儿厮缠？")
    assert any(t.startswith("我想那书生这些光景") for t in texts)
    assert all(o["reason"] for o in result["omitted"])


def test_statuses(result):
    assert by_text(result, "一径行来")["status"] == "confirmed"
    assert by_text(result, "但觉思情辗转")["status"] == "variant"
    inferred = [p["text"] for p in result["phrases"] if p["status"] == "inferred"]
    assert inferred == expected.TAIL_TEXTS


def test_every_phrase_records_evidence(result):
    for phrase in result["phrases"]:
        assert phrase["evidence"], phrase["text"]


def test_inferred_phrases_have_no_lyric_and_no_invented_qupai(result):
    for phrase in result["phrases"]:
        if phrase["status"] == "inferred":
            assert phrase["lyric"] is None
            assert phrase["qupai"] is None


def test_tail_evidence_reports_measured_pauses(result):
    def pause(phrase):
        for line in phrase["evidence"]:
            if line.startswith("句后停顿"):
                return float(line.split()[1])
        return None

    tail = [p for p in result["phrases"] if p["status"] == "inferred"]
    liao, ne, xiaojie1, xiaojie2, wo = tail[2], tail[5], tail[6], tail[7], tail[10]

    assert pause(liao) == pytest.approx(2.85, abs=0.01)
    assert any("呼吸点" in e for e in liao["evidence"])
    assert any("呼吸点" in e for e in ne["evidence"])
    assert pause(xiaojie1) == pytest.approx(1.46, abs=0.01)
    assert pause(xiaojie2) == pytest.approx(10, abs=0.5)
    assert pause(wo) == pytest.approx(1.64, abs=0.01)
    assert any("呼吸点" in e for e in wo["evidence"])


def test_excluded_character_is_reported_and_absent(result):
    assert len(result["excluded"]) == 1
    gone = result["excluded"][0]
    assert gone["ch"] == "哭？"
    assert gone["s"] == pytest.approx(1367.94, abs=0.01)
    assert gone["e"] > gone["s"]
    assert "用户决定删除" in gone["reason"]
    assert all(c["ch"] != "哭？" for p in result["phrases"] for c in p["chars"])
    liniang = [p for p in result["phrases"] if p["text"] == "丽娘"][0]
    assert any("哭？" in e for e in liniang["evidence"])


def test_stats(result):
    stats = result["stats"]

    assert (stats["source_chars"], stats["chars"], stats["excluded"]) == (427, 426, 1)
    assert stats["phrases"] == len(result["phrases"])
    assert stats["inferred"] == len(expected.TAIL_TEXTS)
    assert stats["confirmed"] + stats["variant"] + stats["inferred"] == stats["phrases"]


def test_meta_is_passed_through(result, inputs):
    assert result["meta"] == inputs["model"]["meta"]


def test_exclude_that_matches_nothing_is_an_error(inputs):
    broken = copy.deepcopy(inputs)
    broken["overrides"]["exclude"][0]["s"] = 1.0

    with pytest.raises(ValueError, match="哭？"):
        build_phrase_model(**broken)


def test_exclude_that_matches_several_is_an_error(inputs):
    broken = copy.deepcopy(inputs)
    line = broken["model"]["lines"][0]
    line["chars"].append(dict(line["chars"][0]))
    broken["overrides"]["exclude"].append({"ch": "一", "s": 58.292, "reason": "x"})

    with pytest.raises(ValueError, match="一"):
        build_phrase_model(**broken)


def test_tail_override_must_cover_tail_exactly(inputs):
    broken = copy.deepcopy(inputs)
    broken["overrides"]["tail"][-1]["text"] = "也则是照孤眠"

    with pytest.raises(ValueError, match="尾段"):
        build_phrase_model(**broken)

    broken = copy.deepcopy(inputs)
    broken["overrides"]["tail"].pop()

    with pytest.raises(ValueError, match="尾段"):
        build_phrase_model(**broken)
