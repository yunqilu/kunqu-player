from pathlib import Path

from app.pipeline import PUNCTUATION, parse_lyrics

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
LYRICS = (RAW / "xunmeng-lyrics.txt").read_text(encoding="utf-8")


def clause_tuples(text):
    return [(c.text, c.qupai, c.kind, c.punct) for c in parse_lyrics(text)]


def test_role_marker_right_after_qupai_keeps_singing():
    assert clause_tuples("【甲】（旦）一二，三四。") == [
        ("一二", "甲", "唱", "，"),
        ("三四", "甲", "唱", "。"),
    ]


def test_role_marker_elsewhere_starts_speech_without_qupai():
    assert clause_tuples("【甲】一二。（旦）三四！【乙】五六") == [
        ("一二", "甲", "唱", "。"),
        ("三四", None, "白", "！"),
        ("五六", "乙", "唱", ""),
    ]


def test_stage_direction_breaks_clause_and_is_dropped():
    assert clause_tuples("（旦）秀才，秀才（望介）呀，无人") == [
        ("秀才", None, "白", "，"),
        ("秀才", None, "白", ""),
        ("呀", None, "白", "，"),
        ("无人", None, "白", ""),
    ]


def test_whitespace_including_fullwidth_is_ignored():
    assert clause_tuples("【甲】一 二。　【乙】三\n") == [
        ("一二", "甲", "唱", "。"),
        ("三", "乙", "唱", ""),
    ]


def test_xunmeng_opening_and_first_speech():
    clauses = clause_tuples(LYRICS)

    assert clauses[:3] == [
        ("一径行来", "懒画眉", "唱", "，"),
        ("但觉情思辗转", "懒画眉", "唱", "，"),
        ("园内风物依然", "懒画眉", "唱", "。"),
    ]
    assert ("昨日梦里", None, "白", "，") in clauses
    assert ("偶然间心似缱", "江儿水", "唱", "，") in clauses


def test_xunmeng_clauses_contain_only_lyric_characters():
    forbidden = set(PUNCTUATION) | set("【】（）") | {" ", "　", "\n"}

    for clause in parse_lyrics(LYRICS):
        assert clause.text
        assert not forbidden & set(clause.text), clause.text


def test_every_punctuation_mark_ends_a_clause():
    marks = [ch for ch in LYRICS if ch in PUNCTUATION]
    ended = [c.punct for c in parse_lyrics(LYRICS) if c.punct]

    assert ended == marks
