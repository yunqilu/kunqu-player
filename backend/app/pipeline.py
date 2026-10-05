"""断句 pipeline：歌词分句 → 与演唱逐字数据对齐 → 输出带状态和依据的分句。

纯函数，不读网络；输入是播放投影 (viewerModel.json)、歌词文本和人工 overrides。
任何推定都要在 status / evidence 里可见，不冒充事实。
"""

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

PUNCTUATION = "，。！？；、："

_TOKEN = re.compile(r"【([^】]*)】|（([^）]*)）|([%s])|(\S)" % PUNCTUATION)


@dataclass(frozen=True)
class Clause:
    text: str
    qupai: str | None
    kind: str  # 唱 | 白
    punct: str  # 结束这一句的标点；由曲牌、角色标记或舞台提示结束时为空


def parse_lyrics(text: str) -> list[Clause]:
    clauses: list[Clause] = []
    buffer: list[str] = []
    qupai: str | None = None
    kind = "唱"
    after_qupai = False

    def flush(punct: str = "") -> None:
        if buffer:
            clauses.append(Clause("".join(buffer), qupai, kind, punct))
            buffer.clear()

    for match in _TOKEN.finditer(text):
        new_qupai, paren, punct, char = match.groups()
        if new_qupai is not None:
            flush()
            qupai, kind = new_qupai, "唱"
        elif paren is not None:
            flush()
            # 以「介」结尾的是舞台提示；其余是角色标记
            if not paren.endswith("介") and not after_qupai:
                qupai, kind = None, "白"
        elif punct is not None:
            flush(punct)
        else:
            buffer.append(char)
        after_qupai = new_qupai is not None
    flush()
    return clauses


# ── 输入 ─────────────────────────────────────────────────────────────────────

REPO = Path(__file__).resolve().parents[2]

PIECES = {
    "xunmeng": {
        "model": "src/data/viewerModel.json",
        "lyrics": "data/raw/xunmeng-lyrics.txt",
        "overrides": "data/review/phrasing-overrides.json",
    },
}


def load_inputs(piece_id: str) -> dict:
    paths = PIECES[piece_id]
    return {
        "model": json.loads((REPO / paths["model"]).read_text(encoding="utf-8")),
        "lyrics": (REPO / paths["lyrics"]).read_text(encoding="utf-8"),
        "overrides": json.loads((REPO / paths["overrides"]).read_text(encoding="utf-8")),
    }


# ── 逐字序列与排除 ───────────────────────────────────────────────────────────

EXCLUDE_TOLERANCE = 0.01


def flatten_chars(model: dict) -> list[dict]:
    """所有 lines 按时间排序后展开；i 是字在原始序列里的序号。"""
    chars: list[dict] = []
    for line in sorted(model["lines"], key=lambda line: line["s"]):
        for char in line["chars"]:
            chars.append({**char, "i": len(chars), "line_id": line["id"]})
    return chars


def apply_excludes(chars: list[dict], excludes: list[dict]) -> tuple[list[dict], list[dict]]:
    removed: dict[int, dict] = {}
    for rule in excludes:
        hits = [
            c for c in chars
            if c["ch"] == rule["ch"] and abs(c["s"] - rule["s"]) <= EXCLUDE_TOLERANCE
        ]
        if len(hits) != 1:
            raise ValueError(
                f"exclude 「{rule['ch']}」@{rule['s']} 应恰好定位到 1 个字，实际 {len(hits)} 个"
            )
        hit = hits[0]
        removed[hit["i"]] = {
            "ch": hit["ch"], "s": hit["s"], "e": hit["e"], "reason": rule["reason"],
        }
    kept = [c for c in chars if c["i"] not in removed]
    return kept, [removed[i] for i in sorted(removed)]


# ── 对齐 ─────────────────────────────────────────────────────────────────────

SWAP_MAX = 4


@dataclass
class Alignment:
    clause: list[int | None]  # 每个演唱字归属的歌词分句
    src: list[str | None]  # lyrics | variant | attached
    lyric: list[str | None]  # variant 字对应的歌词字
    notes: dict[int, str] = field(default_factory=dict)  # attached 字的归句依据
    dropped: dict[int, list[str]] = field(default_factory=dict)  # 分句 → 没唱的歌词字
    tail_start: int = 0  # 歌词覆盖不到的尾段从这里开始


def _merge_transpositions(ops: list[tuple], performed: str, lyric: str) -> list[tuple]:
    """「思情 / 情思」这类换位，difflib 给出 删+同+插；合并成等长的 replace。"""
    merged: list[tuple] = []
    k = 0
    while k < len(ops):
        if k + 2 < len(ops):
            (t1, i1, _, j1, _), (t2, *_), (t3, _, i2, _, j2) = ops[k], ops[k + 1], ops[k + 2]
            if (
                {t1, t3} == {"delete", "insert"}
                and t2 == "equal"
                and i2 - i1 == j2 - j1 <= SWAP_MAX
                and sorted(performed[i1:i2]) == sorted(lyric[j1:j2])
            ):
                merged.append(("replace", i1, i2, j1, j2))
                k += 3
                continue
        merged.append(ops[k])
        k += 1
    return merged


def align(chars: list[dict], clauses: list[Clause]) -> Alignment:
    performed = "".join(c["ch"][0] for c in chars)
    lyric = "".join(c.text for c in clauses)
    owner = [k for k, c in enumerate(clauses) for _ in c.text]

    result = Alignment([None] * len(chars), [None] * len(chars), [None] * len(chars))
    ops = SequenceMatcher(None, performed, lyric, autojunk=False).get_opcodes()
    last_aligned = -1
    for tag, i1, i2, j1, j2 in _merge_transpositions(ops, performed, lyric):
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for i, j in zip(range(i1, i2), range(j1, j2)):
                result.clause[i] = owner[j]
                if performed[i] == lyric[j]:
                    result.src[i] = "lyrics"
                else:
                    result.src[i], result.lyric[i] = "variant", lyric[j]
            last_aligned = i2 - 1
        else:
            for j in range(j1, j2):
                result.dropped.setdefault(owner[j], []).append(lyric[j])
    result.tail_start = last_aligned + 1

    aligned = list(result.clause)
    for i in range(result.tail_start):
        if aligned[i] is None:
            result.clause[i], result.notes[i] = _attach(i, chars, aligned)
            result.src[i] = "attached"
    return result


def _attach(i: int, chars: list[dict], aligned: list[int | None]) -> tuple[int, str]:
    """歌词范围内对不上的字（如衬字）归到前一句还是后一句。"""
    x = chars[i]
    p = next((k for k in range(i - 1, -1, -1) if aligned[k] is not None), None)
    n = next(k for k in range(i + 1, len(chars)) if aligned[k] is not None)
    label = f"「{x['ch']}」不在歌词中"
    if p is None:
        return aligned[n], f"{label}，其前没有已对齐的字，归入后一句"
    if aligned[p] == aligned[n]:
        return aligned[p], f"{label}，前后的字同属本句"

    same_prev = x["line_id"] == chars[p]["line_id"]
    same_next = x["line_id"] == chars[n]["line_id"]
    if same_next and not same_prev:
        return aligned[n], f"{label}，原数据中与后字「{chars[n]['ch']}」同属 {x['line_id']}，归入后一句"
    if same_prev and not same_next:
        return aligned[p], f"{label}，原数据中与前字「{chars[p]['ch']}」同属 {x['line_id']}，归入前一句"

    before, after = x["s"] - chars[p]["e"], chars[n]["s"] - x["e"]
    gaps = f"距前字 {before:.2f} 秒、距后字 {after:.2f} 秒"
    if after < before:
        return aligned[n], f"{label}，{gaps}，归入后一句"
    return aligned[p], f"{label}，{gaps}，归入前一句"


# ── 分句 ─────────────────────────────────────────────────────────────────────


def _phrase(chars: list[dict], src: list[str], **fields) -> dict:
    return {
        **fields,
        "text": "".join(c["ch"] for c in chars),
        "s": chars[0]["s"],
        "e": chars[-1]["e"],
        "chars": [
            {"i": c["i"], "ch": c["ch"], "s": c["s"], "e": c["e"], "st": c["st"],
             "src": s, "gc": c["gc"]}
            for c, s in zip(chars, src)
        ],
    }


def lyric_phrases(chars: list[dict], clauses: list[Clause], alignment: Alignment) -> list[dict]:
    members: dict[int, list[int]] = {}
    previous = -1
    for i in range(alignment.tail_start):
        k = alignment.clause[i]
        if k < previous:
            raise ValueError(f"对齐结果不单调：「{chars[i]['ch']}」@{chars[i]['s']}")
        previous = k
        members.setdefault(k, []).append(i)

    phrases = []
    for k, indexes in members.items():
        clause = clauses[k]
        variants = [
            {"i": chars[i]["i"], "performed": chars[i]["ch"], "lyric": alignment.lyric[i]}
            for i in indexes if alignment.src[i] == "variant"
        ]
        dropped = alignment.dropped.get(k, [])

        if clause.punct:
            evidence = [f"歌词断句：句末标点「{clause.punct}」"]
        else:
            evidence = ["歌词断句：句末为曲牌、角色标记或舞台提示"]
        evidence += [f"演出「{v['performed']}」，歌词作「{v['lyric']}」" for v in variants]
        evidence += [alignment.notes[i] for i in indexes if i in alignment.notes]
        if dropped:
            evidence.append(f"歌词「{''.join(dropped)}」未唱（歌词原句：{clause.text}）")

        clean = not dropped and all(alignment.src[i] == "lyrics" for i in indexes)
        phrases.append(_phrase(
            [chars[i] for i in indexes],
            [alignment.src[i] for i in indexes],
            qupai=clause.qupai,
            kind=clause.kind,
            status="confirmed" if clean else "variant",
            evidence=evidence,
            lyric=clause.text,
            variants=variants,
        ))
    return phrases


def omitted_lyrics(clauses: list[Clause], alignment: Alignment) -> list[dict]:
    """歌词里有、演出没唱的：整句没唱的连续分句合并成一条，句内漏字各自一条。"""
    performed = {k for k in alignment.clause[: alignment.tail_start] if k is not None}
    omitted: list[dict] = []
    run: list[Clause] = []

    def close_run() -> None:
        if run:
            omitted.append({
                "lyric_text": "".join(c.text + c.punct for c in run),
                "qupai": run[0].qupai,
                "reason": f"演出未唱（整段，共 {len(run)} 句）" if len(run) > 1 else "演出未唱（整句）",
            })
            run.clear()

    for k, clause in enumerate(clauses):
        if k in performed:
            close_run()
            if k in alignment.dropped:
                omitted.append({
                    "lyric_text": "".join(alignment.dropped[k]),
                    "qupai": clause.qupai,
                    "reason": f"演出漏唱（歌词原句：{clause.text}）",
                })
            continue
        if run and (run[0].qupai, run[0].kind) != (clause.qupai, clause.kind):
            close_run()
        run.append(clause)
    close_run()
    return omitted


BREATH_TOLERANCE = 0.02


def tail_phrases(chars: list[dict], entries: list[dict], breaths: list[dict],
                 excluded: list[dict]) -> list[dict]:
    """歌词覆盖不到的尾段：按 overrides 里显式列出的分句切，全部是推定。"""
    actual = "".join(c["ch"] for c in chars)
    wanted = "".join(e["text"] for e in entries)
    if actual != wanted:
        raise ValueError(f"尾段文字与 overrides 不一致：演出「{actual}」，overrides「{wanted}」")

    phrases, start = [], 0
    for entry in entries:
        end = start
        while "".join(c["ch"] for c in chars[start:end]) != entry["text"]:
            end += 1
            if end > len(chars) or len("".join(c["ch"] for c in chars[start:end])) > len(entry["text"]):
                raise ValueError(f"尾段分句「{entry['text']}」没有落在字的边界上")
        phrases.append(_phrase(
            chars[start:end],
            ["tail"] * (end - start),
            qupai=entry.get("qupai"),
            kind=entry["kind"],
            status="inferred",
            evidence=[entry["note"]],
            lyric=None,
            variants=[],
        ))
        start = end

    for phrase, following in zip(phrases, phrases[1:]):
        gap_start, gap_end = phrase["e"], following["s"]
        phrase["evidence"].append(f"句后停顿 {gap_end - gap_start:.2f} 秒")
        if any(gap_start - BREATH_TOLERANCE <= b["t"] <= gap_end + BREATH_TOLERANCE for b in breaths):
            phrase["evidence"].append("停顿处有呼吸点")
        for gone in excluded:
            if gap_start - BREATH_TOLERANCE <= gone["s"] and gone["e"] <= gap_end + BREATH_TOLERANCE:
                phrase["evidence"].append(
                    f"停顿中包含已排除的「{gone['ch']}」（{gone['s']:.2f}–{gone['e']:.2f} 秒）"
                )
    return phrases


# ── 轨道归句 ─────────────────────────────────────────────────────────────────

QIANGGE_TRACK = "腔格轨"
ACTION_TRACKS = {"动作": False, "临时动作轨": True}  # 轨名 → provisional
POINT_TRACKS = {"动作": False, "临时腔格轨": True}


def _assign_blocks(phrases: list[dict], blocks: list[dict], **extra) -> list[list[dict]]:
    """块分给所有与它时间重叠的分句；s/e 是原始时间，cs/ce 裁剪到句内。"""
    assigned: list[list[dict]] = [[] for _ in phrases]
    for block in blocks:
        hits = [k for k, p in enumerate(phrases) if block["s"] < p["e"] and block["e"] > p["s"]]
        for k in hits:
            assigned[k].append({
                "t": block["t"],
                "s": block["s"],
                "e": block["e"],
                "cs": max(block["s"], phrases[k]["s"]),
                "ce": min(block["e"], phrases[k]["e"]),
                "cont_prev": k != hits[0],
                "cont_next": k != hits[-1],
                **extra,
            })
    return assigned


def _owner(phrases: list[dict], t: float) -> int:
    """时间点归到 s ≤ t ≤ e 的分句；落在两句之间的空隙里归前一句。"""
    for k, following in enumerate(phrases[1:]):
        if t <= phrases[k]["e"] or t < following["s"]:
            return k
    return len(phrases) - 1


def attach_tracks(phrases: list[dict], model: dict) -> None:
    tracks = {t["name"]: t for t in model.get("tracks", [])}

    def blocks(name: str) -> list[dict]:
        return tracks.get(name, {}).get("blocks", [])

    qiangge = _assign_blocks(phrases, blocks(QIANGGE_TRACK))
    actions: list[list[dict]] = [[] for _ in phrases]
    for name, provisional in ACTION_TRACKS.items():
        for k, items in enumerate(_assign_blocks(phrases, blocks(name), provisional=provisional)):
            actions[k] += items

    points: list[list[dict]] = [[] for _ in phrases]
    for name, provisional in POINT_TRACKS.items():
        for point in tracks.get(name, {}).get("points", []):
            points[_owner(phrases, point["t"])].append({**point, "provisional": provisional})
    breaths: list[list[dict]] = [[] for _ in phrases]
    for breath in model.get("breaths", []):
        breaths[_owner(phrases, breath["t"])].append(dict(breath))

    for k, phrase in enumerate(phrases):
        phrase["qiangge"] = sorted(qiangge[k], key=lambda x: x["cs"])
        phrase["actions"] = sorted(actions[k], key=lambda x: x["cs"])
        phrase["points"] = sorted(points[k], key=lambda x: x["t"])
        phrase["breaths"] = sorted(breaths[k], key=lambda x: x["t"])


def viewer_tracks(model: dict) -> list[dict]:
    """原样提供给 Timeline 的轨道；过滤规则与 src/lib/model.js 一致。"""
    return [
        {**track, "points": [p for p in track.get("points", []) if "点状腔格" not in p["tk"]]}
        for track in model.get("tracks", [])
        if "临时" not in track["name"]
    ]


# ── 汇总 ─────────────────────────────────────────────────────────────────────


def build_sections(phrases: list[dict]) -> list[dict]:
    sections: list[dict] = []
    for phrase in phrases:
        last = sections[-1] if sections else None
        if last is None or (last["qupai"], last["kind"]) != (phrase["qupai"], phrase["kind"]):
            last = {
                "key": f"s{len(sections) + 1:02d}",
                "qupai": phrase["qupai"],
                "kind": phrase["kind"],
                "phrase_ids": [],
            }
            sections.append(last)
        last["phrase_ids"].append(phrase["id"])
    return sections


def build_phrase_model(model: dict, lyrics: str, overrides: dict) -> dict:
    clauses = parse_lyrics(lyrics)
    source = flatten_chars(model)
    chars, excluded = apply_excludes(source, overrides.get("exclude", []))
    alignment = align(chars, clauses)

    phrases = lyric_phrases(chars, clauses, alignment) + tail_phrases(
        chars[alignment.tail_start:], overrides.get("tail", []), model.get("breaths", []), excluded,
    )
    phrases = [{"id": f"p{n + 1:03d}", "index": n, **p} for n, p in enumerate(phrases)]
    attach_tracks(phrases, model)

    count = Counter(p["status"] for p in phrases)
    return {
        "meta": model["meta"],
        "sections": build_sections(phrases),
        "phrases": phrases,
        "tracks": viewer_tracks(model),
        "omitted": omitted_lyrics(clauses, alignment),
        "excluded": excluded,
        "stats": {
            "source_chars": len(source),
            "chars": len(chars),
            "excluded": len(excluded),
            "phrases": len(phrases),
            "confirmed": count["confirmed"],
            "variant": count["variant"],
            "inferred": count["inferred"],
        },
    }


@lru_cache
def phrase_model(piece_id: str) -> dict:
    """进程内缓存；改了歌词或 overrides 之后要重启服务。"""
    return build_phrase_model(**load_inputs(piece_id))


if __name__ == "__main__":
    built = phrase_model("xunmeng")
    by_id = {p["id"]: p for p in built["phrases"]}
    for section in built["sections"]:
        print(f"\n【{section['qupai'] or '—'}】{section['kind']}")
        for phrase_id in section["phrase_ids"]:
            p = by_id[phrase_id]
            print(f"  {p['id']} {p['s']:8.2f}–{p['e']:8.2f} {p['status']:9} {p['text']}")
            for line in p["evidence"]:
                print(f"{'':35}· {line}")
    print("\nomitted:", json.dumps(built["omitted"], ensure_ascii=False, indent=1))
    print("excluded:", json.dumps(built["excluded"], ensure_ascii=False))
    print("stats:", json.dumps(built["stats"], ensure_ascii=False))
