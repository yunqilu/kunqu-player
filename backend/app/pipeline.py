"""断句 pipeline：歌词分句 → 与演唱逐字数据对齐 → 输出带状态和依据的分句。

纯函数，不读网络；输入是播放投影 (viewerModel.json)、歌词文本和人工 overrides。
任何推定都要在 status / evidence 里可见，不冒充事实。
"""

import re
from dataclasses import dataclass

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
