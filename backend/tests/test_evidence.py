"""依据的结构化形式：evidence_items 与中文的 evidence 一一对应，前端据此显示英文。"""

import json
import re
from pathlib import Path

import pytest

from app.evidence import TEMPLATES_ZH, render

REPO = Path(__file__).resolve().parents[2]
HAN = re.compile(r"[㐀-鿿]")
QUOTED = re.compile(r'"[^"]*"')  # 英文说明里引用的唱词保持中文
TEMPLATE = re.compile(r"^\s*'evidence\.(\w+)': '(.*)',\s*$", re.MULTILINE)


def templates(lang: str) -> dict[str, str]:
    source = (REPO / "src" / "i18n" / f"{lang}.js").read_text(encoding="utf-8")
    return dict(TEMPLATE.findall(source))


def fill(template: str, params: dict[str, str]) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: params[m.group(1)], template)


def items_of(result):
    return [item for p in result["phrases"] for item in p["evidence_items"]]


def test_items_match_the_chinese_evidence_line_by_line(result):
    for phrase in result["phrases"]:
        assert [render(item) for item in phrase["evidence_items"]] == phrase["evidence"], phrase["text"]


def test_every_phrase_has_as_many_items_as_evidence_lines(result):
    for phrase in result["phrases"]:
        assert len(phrase["evidence_items"]) == len(phrase["evidence"]) > 0, phrase["text"]


def test_params_are_strings_ready_to_display(result):
    for item in items_of(result):
        assert set(item) == {"code", "params"}
        assert all(isinstance(v, str) for v in item["params"].values()), item


def test_every_code_has_a_template_in_both_languages():
    assert set(templates("zh")) == set(templates("en")) == set(TEMPLATES_ZH)


def test_piece_uses_only_known_codes(result):
    assert {item["code"] for item in items_of(result)} <= set(TEMPLATES_ZH)


def test_frontend_chinese_templates_reproduce_the_backend_text(result):
    zh = templates("zh")
    for phrase in result["phrases"]:
        shown = [fill(zh[item["code"]], item["params"]) for item in phrase["evidence_items"]]
        assert shown == phrase["evidence"], phrase["text"]


def test_english_templates_can_be_filled_for_every_item(result):
    en = templates("en")
    for item in items_of(result):
        text = fill(en[item["code"]], item["params"])  # 缺参数会 KeyError
        assert not HAN.search(QUOTED.sub("", text)), text


@pytest.mark.parametrize("code", ["lyric_punct", "variant", "dropped", "override_note", "gap", "breath", "gap_excluded"])
def test_piece_exercises_the_main_codes(result, code):
    assert any(item["code"] == code for item in items_of(result))


def test_attached_characters_are_explained_by_an_attached_code(result):
    attached = [item for item in items_of(result) if item["code"].startswith("attached_")]

    assert len(attached) == sum(c["src"] == "attached" for p in result["phrases"] for c in p["chars"]) == 3


def test_override_notes_carry_both_languages(result):
    for phrase in result["phrases"]:
        if phrase["status"] != "inferred":
            continue
        note = phrase["evidence_items"][0]
        assert note["code"] == "override_note"
        assert HAN.search(note["params"]["zh"])
        assert note["params"]["en"].strip()
        assert not HAN.search(QUOTED.sub("", note["params"]["en"])), note["params"]["en"]


def test_overrides_file_has_english_beside_every_note_and_reason():
    overrides = json.loads((REPO / "data/review/phrasing-overrides.json").read_text(encoding="utf-8"))

    for entry in overrides["tail"]:
        assert entry["note"] and entry["note_en"].strip(), entry["text"]
    for rule in overrides["exclude"]:
        assert rule["reason"] and rule["reason_en"].strip(), rule["ch"]


def test_excluded_characters_carry_an_english_reason(result):
    for gone in result["excluded"]:
        assert gone["reason_en"].strip()
        assert not HAN.search(QUOTED.sub("", gone["reason_en"]))


def test_missing_english_note_is_an_error_not_a_silent_gap(inputs):
    from app.pipeline import build_phrase_model

    overrides = json.loads(json.dumps(inputs["overrides"]))
    del overrides["tail"][0]["note_en"]

    with pytest.raises(ValueError, match="note_en"):
        build_phrase_model(**{**inputs, "overrides": overrides})
