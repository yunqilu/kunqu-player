"""make smoke：在 api 容器内请求正在运行的服务。"""

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def get(path: str, attempts: int = 30):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(BASE + path, timeout=2) as response:
                return json.load(response)
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.5)
    sys.exit(f"smoke: {path} 无响应")


health = get("/api/health")
assert health == {"ok": True}, health
print("smoke ok")
