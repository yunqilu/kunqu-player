"""从歌词 docx（原始来源，只读）派生纯文本。只用标准库。"""

import re
import sys
import zipfile
from pathlib import Path


def extract_docx_text(path: Path | str) -> str:
    with zipfile.ZipFile(path) as docx:
        xml = docx.read("word/document.xml").decode("utf-8")
    text = re.sub(r"<[^>]+>", "", xml.replace("</w:p>", "\n"))
    return text.strip() + "\n"


if __name__ == "__main__":
    source, target = sys.argv[1:3]
    Path(target).write_text(extract_docx_text(source), encoding="utf-8")
