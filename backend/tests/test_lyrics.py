from pathlib import Path

from app.lyrics import extract_docx_text

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"


def test_docx_and_txt_are_in_sync():
    """txt 是 docx 的派生文件：改了其中一个、忘了另一个，这里会失败。"""
    extracted = extract_docx_text(RAW / "xunmeng-lyrics.docx")
    committed = (RAW / "xunmeng-lyrics.txt").read_text(encoding="utf-8")

    assert extracted == committed


def test_extracted_text_ends_with_single_newline():
    extracted = extract_docx_text(RAW / "xunmeng-lyrics.docx")

    assert extracted.endswith("\n")
    assert not extracted.endswith("\n\n")
    assert extracted == extracted.strip() + "\n"
