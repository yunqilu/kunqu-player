from fastapi import FastAPI, HTTPException

from app.models import PhraseModel, PieceSummary
from app.pipeline import PIECES, phrase_model

app = FastAPI(title="kunqu-player API")


def _load(piece_id: str) -> dict:
    try:
        return phrase_model(piece_id)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=f"断句失败：{error}") from error


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/pieces", response_model=list[PieceSummary])
def pieces() -> list[dict]:
    return [{"id": piece_id, "title": _load(piece_id)["meta"]["title"]} for piece_id in PIECES]


@app.get("/api/pieces/{piece_id}/phrases", response_model=PhraseModel)
def phrases(piece_id: str) -> dict:
    if piece_id not in PIECES:
        known = "、".join(PIECES)
        raise HTTPException(status_code=404, detail=f"没有曲目「{piece_id}」；可用的曲目：{known}")
    return _load(piece_id)
