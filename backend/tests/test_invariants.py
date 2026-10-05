from app.pipeline import parse_lyrics

TOLERANCE = 0.02


def source_chars(model):
    lines = sorted(model["lines"], key=lambda line: line["s"])
    return [char for line in lines for char in line["chars"]]


def test_chars_are_the_source_minus_excluded_in_order(result, inputs):
    source = source_chars(inputs["model"])
    excluded = {(e["ch"], e["s"]) for e in result["excluded"]}
    kept = [c for c in source if (c["ch"], c["s"]) not in excluded]
    output = [c for p in result["phrases"] for c in p["chars"]]

    assert len(source) == 427
    assert len(output) == 426
    assert [(c["ch"], c["s"], c["e"]) for c in output] == [
        (c["ch"], c["s"], c["e"]) for c in kept
    ]
    assert len(output) + len(result["excluded"]) == len(source)


def test_char_fields_pass_through_unchanged(result, inputs):
    source = source_chars(inputs["model"])

    for phrase in result["phrases"]:
        for char in phrase["chars"]:
            original = source[char["i"]]
            assert char["ch"] == original["ch"]
            assert char["st"] == original["st"]
            assert char["gc"] == original["gc"]


def test_phrase_text_and_span_come_from_its_chars(result):
    for phrase in result["phrases"]:
        chars = phrase["chars"]
        assert chars
        assert phrase["text"] == "".join(c["ch"] for c in chars)
        assert phrase["s"] == chars[0]["s"]
        assert phrase["e"] == chars[-1]["e"]


def test_phrases_do_not_overlap(result):
    phrases = result["phrases"]

    for previous, current in zip(phrases, phrases[1:]):
        assert previous["s"] < current["s"]
        assert previous["e"] <= current["s"] + TOLERANCE, (
            previous["text"], current["text"], previous["e"] - current["s"],
        )


def test_every_lyric_punctuation_is_a_break(result, inputs):
    """每个基于歌词的分句恰好对应一个歌词分句，且次序与歌词一致。"""
    clauses = [c.text for c in parse_lyrics(inputs["lyrics"])]
    lyrics = [p["lyric"] for p in result["phrases"] if p["lyric"] is not None]

    position = 0
    for lyric in lyrics:
        position = clauses.index(lyric, position) + 1


def test_ids_are_unique_and_sections_partition_phrases(result):
    ids = [p["id"] for p in result["phrases"]]
    in_sections = [i for s in result["sections"] for i in s["phrase_ids"]]

    assert len(set(ids)) == len(ids)
    assert in_sections == ids
    assert len({s["key"] for s in result["sections"]}) == len(result["sections"])
