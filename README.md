# 昆曲声腔标注播放器 · 寻梦

顾卫英《牡丹亭·寻梦》的同步阅读播放器：视频、逐字唱词、工尺谱、腔格、呼吸、动作对齐在同一条时间线上。

这个分支（`yunqi/phrasing`）加了三样东西：

- **断句**：把 427 个逐字标注按歌词的逗号级分句重新切成 75 句，由 Python 后端计算。
- **左栏目录**：曲牌 → 分句两级，推定的句子用虚线和淡色区分。
- **时长排版视图**：一句一行，字块宽度随演唱时长变化，工尺 / 腔格 / 呼吸 / 动作四条轨道可开关，点任何单元都从该处播放。

## 运行

只需要 Docker Desktop 和 `make`。宿主机上不用装 Node 或 Python，所有东西都在容器里跑。

```bash
make build   # 第一次，或改了依赖之后
make up      # 启动后端和前端
```

然后打开 <http://127.0.0.1:5173>。

### 视频

把《寻梦》的录像放到仓库里的 `media/xunmeng.mp4`，页面打开时就会自动载入，进度条可以拖动：

```bash
mkdir -p media
cp /path/to/your/video.mp4 media/xunmeng.mp4
```

视频不在仓库里，`media/` 已写进 `.gitignore`：央视的录像有版权，而这个仓库是公开的；另外 GitHub 单个文件上限是 100 MB。视频只留在本机，由后端读出来给页面。

- 想把视频放在别处：设置 api 容器的环境变量 `MEDIA_DIR`（默认 `/work/media`，也就是仓库里的 `media/`），并把那个目录挂载进容器。
- 没有放视频时，页面会显示提示，并保留右上角的入口：填直链，或点"本地"选文件。载入成功后这个入口收成一个 `Change video` 按钮。
- 不载入视频也能按 ▶ 或空格，用虚拟时间轴预览同步。

| 命令 | 作用 |
|---|---|
| `make help` | 列出所有命令 |
| `make build` | 构建两个镜像 |
| `make up` / `make down` | 启动 / 停止（前端 `127.0.0.1:5173`，后端 `127.0.0.1:8000`） |
| `make logs` | 跟踪容器日志 |
| `make test` | 容器内跑 pytest 和 Vitest |
| `make smoke` | 启动后端并请求一次断句接口，检查关键数字 |
| `make verify` | `test` + `smoke` |
| `make phrases` | 把断句结果（分句、状态、依据）打印出来，供人工检查 |
| `make lyrics` | 从歌词 docx 重新生成 txt |
| `make clean` | 移除容器、卷和本项目的镜像 |

后端的接口文档在 <http://127.0.0.1:8000/docs>。

## 架构

```
src/data/viewerModel.json ─┐
data/raw/xunmeng-lyrics.txt ├─► backend/app/pipeline.py ─► GET /api/pieces/{id}/phrases
data/review/phrasing-overrides.json ┘                                   │
                                                                         ▼
                                        src/lib/model.js (loadModel) ─► Vue 组件
```

后端负责断句和把轨道内容归到各句；前端只画图和交互，不计算结果。

| 位置 | 内容 |
|---|---|
| `backend/app/pipeline.py` | 断句：解析歌词、与演唱逐字对齐、处理对不上的字、尾段、轨道归句 |
| `backend/app/models.py`、`api.py` | 响应模型和路由 |
| `backend/app/media.py`、`src/lib/video.js` | 视频：后端找文件，前端探测并自动载入 |
| `src/lib/model.js` | `loadModel()` 取数据并填充全应用共享的 `model` |
| `src/lib/outline.js`、`components/LeftColumn.vue` | 左栏的两级目录 |
| `src/lib/flowLayout.js`、`flowPrefs.js`、`components/PhraseFlow.vue` | 时长排版视图 |
| `src/score/`、`components/ScoreReviewPanel.vue` | 工尺谱转五线谱的转换核心和审阅界面；不经过后端，见 `CONTEXT.md` |

`src/main.js` 先等 `loadModel()` 完成，再加载界面，因为播放时钟在创建时就要读曲目的时间范围。

### 接口

| 路径 | 返回 |
|---|---|
| `GET /api/health` | `{"ok": true}` |
| `GET /api/pieces` | 曲目列表 |
| `GET /api/pieces/{piece_id}/phrases` | 断句结果；未知曲目返回 404 和一句说明 |
| `GET`、`HEAD /api/pieces/{piece_id}/video` | `media/` 里的视频，支持 HTTP Range；文件不存在或曲目未知返回 404 和一句说明 |

## 断句是怎么来的

1. 歌词按标点、曲牌名、角色标记、舞台提示切成分句。
2. 演唱的逐字序列和歌词做序列对齐。对得上的字归到对应分句。
3. 演出里多出来的字（衬字）按原标注的分组或时间间隔归到前一句或后一句。
4. 歌词覆盖不到的结尾段落，按 `data/review/phrasing-overrides.json` 里人工列出的分句切。

每一句都带一个状态和依据，推定不冒充事实：

| 状态 | 含义 | 界面上 |
|---|---|---|
| `confirmed` | 每个字都和歌词一致 | 普通样式 |
| `variant` | 和歌词有出入：换字、衬字、漏唱 | "异"标记；有出入的字带下划线，悬停显示歌词原文 |
| `inferred` | 歌词里没有，断点是人工推定的 | 虚线、淡色；悬停显示依据（语义、停顿秒数、呼吸点） |

目前的结果是 47 句 `confirmed`、14 句 `variant`、14 句 `inferred`。歌词里有而演出没唱的部分（整段【豆叶黄】等）列在响应的 `omitted` 里；被人工排除的字（一个原标注带问号的 `哭？`）列在 `excluded` 里，它原来占的时间在视图里显示为空白。

要修改结尾段落的断法或排除别的字，编辑 `data/review/phrasing-overrides.json`，然后 `make down && make up`，再用 `make phrases` 检查。分句拼起来必须恰好等于那一段的文字，否则后端会报错而不是静默接受。

## 数据来源

- `src/data/viewerModel.json`：逐字时间标注、工尺、腔格、呼吸、动作。只读。
- `data/raw/xunmeng-lyrics.docx`：唱词原文（汤显祖，公有领域），原始来源，只读。
- `data/raw/xunmeng-lyrics.txt`：由 docx 派生，后端只读这个文件。测试会检查两者一致。

## 已知限制

- **需要后端。** `npm run build` 生成的单文件 `dist/index.html` 不再能双击使用；原因见 `docs/adr/0020-compute-phrasing-in-a-python-backend.md`。
- **改了歌词或 overrides 要重启服务。** 断句结果缓存在后端进程里。
- **时长排版里字宽的差别比较含蓄。** 宽度是 `28 + 18·√时长`，一秒的字和两秒的字只差几个像素；常数在 `src/lib/flowLayout.js`。
- **长腔的工尺音最多错开三排**，再密就会重叠。
- **只有一个曲目。** 接口按曲目 id 设计，但前端目前写死了 `xunmeng`。
- 载入真实视频后的同步、窄窗口布局，还没有系统地测过。

## 术语和决策记录

领域术语见 `CONTEXT.md`，架构决策见 `docs/adr/`。
