from fastapi import FastAPI

app = FastAPI(title="kunqu-player API")


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}
