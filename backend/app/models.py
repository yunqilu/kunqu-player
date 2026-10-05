"""API 的响应模型。字段见 docs/plans/phrasing-backend-and-flow-view.md §6。"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class Strict(BaseModel):
    # pipeline 多输出一个字段时立刻报错，而不是悄悄漏给前端
    model_config = ConfigDict(extra="forbid")


class PieceSummary(Strict):
    id: str
    title: str


class Meta(Strict):
    title: str
    performer: str
    source: str
    video: str
    span: list[float]


class Section(Strict):
    key: str
    qupai: str | None
    kind: Literal["唱", "白"]
    phrase_ids: list[str]


class Variant(Strict):
    i: int
    performed: str
    lyric: str


class Char(Strict):
    i: int  # 在原始逐字序列里的序号
    ch: str
    s: float
    e: float
    st: str
    src: Literal["lyrics", "variant", "attached", "tail"]
    gc: list[dict[str, Any]]  # 播放投影的工尺字段，原样透传


class Block(Strict):
    t: str
    s: float  # 原始时间，点击跳转用
    e: float
    cs: float  # 裁剪到句内，画图用
    ce: float
    cont_prev: bool
    cont_next: bool


class ActionBlock(Block):
    provisional: bool


class Point(Strict):
    t: float
    l: str
    tk: str
    provisional: bool


class Breath(Strict):
    t: float
    l: str
    tk: str


class EvidenceItem(Strict):
    code: str
    params: dict[str, str]


class Phrase(Strict):
    id: str
    index: int
    qupai: str | None
    kind: Literal["唱", "白"]
    status: Literal["confirmed", "variant", "inferred"]
    evidence: list[str]
    evidence_items: list[EvidenceItem]  # 与 evidence 一一对应，供前端按语言显示
    lyric: str | None
    variants: list[Variant]
    text: str
    s: float
    e: float
    chars: list[Char]
    qiangge: list[Block]
    actions: list[ActionBlock]
    points: list[Point]
    breaths: list[Breath]
    en: str | None  # 逐句英文翻译（字幕）；没有对应翻译时为 None
    en_status: Literal["draft", "reviewed"] | None
    en_note: str | None


class Omitted(Strict):
    lyric_text: str
    qupai: str | None
    reason: str


class Excluded(Strict):
    ch: str
    s: float
    e: float
    reason: str
    reason_en: str


class Stats(Strict):
    source_chars: int
    chars: int
    excluded: int
    phrases: int
    confirmed: int
    variant: int
    inferred: int
    translated: int
    reviewed: int


class PhraseModel(Strict):
    meta: Meta
    sections: list[Section]
    phrases: list[Phrase]
    tracks: list[dict[str, Any]]  # 原样提供给 Timeline
    omitted: list[Omitted]
    excluded: list[Excluded]
    stats: Stats
