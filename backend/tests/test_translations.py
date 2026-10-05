"""逐句英文翻译：键是「演出文字#第几次出现」，不是会随断句变化的分句 id。"""

import json
import re
from collections import Counter
from pathlib import Path

import pytest

from app.pipeline import build_phrase_model
from app.translations import phrase_keys

REPO = Path(__file__).resolve().parents[2]
PATH = REPO / "data" / "translations" / "xunmeng.en.json"
HAN = re.compile(r"[㐀-鿿]")
MAX_CHARS = 70


@pytest.fixture(scope="module")
def data():
    return json.loads(PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def entries(data):
    return data["entries"]


def test_file_names_its_piece_and_language(data):
    assert (data["piece"], data["lang"]) == ("xunmeng", "en")


def test_keys_count_repeated_text_in_performance_order():
    phrases = [{"text": t} for t in ["秀才", "秀才", "呀", "小姐", "呀"]]

    assert phrase_keys(phrases) == ["秀才#1", "秀才#2", "呀#1", "小姐#1", "呀#2"]


def test_every_phrase_has_exactly_one_translation_and_nothing_is_left_over(result, entries):
    """断句结果变了的话在这里失败，并列出缺了哪些键、多了哪些键。"""
    wanted = phrase_keys(result["phrases"])
    have = [e["key"] for e in entries]
    duplicated = sorted(k for k, n in Counter(have).items() if n > 1)
    missing = [k for k in wanted if k not in set(have)]
    extra = [k for k in have if k not in set(wanted)]

    assert (missing, extra, duplicated) == ([], [], []), f"缺少 {missing}；多余 {extra}；重复 {duplicated}"


def test_entries_follow_performance_order(result, entries):
    assert [e["key"] for e in entries] == phrase_keys(result["phrases"])


def test_zh_matches_the_text_in_the_key(entries):
    for entry in entries:
        text, _, nth = entry["key"].rpartition("#")
        assert entry["zh"] == text and nth.isdigit() and int(nth) >= 1, entry["key"]


def test_translations_are_non_empty_english_of_subtitle_length(entries):
    for entry in entries:
        en = entry["en"]
        assert en.strip() == en and en, entry["key"]
        assert not HAN.search(en), entry["key"]
        assert len(en) <= MAX_CHARS, f"{entry['key']}: {len(en)} 个字符"


def test_status_and_note_have_the_expected_shape(entries):
    for entry in entries:
        assert set(entry) == {"key", "zh", "en", "status", "note"}, entry["key"]
        assert entry["status"] in {"draft", "reviewed"}, entry["key"]
        assert entry["note"] is None or entry["note"].strip(), entry["key"]


def test_phrases_carry_their_translation_and_its_status(result, entries):
    by_key = {e["key"]: e for e in entries}

    for key, phrase in zip(phrase_keys(result["phrases"]), result["phrases"]):
        assert phrase["en"] == by_key[key]["en"], key
        assert phrase["en_status"] == by_key[key]["status"], key
        assert phrase["en_note"] == by_key[key]["note"], key


def test_repeated_text_gets_its_own_translation_each_time(result):
    xiaojie = [p for p in result["phrases"] if p["text"] == "小姐"]

    assert len(xiaojie) == 3
    assert all(p["en"] for p in xiaojie)


def test_stats_count_translated_and_reviewed(result, entries):
    stats = result["stats"]

    assert stats["translated"] == stats["phrases"] == len(entries)
    assert stats["reviewed"] == sum(e["status"] == "reviewed" for e in entries)


def test_a_phrase_without_a_translation_is_left_empty_not_guessed(inputs):
    translations = json.loads(json.dumps(inputs["translations"]))
    removed = translations["entries"].pop(0)

    built = build_phrase_model(**{**inputs, "translations": translations})

    first = built["phrases"][0]
    assert first["text"] == removed["zh"]
    assert (first["en"], first["en_status"], first["en_note"]) == (None, None, None)
    assert built["stats"]["translated"] == built["stats"]["phrases"] - 1


def test_translation_whose_zh_disagrees_with_its_key_is_an_error(inputs):
    translations = json.loads(json.dumps(inputs["translations"]))
    translations["entries"][0]["zh"] = "别的字"

    with pytest.raises(ValueError, match="zh"):
        build_phrase_model(**{**inputs, "translations": translations})
