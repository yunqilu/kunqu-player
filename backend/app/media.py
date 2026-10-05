"""视频文件的位置。视频有版权且体积大，不进仓库，只从本机的 media 目录读。"""

import os
from pathlib import Path

from app.pipeline import PIECES

DEFAULT_MEDIA_DIR = "/work/media"


def media_dir() -> Path:
    # 每次请求时读环境变量，测试和部署都可以改 MEDIA_DIR 而不必重新 import
    return Path(os.environ.get("MEDIA_DIR") or DEFAULT_MEDIA_DIR)


def video_name(piece_id: str) -> str | None:
    """曲目的视频文件名；文件名只来自 PIECES 配置，从不拼接请求里的文字。"""
    piece = PIECES.get(piece_id)
    return piece.get("video") if piece else None


def video_path(piece_id: str) -> Path | None:
    name = video_name(piece_id)
    if name is None:
        return None
    path = media_dir() / name
    return path if path.is_file() else None
