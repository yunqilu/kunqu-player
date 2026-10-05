"""逐句翻译的合并。

翻译文件的键是「演出文字#第几次出现」（如 秀才#1、秀才#2），不用分句 id：
id 是顺序生成的，断句结果一变就会变。翻译的是实际唱出来的文字。
"""

from collections import Counter


def phrase_keys(phrases: list[dict]) -> list[str]:
    seen: Counter[str] = Counter()
    keys = []
    for phrase in phrases:
        seen[phrase["text"]] += 1
        keys.append(f"{phrase['text']}#{seen[phrase['text']]}")
    return keys


def attach_translations(phrases: list[dict], translations: dict | None) -> None:
    """给每个分句加上 en / en_status / en_note；没有对应翻译的留空，不猜。"""
    by_key = {}
    for entry in (translations or {}).get("entries", []):
        if entry["key"].rpartition("#")[0] != entry["zh"]:
            raise ValueError(f"翻译「{entry['key']}」的 zh「{entry['zh']}」与键里的文字不一致")
        by_key[entry["key"]] = entry
    for key, phrase in zip(phrase_keys(phrases), phrases):
        entry = by_key.get(key)
        phrase["en"] = entry["en"] if entry else None
        phrase["en_status"] = entry["status"] if entry else None
        phrase["en_note"] = entry.get("note") if entry else None
