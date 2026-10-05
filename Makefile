COMPOSE := docker compose -f docker/compose.yaml
API_RUN := $(COMPOSE) run --rm --no-deps -w /work/backend api
WEB_RUN := $(COMPOSE) run --rm --no-deps web

.DEFAULT_GOAL := help
.PHONY: help build up down logs test smoke verify clean lyrics

help: ## 列出所有 target
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

build: ## 构建 api / web 镜像
	$(COMPOSE) build

up: ## 启动 api (127.0.0.1:8000) 和 web (127.0.0.1:5173)
	$(COMPOSE) up -d -V

down: ## 停止并移除容器
	$(COMPOSE) down

logs: ## 跟踪容器日志
	$(COMPOSE) logs -f

test: ## 容器内跑 pytest 和 vitest
	$(API_RUN) python -m pytest tests -q -p no:cacheprovider
	$(WEB_RUN) npm test

smoke: ## 启动 api 并在容器内请求它
	$(COMPOSE) up -d api
	$(COMPOSE) exec -T api python backend/smoke.py

verify: test smoke ## test + smoke

lyrics: ## 从 docx 重新生成 data/raw/xunmeng-lyrics.txt
	$(API_RUN) python -m app.lyrics ../data/raw/xunmeng-lyrics.docx ../data/raw/xunmeng-lyrics.txt

clean: ## 移除容器、卷和本项目构建的镜像
	$(COMPOSE) down -v --rmi local --remove-orphans
