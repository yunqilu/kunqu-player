"""依据的结构化形式。

每条依据是 {code, params}；中文的 evidence 文本由这里的模板渲染出来，
所以 evidence 与 evidence_items 必然一一对应、顺序一致。
前端用同样的 code 在 src/i18n/{zh,en}.js 里找模板（key 为 evidence.<code>），
测试会检查两边的 code 一致、前端的中文模板渲染结果与这里相同。
params 的值都是已经格式化好的字符串（秒数保留两位小数）。
"""

TEMPLATES_ZH = {
    # 歌词范围内的分句
    "lyric_punct": "歌词断句：句末标点「{punct}」",
    "lyric_boundary": "歌词断句：句末为曲牌、角色标记或舞台提示",
    "variant": "演出「{performed}」，歌词作「{lyric}」",
    "dropped": "歌词「{text}」未唱（歌词原句：{clause}）",
    # 不在歌词中的字（衬字）归到哪一句
    "attached_no_prev": "「{ch}」不在歌词中，其前没有已对齐的字，归入后一句",
    "attached_same_clause": "「{ch}」不在歌词中，前后的字同属本句",
    "attached_group_next": "「{ch}」不在歌词中，原数据中与后字「{neighbor}」同属 {line_id}，归入后一句",
    "attached_group_prev": "「{ch}」不在歌词中，原数据中与前字「{neighbor}」同属 {line_id}，归入前一句",
    "attached_gap_next": "「{ch}」不在歌词中，距前字 {before} 秒、距后字 {after} 秒，归入后一句",
    "attached_gap_prev": "「{ch}」不在歌词中，距前字 {before} 秒、距后字 {after} 秒，归入前一句",
    # 尾段（歌词覆盖不到，按 overrides 推定）
    "override_note": "{zh}",
    "gap": "句后停顿 {seconds} 秒",
    "breath": "停顿处有呼吸点",
    "gap_excluded": "停顿中包含已排除的「{ch}」（{s}–{e} 秒）",
}


def item(code: str, **params: str) -> dict:
    if code not in TEMPLATES_ZH:
        raise KeyError(f"未知的依据 code：{code}")
    return {"code": code, "params": params}


def seconds(value: float) -> str:
    return f"{value:.2f}"


def render(entry: dict) -> str:
    return TEMPLATES_ZH[entry["code"]].format(**entry["params"])
