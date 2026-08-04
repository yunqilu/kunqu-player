# 昆曲工尺谱转相对谱与 MusicXML 执行文档

> 状态：可执行
>
> 决策日期：2026-08-03；最终整合：2026-08-04
>
> 首个验收曲目：《牡丹亭·寻梦》
>
> 产品边界：通用昆曲工尺谱转换器，《寻梦》不是硬编码特例

## 1. 目标

把当前 `viewerModel.json` 这类播放投影与每曲独立的校订清单编译为经校订的工尺源，再无损解析为可校订的相对谱和唯一规范谱解释，最终生成带可见推定标记和完整回溯链的单一 MusicXML 4.0；另以独立 Playback Plan 提供可开关试听，不生成第二份乐谱。

成功结果同时满足：

- 严格按昆曲工尺谱的音高、板眼、气口、旁注音和腔格语义读取；
- `gc.raw` 是唯一工尺语义输入，`b/r/p/bt/o/q` 只做一致性诊断；
- `line/char/gc.s/e` 不参与音符起点、时值、拍号、速度或休止推导；
- 缺失音乐信息可以采用最佳推定，但必须按字段标记、可见且可回溯；
- 规范 MusicXML 与试听渲染严格分层，试听效果只能通过紫色定位提示出现在谱上；
- 同一转换核心可被命令行和 Vue viewer 调用；
- 新曲目只增加校订清单和必要配置，不修改通用解析或导出逻辑。

## 2. 交付边界

### 2.1 本计划包含

- 校订清单 v1 与校验器；
- 播放投影和校订清单的编译器；
- `gc.raw` 词法分析器与语法解析器；
- 相对谱中间表示 v1；
- 规范谱解释 v1 与 Playback Plan v1；
- 曲牌区段、定调、板式、节奏、休止和腔格解析；
- 推定五线谱 MusicXML 4.0 导出；
- gongchepu.net 兼容试听 profile 与紫色效果标记；
- CLI 批处理入口；
- 《寻梦》首个校订清单、缺失六音修复和回归夹具；
- 自动测试与 MusicXML 结构验证；
- viewer 中的推定项编辑、确认、重导出和校订清单下载。

### 2.2 本计划不包含

- 根据录音自动识别旋律或节拍；
- 用视频时间戳量化传统谱面；
- 服务器、用户系统、协同编辑或数据库；
- 首版内嵌完整五线谱排版引擎；
- 在没有腔格实现配置时自动发明豁腔、擞腔或其他未审定腔格的微观音列；
- 直接编辑生成后的 MusicXML 作为校订来源。

## 3. 已固定的核心决定

| 主题 | 执行决定 |
| --- | --- |
| 权威来源 | `viewerModel.json` 是播放投影；每曲校订清单与其共同编译为经校订的工尺源 |
| 缺漏修复 | 修复写入校订清单并带出处；转换器内不得出现曲目特判 |
| 工尺解析 | 只从 `gc.raw` 读取语义；展开字段只比较并报告差异 |
| 中间表示 | 先生成版本化相对谱，再生成唯一规范谱解释；MusicXML 与 Playback Plan 分别消费规范谱 |
| 证据状态 | 每个可推定字段使用 `confirmed / derived / inferred / unresolved` |
| 推定策略 | 尽量生成完整五线谱；推定在谱面可见，并通过 MusicXML ID 回链相对谱 |
| 默认定调 | 无法确定笛色时使用 12-TET、A4=440、`上=D4`，即 `1=D`，状态为 `inferred` |
| 区段上下文 | 定调和板式按曲牌区段解析；显式标注优先，其次有出处的承接规则，最后最佳推定 |
| 板式拍格 | 流水板 1/4；一板一眼 2/4；一板三眼 4/4；加赠板 8/4，按 4+4 分组；散板 `senza-misura` |
| 有拍节奏 | 板式确认、板眼循环合法且通用规则唯一命中时采用版本化通用分配，结果为 `derived` |
| 节奏兜底 | 通用规则前提不满足或结果不唯一时，锚点间优先等分，再最小化附点和连音；所有受影响时值为 `inferred` |
| 休止 | 已审定腔格可生成规范休止；除此之外只从已确认有拍结构的未占用拍位推定；`gc=[]`、气口和时间空隙都不是休止 |
| 括号旁注音 | 默认有时值并参与量化，以小尺寸显示；只有明确配置才能变为 grace note |
| 私有码 | `/=气口`、`h=豁腔`、`s=擞腔`、`d=叠腔`、`c=掇腔`；“撮腔”与 `cuoqiang` 是兼容别名 |
| 腔格导出 | 叠腔与掇腔按已审定规则展开；其他腔格无实现配置时用中文名和 `other-ornament` 保真 |
| 乐谱与试听 | 只生成一份规范 MusicXML；另生成 Playback Plan，不生成试听版 MusicXML，也不反向修改规范时值 |
| 谱面颜色 | 黑色为原谱事实与确定推导，橙色为规范谱推定，绿色为明记腔格名称，紫色为试听效果提示且不写“试听”二字 |
| 五线谱外观 | MusicXML 只显示五线谱、歌词与编辑标记，不显示工尺字；所有来源通过稳定 ID 回查 |
| 界面 | 先核心与 CLI，后 viewer 审阅闭环；两者复用同一核心 |

这些决定的领域定义见 [CONTEXT.md](../../CONTEXT.md)，不可见的取舍见 [docs/adr](../adr/)。

## 4. 证据基线

- 正式地方标准给出工尺音级、音区和七种笛色与现代调名的近似关系，同时明确传统律制不等同西乐调律：[DB3205/T 1172—2025，附录 B](https://scjgj.suzhou.gov.cn/szqts/cszhfwbzh/202503/ad42362b76774dc1b5d80246d4400234/files/b2c4450ce7654d1f81326a2f6cb62a8b.pdf)。
- 板眼、板式、气口和腔格定义依据《昆曲工尺谱记谱符号》征求意见稿；它是高可信解释材料，但不是现行正式标准：[原 PDF](https://www.ttbz.org.cn/upload/file/20241231/6387124078379176658257744.pdf)。
- 一板一眼、三眼板、流水板、赠板和散板的拍数关系可由文化和旅游部恭王府博物馆说明交叉核对：[何谓“板眼”](https://www.pgm.org.cn/pgm/wfsh/201407/6d0287c3f4ca4cd5ae7dfbad7d3bf7c2.shtml)。
- `1..8` 和私有 GCN 串行化语法以固定上游提交为格式证据：[Xiqu-Annotation-System @ 7351eec](https://github.com/ZhengTong11111/Xiqu-Annotation-System/tree/7351eeec7178310420b2e007d43b5e46379fb8e5)。
- 《寻梦》曲牌与笛色、原始工尺及“杨”字六音来自经录入和审校的《粟庐曲谱》数字文本：[牡丹亭·寻梦](https://gongchepu.net/reader/647/)。
- 网站试听规则以公开业务包 `d0aa98a3e71c.js` 的固定 SHA-256 `6f8d060b486d1a2aafacc582d4e12d64a5d25c777624b3684cf2900f412f4db8` 为实现证据；采纳范围、冲突和测试向量见[源码审计](../research/gongchepu-karaoke-implementation-audit.md)。
- MusicXML 映射以 W3C MusicXML 4.0 为目标：[MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/)、[`note`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/note/)、[`level`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/level/)、[`senza-misura`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/senza-misura/)。
- 完整的字段审计、计数、边界和测试例见 [研究文档](../research/kunqu-gongche-to-staff.md)。

## 5. 数据流与失败边界

```text
viewerModel.json ─────┐
                      ├─ compileReview() ─→ reviewed-source.json
review-manifest.json ─┘                         │
                                                ▼
                                        parseGongcheRaw()
                                                │
                                                ▼
                                      relative-score.json
                                                │
                      ┌─────────────────────────┼────────────────────┐
                      ▼                         ▼                    ▼
               resolveTuning()          resolveRhythm()      realizeQiangge()
                      └─────────────────────────┼────────────────────┘
                                                ▼
                                      canonical-score.json
                                                │
                              ┌─────────────────┴──────────────────┐
                              ▼                                    ▼
                    renderPlayback()                         exportMusicXML()
                              │                                    ▲
                              ▼                                    │
                     playback-plan.json ──紫色定位提示──────────────┘
                                                                   │
                                                                   ▼
                                                            score.musicxml
                                                                   │
                                                                   ▼
                                              viewer 审阅 → 新 review-manifest.json
```

`canonical-score.json` 是唯一的规范谱解释；`score.musicxml` 的音符、休止、拍位和时值只能来自它。`playback-plan.json` 可以添加表演事件，MusicXML 只接收这些事件的紫色定位提示，不接收其播放时值、休止或音高变化。转换永远不生成第二份“试听 MusicXML”。

失败分为两类：

1. **结构错误必须停止**：JSON schema 不合法、目标字符漂移、`gc.raw` 出现未知字符、括号不配对、稳定 ID 冲突、MusicXML 无法形成合法结构。
2. **音乐信息不足不得停止整体导出**：缺笛色、缺板式、时值不唯一、休止不确定或腔格未展开时，生成 `inferred` 或 `unresolved` 字段、可见标记与诊断。

如果单个事件没有任何可防御的 MusicXML 值，导出器保留文字说明和诊断，不得静默丢弃；其余区段仍可导出。

## 6. 目录与模块设计

新增结构：

```text
src/
  score/
    evidence.js
    ids.js
    diagnostics.js
    schema/
      review-manifest.schema.json
      reviewed-source.schema.json
      relative-score.schema.json
      canonical-score.schema.json
      playback-plan.schema.json
      validate.js
    review/
      compileReview.js
      applyOverrides.js
    gongche/
      lexer.js
      parser.js
      pitch.js
      banyan.js
    resolve/
      sections.js
      tuning.js
      rhythm.js
      rests.js
      lyrics.js
      qiangge.js
    musicxml/
      xml.js
      duration.js
      exporter.js
      inferenceMarks.js
      playbackMarks.js
    playback/
      renderPlayback.js
      markerProjection.js
    pipeline.js
  data/
    profiles/
      kunqu-default-v1.json
      gongchepu-playback-2020-v1.json
    reviews/
      xunmeng.review.json
  components/
    ScoreReviewPanel.vue
  composables/
    useScoreReview.js
scripts/
  score-convert.mjs
  score-validate.mjs
tests/
  score/
  fixtures/
    gongche/
    xunmeng/
  vendor/
    musicxml-4.0/
docs/
  plans/
    kunqu-gongche-to-musicxml-execution.md
```

模块边界：

- `pipeline.js` 是唯一公开编排入口，接收普通对象，不读取文件、不访问 DOM；
- CLI 负责文件 I/O，Vue 负责浏览器文件下载，二者不复制转换逻辑；
- `gongche/*` 只处理工尺语法和相对音乐事实；
- `resolve/*` 只把区段上下文与规则应用到相对谱；
- `playback/*` 只消费规范谱解释并生成 Playback Plan，不能改写规范事件；
- `musicxml/*` 只消费规范谱解释及只读的试听定位提示，不读取 `viewerModel` 或 Playback Plan 时值；
- 所有模块返回诊断，不直接写 `console`；
- 任何曲目名、歌词或《寻梦》ID 不得出现在 `src/score`。

## 7. 数据契约

### 7.1 通用字段证据包装

所有可推定值统一使用：

```json
{
  "value": "xiaogong",
  "status": "confirmed",
  "ruleId": null,
  "evidenceIds": ["source-lulu-2015"],
  "note": "【忒忒令】标题明确标注小工调"
}
```

约束：

- `confirmed` 必须至少有人工确认或底本证据；
- `derived` 必须有确定性 `ruleId`；
- `inferred` 必须有推定规则、默认规则或证据说明；
- `unresolved` 的 `value` 必须为 `null`；
- 不增加百分比置信分数。

### 7.2 校订清单 v1

建议骨架：

```json
{
  "schemaVersion": 1,
  "scoreId": "mudanting-xunmeng-lulu",
  "base": {
    "path": "src/data/viewerModel.json",
    "sha256": "<required>"
  },
  "profile": "kunqu-default-v1",
  "sources": [
    {
      "id": "source-lulu-2015",
      "title": "牡丹亭·寻梦（粟庐曲谱）",
      "url": "https://gongchepu.net/reader/647/",
      "kind": "reviewed-score"
    }
  ],
  "corrections": [
    {
      "id": "xunmeng-add-yang-six-notes",
      "op": "replaceCharGongche",
      "target": {
        "lineId": "<resolved during implementation>",
        "charIndex": "<resolved during implementation>",
        "expectedChar": "杨"
      },
      "raw": ["工3", "六2/", "五46", "六", "工3/", "上+2d"],
      "status": "confirmed",
      "evidenceIds": ["source-lulu-2015"]
    }
  ],
  "sections": [],
  "textClassifications": [],
  "overrides": []
}
```

规则：

- `base.sha256` 防止校订清单误套到不同播放投影；
- 字符目标使用 `lineId + charIndex + expectedChar`，命中前必须三项一致；
- 工尺勘误以整字 `raw[]` 替换为首选，避免对易漂移数组索引做隐性局部修改；
- 区段边界使用稳定 source reference，不使用秒数；
- 浏览器人工修订写入 `overrides`，不改生成的 IR 或 XML。

### 7.3 经校订的工尺源 v1

编译结果必须：

- 保留作品、传本、人物和文本元数据；
- 将每个字规范化为稳定 source reference；
- 只保留 `raw[]` 作为工尺事实，同时保留展开字段比较结果到诊断；
- 展开曲牌区段及其显式、承接或推定上下文；
- 保留原 `s/e` 仅在独立 `mediaRef` 中，不允许进入音乐字段；
- 记录基础文件 hash、校订清单 hash 和所有来源。

### 7.4 相对谱 IR v1

顶层至少包含：

```json
{
  "schemaVersion": 1,
  "scoreId": "mudanting-xunmeng-lulu",
  "sourceHash": "<reviewed-source-hash>",
  "profileVersions": ["kunqu-default-v1"],
  "sections": [],
  "diagnostics": [],
  "provenanceIndex": {}
}
```

音符事件至少包含：

```json
{
  "id": "evt_mudanting_xunmeng_line35_c13_g0_n0",
  "kind": "note",
  "sourceRef": {
    "lineId": "line-35",
    "charIndex": 13,
    "gongcheIndex": 0,
    "rawStart": 0,
    "rawEnd": 2
  },
  "lyric": {
    "text": "杨",
    "role": "main"
  },
  "relativePitch": {
    "value": { "degree": 3, "octave": 0 },
    "status": "derived",
    "ruleId": "gongche-base-register-v1",
    "evidenceIds": ["source-lulu-2015"]
  },
  "absolutePitch": {
    "value": { "step": "F", "alter": 1, "octave": 4 },
    "status": "inferred",
    "ruleId": "default-1-equals-d-v1",
    "evidenceIds": []
  },
  "sideNote": false,
  "anchors": [],
  "breathAfter": false,
  "qiangge": [],
  "onset": null,
  "duration": null
}
```

`onset`、`duration`、`rest`、`measure` 等也使用证据包装；示例省略包装只为缩短展示，实际 schema 不得省略。

### 7.5 稳定 ID

- IR 事件 ID 由 `scoreId + sourceRef + parser-local-index` 确定性生成；
- 校订插入内容额外包含 correction ID，使基础数组变化不会重新编号所有后续事件；
- MusicXML `id` 必须是合法 XML ID，并与 IR ID 一一映射；
- UI 不以数组位置保存修订，只以稳定 ID 和字段路径保存；
- 同一输入重复运行必须产生字节稳定的 ID、JSON 键序和 XML 顺序。

### 7.6 规范谱解释与 Playback Plan

`canonical-score.json` 在相对谱之上物化最终的规范音符、休止、小节、歌词、腔格标签及其证据状态。它必须保存：

- `sourceEventIds` 与 `realizationId`；
- 每个 onset、duration、pitch、rest 和 lyric 的字段级状态；
- MusicXML 可见颜色类别 `normal / inferred / qiangge / unresolved`；
- 试听层不可修改的稳定拍位。

`playback-plan.json` 至少包含：

```json
{
  "schemaVersion": 1,
  "scoreId": "mudanting-xunmeng-lulu",
  "canonicalScoreHash": "<required>",
  "profile": "gongchepu-playback-2020-v1",
  "events": [
    {
      "id": "pb_evt_001",
      "sourceEventIds": ["evt_001"],
      "ruleId": "gongchepu-qikou-pause-v1",
      "kind": "pause",
      "beatOnset": { "numerator": 3, "denominator": 4 },
      "beatDuration": { "numerator": 1, "denominator": 8 },
      "parameters": {},
      "scoreMarker": { "text": "气口停顿", "colorRole": "playback" }
    }
  ]
}
```

约束：

- 播放事件只保存拍位和表演参数；BPM 在播放时后置换算为秒；
- `sourceEventIds` 必须能回链规范谱，禁止用媒体时间戳关联；
- `scoreMarker.text` 使用具体效果名称，不加“试听”前缀；
- 紫色提示可进入唯一 MusicXML 的 `direction/words`，但不得创建或改变 note/rest/duration；
- 关闭试听 profile 时规范谱 JSON 与 MusicXML 音乐语义保持不变，只移除紫色提示和 Playback Plan。

## 8. 工尺解析规范

### 8.1 字符集合

词法分析器识别：

- 基字：`合 四 一 上 尺 工 凡 六 五 乙`；
- 音区：紧随基字的 `+` 或 `-`；
- 板眼私有码：`1..8`，保持出现顺序；
- 腔格码：`h s d c`；
- 气口：`/`；
- 全角或半角括号，允许跨 `gc.raw` token 保持旁注范围；
- 已登记的空白或分隔字符。

任何其他字符产生带 source range 的 fatal 诊断，不允许跳过后继续假装解析成功。

### 8.2 语法状态

解析器按一个唱词字的完整 `raw[]` 序列运行，而不是逐 token 重置：

1. 读取基字与可选音区；
2. 创建相对音符事件；
3. 按原顺序附加板眼、腔格和气口事件；
4. 括号状态可跨 token，范围内音符设为 `sideNote=true`；
5. `/` 附着于其前一发音事件；
6. 连续板眼码保留为同一持续音经过的多个锚点，不复制音符；
7. 输出 source offsets，确保每个 IR 事件能回到具体 `gc.raw` 字符。

### 8.3 展开字段诊断

词法结果可以重新投影出 `b/r/p/bt/o/q` 并与输入比较，但：

- 不一致只产生 `FLATTENED_FIELD_MISMATCH`；
- 不得用展开字段修正解析结果；
- 删除、随机修改展开字段后，相对谱与 MusicXML 必须保持不变；
- `gc.raw` 修订只能来自校订清单。

## 9. 音高解析

### 9.1 相对音级

中音区：

| 工尺 | 级数 | 十二平均律半音偏移 |
| --- | ---: | ---: |
| 上 | 1 | 0 |
| 尺 | 2 | 2 |
| 工 | 3 | 4 |
| 凡 | 4 | 5 |
| 六 | 5 | 7 |
| 五 | 6 | 9 |
| 乙 | 7 | 11 |

`合/四/一` 分别规范化为低八度的 `5/6/7`；`+/-` 在规范音区上增加或减少一个八度。所有合法组合必须由表驱动验证，不能根据当前《寻梦》只支持已出现字符。

### 9.2 区段定调优先级

1. 本段明确 `shangPitch + temperament + referenceHz`；
2. 本段明确笛色，使用指定转换配置；
3. 有出处的曲牌承接或曲谱覆盖；
4. 笛色已知但精确调律未知：使用正式近似调门与 12-TET A4=440，状态 `inferred`；
5. 笛色也未知：默认 `上=D4`，状态 `inferred`。

默认七笛色近似表放在 `kunqu-default-v1.json`，不写入算法分支。任何实际传本音高、演出移调或微分音 profile 都可覆盖默认值。

## 10. 曲牌、板眼与节奏

### 10.1 曲牌区段

每个区段必须物化：

- `qupai`；
- `dise`；
- `shangPitch`、`temperament`、`referenceHz`；
- `banshi`；
- `meter`；
- `rhythmProfile`；
- 起止 source reference；
- 每个字段的证据状态和出处。

未重复标注不得自动继承。只有 `kunqu-default-v1` 或曲谱覆盖明确声明承接关系时才能 `derived`；否则使用 `inferred`。

### 10.2 板眼私有码规范化

| 码 | 规范类别 | 约束 |
| --- | --- | --- |
| 1 | head-ban | 强拍锚点 |
| 2 | head-or-final-yan | 由当前循环位置消歧 |
| 3 | middle-yan | 次强拍锚点 |
| 4 | added-ban | 赠板锚点，不是第四拍 |
| 5 | bottom-ban | 句读或停顿候选，不自带固定休止长度 |
| 6 | side-head-or-final-yan | 后半拍位置，由循环消歧 |
| 7 | side-middle-yan | 中眼侧位 |
| 8 | waist-added-ban | 赠板侧位 |

解析层只产生类别；节奏解析器结合 `banshi` 和循环状态求 metric position。

### 10.3 默认拍格

`kunqu-default-v1` 保存：

```json
{
  "banshiMeters": {
    "liushui": { "beats": 1, "beatType": 4 },
    "one-ban-one-yan": { "beats": 2, "beatType": 4 },
    "one-ban-three-yan": { "beats": 4, "beatType": 4 },
    "one-ban-three-yan-added": {
      "beats": 8,
      "beatType": 4,
      "grouping": [4, 4]
    },
    "sanban": { "senzaMisura": true }
  }
}
```

拍格不包含 BPM。没有明确速度时不导出 metronome；只可保留“慢曲、快板”等有出处文字。

### 10.4 有拍量化算法

按区段执行：

1. 将板眼类别按 profile 映射为单调 metric positions；
2. 第一锚点约束音符起点，附着在同音的后续锚点约束持续范围；
3. 验证锚点循环顺序；不合法产生 `BANYAN_CYCLE_CONFLICT`；
4. 先完成已审定叠腔、掇腔等规范 realization，再按板眼音建立抽象时值组；一枚板眼默认开启一个单位，连续板眼增加该组跨度；
5. 当板式已确认、循环合法且通用分配规则唯一命中时，采用 `kunqu-gcn-rhythm-v1`：普通主音权重 1、旁注音权重 0.5，按接近半数的位置递归二分；同一主音及其旁注按 `[1]`、`[3/4,1/4]`、`[1/2,1/4,1/4]` 分配，更多旁注按主音双权重、其余等权；
6. 通用规则唯一得到的 onset/duration 标为 `derived`，`ruleId=kunqu-gcn-rhythm-v1`；若板式或锚点上下文本身为 `inferred`，所有依赖字段继承为 `inferred`；
7. 网站的花腔、罕腔、入声、气口、句尾及腔格特殊模板不属于该通用规则，不得在此阶段命中；
8. 通用规则前提不满足、没有唯一结果或不能闭合时，才进入最简量化：枚举保持顺序、落点和窗口总长的有理时值，并依次最小化不等分数量、连音数量、附点数量和过小音符；
9. 最简量化结果统一为 `inferred`；最优解并列时按稳定规则选择第一解并报告 `RHYTHM_TIE_BROKEN`；
10. 跨小节持续音拆为 tie，不复制歌词；
11. 小节总时值必须闭合。

旁注音默认进入通用分配与兜底量化；只有 profile 明确设为无时值时才从窗口移出并导出 grace note。网站通用分配须以固定源码哈希的测试向量重写，不能在运行时加载远程脚本。

### 10.5 散板

- MusicXML 使用 `senza-misura`；
- 只在经确认句界或区段边界建立隐式容器；
- 音符分配最简正相对时值，全部为 `inferred`；
- 不补齐容器、不生成拍号、不推导 BPM；
- 谱面显示“散板；时值仅供排谱”。

### 10.6 休止

规范休止有且只有两种来源：

1. 已审定腔格明确要求的休止，例如掇腔“顿—休—带”的中间休止；其存在和比例按腔格规则取得 `derived` 状态，具体拍位和时值按上下文取得自己的状态；
2. 已确认有拍区段内，锚点和小节总长共同要求的未占用 metric span；这种缺口休止的存在和长度均为 `inferred`。

以下输入永不单独生成休止：

- `gc=[]`；
- `/`；
- `5` 底板；
- 行、字、工尺或视频的时间间隙；
- 散板容器的剩余空间。

## 11. 歌词、气口、旁注音与腔格

### 11.1 歌词

- 一个唱词字的第一主音带 `lyric/text`；
- 同字后续主音使用 lyric extension；
- 旁注音不重复歌词；
- `gc=[]` 必须由校订清单分类为 `speech / melisma / omission / unresolved`；
- 念白导出为 `direction/words`；
- 前音延唱扩展前一歌词；
- 漏谱必须修订 `raw[]`；
- 未解决文字在谱面保留说明，不造音或休止。

### 11.2 气口与腔格

| 私有码 | IR | 默认 MusicXML |
| --- | --- | --- |
| `/` | `breathAfter` | `breath-mark` |
| `h` | `qiangge: huo` | 中文“豁腔” + `other-ornament` |
| `s` | `qiangge: sou` | 中文“擞腔” + `other-ornament` |
| `d` | `qiangge: die` | 中文“叠腔” + `other-ornament` |
| `c` | `qiangge: duo` | 绿色中文“掇腔” + `other-ornament`；按下述规则展开 |

腔格 realization profile 必须明确：

- 相对音程或音级序列；
- 重复次数；
- 每音时值或占主音比例；
- grace、trill、slide、重复音等 MusicXML 表达；
- 适用曲牌、字调或其他条件；
- 证据来源和版本。

没有完整 realization 时只做名称保真。叠腔与掇腔已有通用 realization，不再等待曲牌级配置：

- 每个 `d` 使前一主音产生一次同音重复；重复音高和次数为 `derived`；
- 每个 `c` 采用“顿—休—带”：前音实唱半拍，中间休止四分之一拍，后续谱面音轻带四分之一拍；结构与 `2:1:1` 比例为 `derived`；
- 中间休止是规范谱事件，不是试听停顿：存在与比例为 `derived`；有拍上下文能唯一定位时使用普通黑色，具体 onset/duration 因散板或不确定上下文而为 `inferred` 时使用橙色，永不使用紫色；
- 前音或“带”音明记的板眼锚点优先于 `2:1:1`，不得为了满足比例移动锚点；比例与锚点不兼容时仍保留“顿—休—带”，将受影响的具体 onset/duration 标为 `inferred` 并输出 `DUOQIANG_ANCHOR_CONFLICT`；
- 若锚点约束下没有容纳正时值中间休止的空间，则保留原有谱面音和绿色“掇腔”标签，不生成零时值/grace rest，也不采用网站同音复制；该 realization 标为 `unresolved` 并输出 `DUOQIANG_NO_METRIC_SPACE`；
- “带”仍是具有正常时值的谱面音，使用正常大小的黑色音符；不得导出为 cue/grace note，也不得因腔格身份染成绿色；绿色只用于“掇腔”文字和 `other-ornament`；
- 绿色“掇腔”与 `other-ornament` 只挂在含 `c` 的“顿”音上并显示一次；中间休止和“带”使用同一个 `realizationId` 回链，不重复文字；即使 realization 为 `unresolved`，标签仍保留在“顿”音；
- `c` 的识别和展开不要求前置 `/`，也不检查唱词字声或是否位于出口；这些信息只可作为传统用法说明，不能成为转换失败条件；
- “带”音解析可跨 `gc` token 和唱词字向前查找，但只在同一已确认乐句与曲牌区段内取下一个谱面音；不得跨越确认句界或曲牌边界；
- 若“带”跨越唱词字，它仍属于前一唱词并写作该字的 lyric extension；下一唱词必须顺延到其后的第一个非“带”主音，不得挂在“带”音上；
- 上述顺延只在被占用唱词自己的剩余工尺音中查找，不得挤占再下一唱词的音；若没有可用主音，输出橙色待校文字和 `DUOQIANG_LYRIC_COLLISION`，不做级联移动；
- 同一前音后若连续出现多个 `c`，只实现第一枚并保留一次绿色标签；其余代码输出 `DUPLICATE_DUOQIANG_CODE`，不得再插休止或继续消耗后续音；
- 有拍上下文能唯一定位时，具体 onset/duration 为 `derived`；散板排谱或上下文不确定时，具体 onset/duration 为 `inferred`；
- `c` 后没有可用的谱面音时，不复制前音，只输出绿色“掇腔”标签和 `DUOQIANG_MISSING_TRAILING_NOTE` 诊断；
- gongchepu.net 为 `c` 生成同音半权重音的行为只可作为兼容试听规则，不进入规范 MusicXML 的音符结构。

### 11.3 当前代码冲突

`src/lib/gongche.js` 当前 `ORN_LABEL` 与已确认码义冲突。实施时必须改为：

```js
export const ORN_LABEL = {
  h: '豁腔',
  s: '擞腔',
  d: '叠腔',
  c: '掇腔',
}
```

该修改只修正显示，不得让 viewer 的展开字段成为转换语义来源。

## 12. MusicXML 4.0 导出契约

### 12.1 基本结构

- 输出 `score-partwise version="4.0"`；
- 每次转换只输出这一份 MusicXML，不提供 conservative/playback/inferred 等多版本文件；
- 首版单声部 `P1`，名称“唱腔”；
- `identification/source` 写传本与校订来源；
- `encoding/software` 写转换器和 profile 版本；
- 有拍区段写 `time`，散板写 `senza-misura`；
- `divisions` 取区段有理时值分母的最小公倍数，并设置可配置上限；
- 无法在上限内精确表示时使用 tuplet，不得浮点四舍五入后静默漂移。
- 不显示工尺字、私有码或原始 `gc.raw`；这些只通过稳定 ID 在 viewer/JSON 中回查。

### 12.2 音符映射

- `absolutePitch` → `pitch/step, alter, octave`；
- 有理时值 → `duration`、`type`、`dot` 和必要 `time-modification`；
- 跨小节 → `tie` 与 `tied`；
- 旁注音 → 小尺寸 `type size="cue"`，但不添加 `cue` 子元素，除非其语义真是 cue；
- 明确无时值旁注音 → `grace`；
- 推定休止 → `rest`；
- 已审定腔格休止 → 带 `realizationId` 来源的普通 `rest`；
- 气口 → `breath-mark`；
- 未展开腔格 → `other-ornament` 和可见中文文字。
- 明记 `h/s/d/c` 的中文腔格名 → 绿色 `other-ornament`，不因已展开而省略；
- 试听效果定位 → 紫色 `direction/words`，使用“气口停顿”“句尾延长”等效果名，不加“试听”二字，也不创建音符或休止。

### 12.3 证据与效果标记

数据层：

- 每个 MusicXML note/rest/direction 使用稳定 `id`；
- `id` 可在 `relative-score.json` 的 `provenanceIndex` 中找到；
- `level` 写紧凑编辑状态，例如 `inferred:pitch,duration`；
- 完整规则、来源和备注只保存在相对谱与校订清单。

可见层：

- 只要一个谱面事件含 `inferred` 字段，就使用统一橙色；
- 首个受影响事件上方写紧凑标签，例如“推:调/时”；
- 连续相同原因可合并为区段标签，避免每音重复；
- 明记腔格名称统一绿色；其实际展开音符仍按自身证据状态显示黑色或橙色；
- 试听层效果统一紫色，只显示效果名，不显示“试听”二字；
- 同一位置同时存在多类信息时，音符颜色由规范证据状态决定，绿色和紫色仅作用于各自文字/记号，不相互覆盖；
- 首页或首小节提供颜色和标签图例；
- `unresolved` 使用不同高对比样式和“未决”文字；
- 颜色不是唯一信息通道，黑白打印仍能通过文字识别。

建议固定字段缩写：

| 标签 | 字段 |
| --- | --- |
| 调 | 笛色、`shangPitch`、调律或移调 |
| 音 | 个别绝对音高 |
| 时 | `onset/duration` |
| 休 | 休止存在或长度 |
| 节 | 小节或拍格 |
| 腔 | 腔格 realization |
| 词 | 歌词归属或分类 |

### 12.4 推定值替换

viewer 确认字段后：

1. 写入校订清单 `overrides[]`；
2. 重新运行完整 pipeline；
3. 对应状态变为 `confirmed`；
4. 可见橙色和字段标签消失；
5. MusicXML ID 保持不变；
6. 新相对谱仍能回到原 `gc.raw` 和确认备注。

### 12.5 试听渲染契约

`gongchepu-playback-2020-v1` 复现网站公开源码中适合试听的行为，但每条规则都必须保存 `ruleId`、源码哈希、来源事件和参数。允许进入 Playback Plan 的效果包括：

- 未明记的花腔、罕腔与入声模板；
- 气口生成的短停顿；
- 同音换字重新发音所需的微停顿；
- 句尾延长与尾部休止；
- 散板 `.1–.9` 等固定播放时值；
- 滑音、约 5 Hz 振音、笛音包络和合成器参数；
- `h/s` 的网站微观展开，以及 `d/c` 相对规范谱之外的兼容发音处理。

这些内容的共同约束：

- 均是播放 realization，不把存在、音高、休止或时值升级为规范谱事实；
- Playback Plan 以规范 beat 为单位，BPM 默认值和秒数不写入 MusicXML；
- `d/c` 已在规范谱生成的实际音符与休止不得被重复添加，试听层只能改变 articulation、gate、envelope 等表演参数；
- 每个效果在 MusicXML 的紫色提示只负责定位，例如“气口停顿”“同音换字”“句尾延长”“滑音”“振音”“花腔模板”；
- 关闭某条试听规则只改变 Playback Plan 与对应紫色提示，不改变 canonical-score hash 中的音乐语义字段。

## 13. 诊断规范

每条诊断包含：

```json
{
  "code": "BANYAN_CYCLE_CONFLICT",
  "severity": "error",
  "message": "板眼序列与一板三眼循环不相容",
  "sourceRef": {},
  "eventIds": [],
  "fieldPath": "sections[2].events[18].anchors",
  "suggestedAction": "检查区段板式或校订原始板眼"
}
```

首版至少实现：

- `BASE_HASH_MISMATCH`
- `CORRECTION_TARGET_MISMATCH`
- `UNKNOWN_GONGCHE_CHARACTER`
- `UNBALANCED_SIDE_NOTE_RANGE`
- `ILLEGAL_REGISTER_COMBINATION`
- `FLATTENED_FIELD_MISMATCH`
- `SECTION_GAP_OR_OVERLAP`
- `TUNING_INFERRED`
- `BANYAN_CYCLE_CONFLICT`
- `RHYTHM_INFERRED`
- `RHYTHM_TIE_BROKEN`
- `REST_INFERRED`
- `DUOQIANG_MISSING_TRAILING_NOTE`
- `DUOQIANG_LYRIC_COLLISION`
- `DUOQIANG_ANCHOR_CONFLICT`
- `DUOQIANG_NO_METRIC_SPACE`
- `DUPLICATE_DUOQIANG_CODE`
- `TEXT_EVENT_UNRESOLVED`
- `QIANGGE_UNREALIZED`
- `MUSICXML_DURATION_OVERFLOW`
- `MUSICXML_UNREPRESENTABLE_EVENT`

CLI 遇 fatal 结构错误返回非零；只有 warning/error 级音乐推定时仍写出 artifacts，并在摘要中报告数量。

## 14. 《寻梦》首个校订夹具

### 14.1 基础事实

- 当前 `src/data/viewerModel.json`：91 行、427 字、790 个 `gc` symbols；
- 上游经比对数据：796 个 symbols；
- 缺失块位于“杨”字，内容：

```text
工3 六2/ 五46 六 工3/ 上+2d
```

- 经审校《粟庐曲谱》显示【懒画眉】为六字调，【忒忒令】切换为小工调；
- 当前播放投影没有完整曲牌区段、笛色与板式字段，必须由校订清单补入；
- `gc=[]` 的字必须逐项分类，不能批量当休止。

### 14.2 首个校订任务

1. 计算并固定当前基础 JSON 的 SHA-256；
2. 用 `lineId + charIndex + expectedChar` 精确定位“杨”；
3. 添加六音修订及《粟庐曲谱》来源；
4. 依据歌词与底本建立全曲曲牌区段；
5. 给明确标题填写笛色，其余按承接优先级解析；
6. 给每段填写板式；不能确认的使用 profile 推定并标记；
7. 分类所有 `gc=[]` 文字；
8. 对当前所有 `raw` 运行 lexer/parser；
9. 生成 796 音的经校订源与相对谱；
10. 导出带推定标记的 MusicXML 和诊断摘要。

不得只为通过 796 计数而按时间位置插入六音；修订必须依 source reference 和 expected character 生效。

## 15. 测试策略

采用 Vitest，与现有 Vite 工具链一致。测试分四层。

### 15.1 词法与语法单元测试

必须覆盖研究文档中的边界及以下例：

| 输入 | 断言 |
| --- | --- |
| `上尺工凡六五乙` | 中音区 1..7 |
| `合四一` | 低八度 5..7 |
| `工- 上+` | 音区偏移 |
| `上+2s` | 音高、锚点和擞腔顺序 |
| `四2/（` + 下一 token `尺d）` | 跨 token 旁注范围 |
| `六1676` | 一个音、四个有序锚点 |
| `尺2c上` | 掇腔；规范结构为尺（顿）—休—上（轻带），不得复制尺 |
| `尺2c上7` | `上` 保持在 `7` 锚点；比例冲突时标橙并报告 `DUOQIANG_ANCHOR_CONFLICT` |
| 锚点间无正时值空间 | 原音与绿色标签保留，不生成休止，报告 `DUOQIANG_NO_METRIC_SPACE` |
| `尺2cc上` | 只实现一次掇腔，并报告 `DUPLICATE_DUOQIANG_CODE` |
| `gc=[]` | 无音符、无休止 |
| 未知字符 | fatal 且带准确 offset |
| 未闭合括号 | fatal |

### 15.2 规则与属性测试

- 修改所有 `s/e` 后，音乐 IR 和 MusicXML 保持字节相同；
- 修改或删除 `b/r/p/bt/o/q` 后，音乐 IR 和 MusicXML 保持相同，只改变诊断；
- 相同输入重复运行得到相同 ID 和输出顺序；
- 每个有拍小节时值严格闭合；
- 锚点 metric positions 单调；
- 所有 `inferred` 字段都有 `ruleId` 或说明；
- 所有 `confirmed` 字段都有 evidence 或人工备注；
- 所有 MusicXML ID 都能回链 IR；
- 每个 IR source range 都能切回原 `gc.raw`。
- 满足 `kunqu-gcn-rhythm-v1` 前提的窗口产生 `derived` onset/duration；破坏任一前提后稳定回退为 `inferred`；
- 切换 Playback Plan profile 不改变 canonical score 的音符、休止、拍位、时值和音高；
- 紫色提示不会增加 MusicXML note/rest 或改变 measure duration；
- MusicXML 中不出现工尺字或 `gc.raw`，但所有事件仍可由 ID 回查。

### 15.3 《寻梦》集成测试

- 未应用校订清单时报告缺漏，不伪造“杨”字音；
- 应用校订清单后总数为 796；
- 修复序列严格等于 `工3 六2/ 五46 六 工3/ 上+2d`；
- 【懒画眉】和【忒忒令】处发生区段定调解析；
- 默认未知定调为 `上=D4` 且状态 `inferred`；
- 旁注音有正 duration，除非 fixture 明确覆盖为 grace；
- `/h/s/d/c` 分别导出正确名称，`c` 的规范名称为“掇腔”；
- `c` 无须前置 `/`，也不读取字声或出口位置即可展开；
- `c` 不按网站试听算法生成同音复制，缺少后续谱面音时给出诊断；
- 连续多个 `c` 只实现第一枚，其余报告 `DUPLICATE_DUOQIANG_CODE`；
- 掇腔时值比例不得移动明记板眼；不兼容时报告 `DUOQIANG_ANCHOR_CONFLICT`；
- 掇腔没有正时值休止空间时不得输出零时值/grace rest，局部 realization 为 `unresolved`；
- 掇腔“带”音保持正常黑色、正常大小和正 duration，绿色只用于腔格标签；
- 掇腔中间休止进入规范 MusicXML：确定时为黑色，具体拍位或时值推定时为橙色，不得标成紫色试听效果；
- 掇腔标签只在“顿”音显示一次，休止和“带”仅以 `realizationId` 关联；
- 掇腔“带”音可跨 token 与唱词字解析，但不跨确认句界或曲牌边界；
- 跨字“带”音延唱前字，后一唱词从其后的非“带”主音开始；
- 跨字“带”造成的歌词顺延不得越过该唱词自己的工尺范围；无落点时输出 `DUOQIANG_LYRIC_COLLISION`，且后续歌词保持原位；
- MusicXML 包含推定图例、可见标签和稳定 ID；
- MusicXML 仅有五线谱：橙色推定、绿色腔格、紫色试听效果按各自范围显示；
- 生成唯一 `score.musicxml` 和独立 `playback-plan.json`，两者使用稳定来源 ID 对齐；
- 全曲时间戳随机化不改变谱面输出。

### 15.4 MusicXML 验证

- 固定 MusicXML 4.0 XSD、catalog 和所需 schema 文件到 `tests/vendor/musicxml-4.0`，记录上游 URL 与版本；
- 生成文件必须通过 XML well-formed 校验；
- 在可用环境用 `xmllint` 对官方 XSD 校验；
- 测试 additionally 解析 XML，断言 measure、duration、tie、lyric、`senza-misura`、`other-ornament`、`breath-mark` 和 ID；
- 至少用 MuseScore 或另一兼容应用手工打开一次《寻梦》fixture，记录版本与截图/检查结果；这属于发布验收，不放入自动测试。

## 16. 实施里程碑

### M0：测试与 schema 基础

文件：

- 修改 `package.json`：增加 `test`、`test:watch`、`score:convert`、`score:validate`；
- 增加 Vitest 和 Ajv（JSON Schema 校验）依赖；
- 新建 `src/score/schema/*`、`tests/score/schema.test.js`。

验收：

- `npm test` 可运行；
- review manifest、reviewed source、relative score、canonical score 与 Playback Plan 都有版本化 schema；
- 非法证据状态、空 confirmed evidence、错误 source target 会失败。

### M1：校订编译与稳定 ID

文件：

- `src/score/evidence.js`
- `src/score/ids.js`
- `src/score/diagnostics.js`
- `src/score/review/compileReview.js`
- `src/score/review/applyOverrides.js`

验收：

- base hash 和目标字符防漂移；
- 修订、区段、分类和 overrides 可编译；
- 输出 reviewed source 确定性稳定；
- 不读取时间戳构造音乐事实。

### M2：`gc.raw` 解析与相对谱

文件：

- `src/score/gongche/lexer.js`
- `src/score/gongche/parser.js`
- `src/score/gongche/pitch.js`
- `src/score/gongche/banyan.js`
- `src/score/pipeline.js`

验收：

- 全部当前 raw 与测试向量可解析；
- 跨 token 括号正确；
- 字段展开差异只报告、不影响结果；
- 生成含 source ranges 和稳定 ID 的相对谱。

### M3：曲牌上下文、定调和节奏

文件：

- `src/data/profiles/kunqu-default-v1.json`
- `src/score/resolve/sections.js`
- `src/score/resolve/tuning.js`
- `src/score/resolve/rhythm.js`
- `src/score/resolve/rests.js`
- `src/score/resolve/lyrics.js`
- `src/score/resolve/qiangge.js`

验收：

- 区段优先级和承接状态正确；
- 默认 `上=D4`；
- 五类板式按固定拍格输出；
- 锚点冲突被诊断；
- `kunqu-gcn-rhythm-v1` 唯一命中时产生 `derived` 时值，前提不足时稳定回退最简量化；
- 叠腔和掇腔生成规范事件，腔格休止与缺口休止来源不混淆；
- 散板、休止、旁注音和无工尺文字符合已确认规则。

### M4：唯一 MusicXML、Playback Plan 与 CLI

文件：

- `src/score/musicxml/xml.js`
- `src/score/musicxml/duration.js`
- `src/score/musicxml/inferenceMarks.js`
- `src/score/musicxml/playbackMarks.js`
- `src/score/musicxml/exporter.js`
- `src/score/playback/renderPlayback.js`
- `src/score/playback/markerProjection.js`
- `src/data/profiles/gongchepu-playback-2020-v1.json`
- `scripts/score-convert.mjs`
- `scripts/score-validate.mjs`

CLI：

```sh
npm run score:convert -- \
  --viewer src/data/viewerModel.json \
  --review src/data/reviews/xunmeng.review.json \
  --out artifacts/xunmeng
```

预期输出：

```text
artifacts/xunmeng/
  reviewed-source.json
  relative-score.json
  canonical-score.json
  score.musicxml
  playback-plan.json
  diagnostics.json
```

验收：

- MusicXML 4.0 结构合法；
- 只生成一份 MusicXML，Playback Plan 不可导出第二份谱；
- 所有推定可见且可回链；
- 绿色腔格与紫色试听标记可定位，紫色标记不改变谱面事件；
- CLI fatal 返回非零，非 fatal 推定仍产出文件；
- 同输入输出字节稳定。

### M5：《寻梦》完整 fixture

文件：

- `src/data/reviews/xunmeng.review.json`
- `tests/fixtures/xunmeng/*`
- `tests/score/xunmeng.integration.test.js`

验收：

- “杨”字六音有出处地补齐；
- 总数 796；
- 曲牌、笛色、板式和 `gc=[]` 分类完整；
- 生成全曲相对谱和推定五线谱；
- MusicXML 可由目标制谱软件打开。

### M6：viewer 审阅闭环

文件：

- `src/components/ScoreReviewPanel.vue`
- `src/composables/useScoreReview.js`
- 修改 `src/App.vue`；
- 修改 `src/lib/gongche.js` 的腔格显示标签；
- 增加浏览器下载辅助模块和组件测试。

功能：

- 显示 confirmed、derived、inferred、unresolved 数量；
- 按字段、区段、诊断和证据状态筛选；
- 选中条目后显示 `gc.raw`、来源位置、规则、出处和备注；
- 编辑已有值、改为人工确认、添加证据备注；
- 即时重新运行 pipeline；
- 下载相对谱、MusicXML、诊断和新版校订清单；
- 下载 canonical score 与 Playback Plan，并可独立开关试听 profile；
- 页面刷新前提示尚未下载的本地修改。

验收：

- 浏览器和 CLI 对同一输入生成语义相同输出；
- 确认一项推定后，其谱面标记消失，其他推定不受影响；
- 下载并重新载入校订清单后结果一致；
- viewer 视频功能和虚拟时钟行为不回归。

## 17. 推荐提交切片

为降低审查风险，按以下顺序提交：

1. `schema + evidence + diagnostics`；
2. `review compiler + stable IDs`；
3. `gongche lexer/parser + relative pitch`；
4. `section/tuning profiles`；
5. `banyan/rhythm/rests`；
6. `lyrics/side notes/qiangge`；
7. `canonical score + MusicXML exporter`；
8. `Playback Plan + purple marker projection`；
9. `CLI + Xunmeng manifest + integration fixture`；
10. `viewer review loop`。

每个切片必须带测试；不得先写 UI 再把语义逻辑留在组件中。

## 18. 完成定义

整个计划完成时，必须同时满足：

- [ ] `npm test` 全部通过；
- [ ] `npm run build` 通过；
- [ ] 当前所有 `gc.raw` 及补齐后的 796 音被无损解析；
- [ ] 修改时间戳不会改变相对谱或 MusicXML；
- [ ] 修改展开字段不会改变音乐结果；
- [ ] 《寻梦》曲牌区段、笛色、板式和文字分类都在校订清单中，不在代码中；
- [ ] 相对谱所有可推定字段都有四级证据状态；
- [ ] 默认缺调门时使用 `上=D4` 且明确标为推定；
- [ ] 有拍小节闭合，散板使用 `senza-misura`；
- [ ] 通用有拍规则唯一命中时为 `derived`，仅在前提不足时回退 `inferred` 最简量化；
- [ ] `/=气口、h=豁腔、s=擞腔、d=叠腔、c=掇腔` 映射正确，“撮腔”仅作兼容别名；
- [ ] 掇腔不以前置气口、字声或出口位置为条件，并按“顿—休—带”导出；
- [ ] 未实现腔格不被展开为虚构音符；
- [ ] `gc=[]` 不产生自动音符或休止；
- [ ] 每个 MusicXML 推定都有可见标签和 ID 回溯；
- [ ] 只生成一份纯五线谱 MusicXML，不显示工尺字；
- [ ] 绿色只标明记腔格，紫色只标试听效果且不出现“试听”二字，橙色只标规范谱推定；
- [ ] Playback Plan 与 MusicXML 用稳定 ID 对齐，但切换试听规则不改变规范音符、休止、拍位或时值；
- [ ] MusicXML 通过结构验证并能在目标制谱软件打开；
- [ ] CLI 可批处理其他同格式曲谱；
- [ ] viewer 可修改、确认、重导出并下载校订清单；
- [ ] `src/score` 不含《寻梦》曲目特判。

## 19. 实施时仍需采集、但不阻塞开工的资料

以下内容进入《寻梦》校订清单，而不是改变通用设计：

- 全曲每个曲牌的精确 source boundary；
- 每段明确或承接的笛色；
- 每段板式、起板、底板和小节起点；
- 所有 `gc=[]` 的文字分类；
- 可由谱师确认的休止长度；
- 豁腔、擞腔及其他尚未审定腔格的曲牌级 realization；
- 实际演出相对传本的移调或传统调律 profile。

资料缺失时仍按本文规则生成推定五线谱；补齐后只更新校订清单或转换配置并重新导出。
