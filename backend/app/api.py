from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.media import video_name, video_path
from app.models import PhraseModel, PieceSummary
from app.pipeline import PIECES, phrase_model

app = FastAPI(title="kunqu-player API")


def _load(piece_id: str) -> dict:
    try:
        return phrase_model(piece_id)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=f"断句失败：{error}") from error


def _require_piece(piece_id: str) -> None:
    if piece_id not in PIECES:
        known = "、".join(PIECES)
        raise HTTPException(status_code=404, detail=f"没有曲目「{piece_id}」；可用的曲目：{known}")


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/pieces", response_model=list[PieceSummary])
def pieces() -> list[dict]:
    return [{"id": piece_id, "title": _load(piece_id)["meta"]["title"]} for piece_id in PIECES]


@app.get("/api/pieces/{piece_id}/phrases", response_model=PhraseModel)
def phrases(piece_id: str) -> dict:
    _require_piece(piece_id)
    return _load(piece_id)


# FastAPI 的 @app.get 不响应 HEAD；前端用 HEAD 探测视频是否存在，所以两个方法都注册
@app.api_route("/api/pieces/{piece_id}/video", methods=["GET", "HEAD"], response_class=FileResponse)
def video(piece_id: str) -> FileResponse:
    _require_piece(piece_id)
    path = video_path(piece_id)
    if path is None:
        name = video_name(piece_id)
        raise HTTPException(
            status_code=404,
            detail=f"没有找到视频。请把视频放到 media/{name}（或用环境变量 MEDIA_DIR 指定目录）。",
        )
    return FileResponse(path, media_type="video/mp4")
