# 昆曲工尺谱严格读法与 `viewerModel.json` 转五线谱方案

> **后续产品决定（2026-08-03）**：本文研究阶段采取“不确定即拒绝完整导出”的保守结论。后续逐项审议决定改为输出带字段级证据状态和回溯链的推定五线谱：可以用明确标记的最佳推定补齐音高、时值及休止，但不得伪装成确认值。最终执行以 [`CONTEXT.md`](../../CONTEXT.md) 和 [`docs/adr/`](../adr/) 为准；本文仍保留原始证据边界。

> 研究日期：2026-08-03
>
> 结论适用范围：本仓库当前的《牡丹亭·寻梦》`viewerModel.json`，以及同一套 GCN 私有文本编码。本文讨论的是“从谱面信息生成现代记谱”，不是从演出录音反推演唱实况；按要求，不把每个工尺字的秒级 `s/e` 当作音符时值。

## 结论先行

1. **工尺字能机械转换为相对音级，但不能仅凭当前 JSON 确定 concert pitch。** 正式地方标准把中音区 `上尺工凡六五乙` 对应为相对 `1 2 3 4 5 6 7`；低、高音区另有字形规则。要落到五线谱的 C、D、E 和具体八度，仍须给出笛色/调门、`上` 的绝对音高、律制或调律基准。传统笛色与西乐调名只是近似，不应暗中硬编码为十二平均律。[DB3205/T 1172—2025，附录 B，PDF 第 14–16 页，B.2–B.4](https://scjgj.suzhou.gov.cn/szqts/cszhfwbzh/202503/ad42362b76774dc1b5d80246d4400234/files/b2c4450ce7654d1f81326a2f6cb62a8b.pdf)
2. **板眼标记是节拍位置，不是“这个音有几秒”。**`bt="3656"` 不是时长数字 3656，而是四个按原顺序附着于该音的板眼事件。必须先知道该段板式（流水板、一板一眼、一板三眼、带赠板、散板等），再把事件安放到拍格；板眼之间未标出的音如何细分，也需要明确规则或人工校订。[《昆曲工尺谱记谱符号》征求意见稿，正文第 1、3–4 页，§§3.4、4.2–4.3](https://www.ttbz.org.cn/upload/file/20241231/6387124078379176658257744.pdf)
3. **忽略 `s/e` 是正确的，甚至是必须的。**公开上游导入器曾按一个唱字的时段把多个工尺 token 等分配时间；这些秒数服务于视频同步，不是传统谱的时值证据。[上游 `App.tsx` 固定版本，导入实现](https://github.com/ZhengTong11111/Xiqu-Annotation-System/blob/7351eeec7178310420b2e007d43b5e46379fb8e5/src/App.tsx#L6874-L7135)
4. **当前文件不能直接生成“完整、可演奏”的全曲五线谱。**它缺少调门、板式区段、拍号/小节、速度、休止、正衬字、装饰音实现规则；并且与公开上游标注逐项比对后，当前文件至少漏掉 1 个完整工尺块、共 6 个音。应允许导出“相对音高骨架”，但完整谱导出必须 fail closed，不得猜。
5. **转换时必须重新词法分析每个 `raw`，不能只读 `b/r/p/bt/o/q`。**结构化字段丢失了板眼与腔格的交错顺序，也不能可靠保存跨 token 的括号范围。`raw` 是当前唯一可作权威回退的字段。

## 证据层级与使用边界

| 层级 | 来源 | 本文如何使用 |
| --- | --- | --- |
| A：正式现行标准 | [DB3205/T 1172—2025《苏式传统文化 昆曲清唱艺术传承指南》](https://scjgj.suzhou.gov.cn/szqts/cszhfwbzh/202503/ad42362b76774dc1b5d80246d4400234/files/b2c4450ce7654d1f81326a2f6cb62a8b.pdf)，2025-02-26 发布、03-04 实施 | 工尺三类信息、音区、七笛色及其与西乐调名“近似”关系的首要依据。 |
| B：标准草案 | [中国标准化协会《昆曲工尺谱记谱符号》征求意见稿](https://www.ttbz.org.cn/upload/file/20241231/6387124078379176658257744.pdf)，正文 §§3–6 | 板眼、板式、气口、带腔、擞腔、叠腔、豁腔的详细定义。它带有“内部讨论资料”水印且不是正式发布文本，因此只作高可信解释材料，不覆盖 A。 |
| C：历史一手谱面 | [哈佛燕京图书馆藏清末《昆曲工尺谱选钞》，馆藏说明与 51 页扫描](https://commons.wikimedia.org/wiki/File:Harvard_drs_435762853_%E6%98%86%E6%9B%B2%E5%B7%A5%E5%B0%BA%E8%AD%9C%E9%81%B8%E9%88%94.pdf) | 复核“曲词为主、工尺小字旁缀、板眼与工尺共同出现”的实际谱面，不用单一古谱倒推出通用时值算法。 |
| D：本数据格式的一手源码 | [Xiqu-Annotation-System 固定提交](https://github.com/ZhengTong11111/Xiqu-Annotation-System/tree/7351eeec7178310420b2e007d43b5e46379fb8e5)；本仓库 [`viewerModel.json`](../../src/data/viewerModel.json)、[`gongche.js`](../../src/lib/gongche.js) | 解释 `1..8`、`h/s/d/c`、括号、`/` 等**私有序列化代码**。源码定义不是昆曲音乐学规范，两者必须分开。 |
| E：项目人工确认 | 2026-08-03 至 2026-08-04 的格式与实现审定 | 确认私有码 `/=气口`、`h=豁腔`、`s=擞腔`、`d=叠腔`、`c=掇腔`（撮腔为别名）；叠腔和掇腔已有审定 realization，其他腔格的具体西乐展开仍须配置。 |
| E：既有机器转换先例 | [CN111274771A《一种可用于转换昆曲工尺谱的简谱编码方式》权利要求与说明书](https://patents.google.com/patent/CN111274771A/zh) | 证明可以在给定量化假设后构造确定算法；不把其“一板三眼量化为 16 个四分之一拍单位”等专利方案当成昆曲唯一正确读法。 |
| F：目标交换格式规范 | [W3C MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/) | 定义五线谱交换数据的音高、拍号、时值、装饰和歌词落点。 |

## 一、严格读谱规则

### 1. 阅读顺序与“一字多腔”

传统昆曲宫谱以曲词为主，工尺旁缀于唱字；草案列出蓑衣谱、玉柱谱、一字谱三种书写样式（§7）。转换当前 JSON 时，不再从二维版面猜阅读方向：**严格保持 `lines[] → chars[] → gc[]` 的数组次序，绝不按秒级 `s` 重排**。

- 一个 `char.ch` 下有多个工尺 token，是一个唱字上的连续行腔，即五线谱中的一字多音/melisma。
- 第一个实际发音的主音承载歌词；后续主音用歌词延长线。MusicXML 可用 [`lyric`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/lyric/) 与 [`extend`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/extend/) 表示。
- `gc=[]` 只表示“当前 viewer 没有工尺数据”，**绝不等同休止**。本文件已有漏块实例，证明把空数组译成休止会制造假谱。
- `st="念白式"` 可作为“不要生成确定音高”的路由提示；它没有规定念白的节奏或音域，不应生成伪音符。
- 当前模型没有“正字/衬字”字段。仅凭歌词字面不能可靠判断衬字；必须新增 `lyricRole: zheng | chen | spoken | unknown`，或保留为 `unknown` 等人工校订。

### 2. 工尺字、音区与相对音级

正式地方标准说明：工尺谱由工尺字（音高）、板眼（时值）、腔格（行腔口法）三类信息组成；中音区基本音阶为 `上尺工凡六五乙`，低音区由基本字末笔向左下撇，高音区在字左加单立人；`合、四、一` 分别是低音 `六、五、乙` 的专用写法。[DB3205/T 1172—2025，PDF 第 14–15 页，B.2–B.3](https://scjgj.suzhou.gov.cn/szqts/cszhfwbzh/202503/ad42362b76774dc1b5d80246d4400234/files/b2c4450ce7654d1f81326a2f6cb62a8b.pdf)

先建立不含绝对调高的音级坐标，以中音 `上` 为 0：

| 工尺 | 相对唱名 | 十二平均律导出时的半音偏移* |
| --- | ---: | ---: |
| 上 | 1 | 0 |
| 尺 | 2 | 2 |
| 工 | 3 | 4 |
| 凡 | 4 | 5 |
| 六 | 5 | 7 |
| 五 | 6 | 9 |
| 乙 | 7 | 11 |

\* 半音列只是在用户明确选择现代十二平均律导出时使用；传统昆曲律制与西乐并非等同。

音区规则：

- `r=0`：基本中音区；但 `合/四/一` 是低音区 `六/五/乙` 的别名，其相对半音为 `-5/-3/-1`。
- `r=-1`：基本字低一八度，例如当前数据的 `工-` 为相对 `-8` 半音。
- `r=1`：基本字高一八度，例如 `上+` 为 `+12` 半音。
- `合/四/一` 再叠加 `r=-1`，或其他没有标准字形依据的组合，应报验证错误，不能静默“双降八度”。

### 3. 凡、乙、清角、变宫与所谓“变音”

在以上七声音阶坐标中，`凡` 是第 4 级，`乙` 是第 7 级；若把 `上` 当宫音描述，音乐学上常可分别谈作清角、变宫。然而这些是**调式功能名称，不是可以无上下文机械加上的升降号**：

- 不得把所有 `凡` 一律写成 `♯4`，也不得把所有 `乙` 一律写成 `♭7`。
- `合/四/一` 是音区别字，不是临时升降音。
- 宫调/曲牌规定旋律与调式组织，笛色规定实际调门；二者不能互相替代。
- 如果具体传本或演唱采用与十二平均律不同的清角、变宫音高，当前 JSON 没有 accidental、微分音偏移或律制字段，无法恢复。必须新增 `scaleProfile`（每级 cents/`alter`）或由校订者指定。

因此，现阶段最安全的内部值是“音级 + 音区”，而不是提前拼成 C♯/B♭。

### 4. 笛色、调门、宫调与 concert pitch

地方标准 B.4 把笛色视为调门，列七调，并给出现代近似：上字调≈B♭、尺字调≈C、小工调≈D、凡字调≈E♭、六字调≈F、正宫调≈G、乙字调≈A；同页明确警告中西乐律并不相同，传统笛色与西乐调高只是近似。[DB3205/T 1172—2025，PDF 第 15–16 页，B.4 表 B.1–B.2](https://scjgj.suzhou.gov.cn/szqts/cszhfwbzh/202503/ad42362b76774dc1b5d80246d4400234/files/b2c4450ce7654d1f81326a2f6cb62a8b.pdf)

所以导出 concert pitch 至少要显式提供：

```text
tuning.dise              = shangzi | chizi | xiaogong | fanzi | liuzi | zhenggong | yizi
tuning.shangPitch        = 例如 D4（不能只存“D调”）
tuning.temperament       = traditional-profile-id | 12-TET
tuning.referenceHz       = 例如 A4=440（可选但应明确）
tuning.performanceShift  = 演员/笛师实际移调（默认 0，不能靠猜）
```

七笛色对照只能作为录入建议和一致性校验；没有 `shangPitch` 时只能输出相对音高骨架，不能声称得到绝对五线谱。

### 5. 板眼、赠板、板式、延长与休止

标准草案定义强拍为板、次强或弱拍为眼，板和眼都以一拍为单位（§3.4）；并区分流水板、一板一眼、一板三眼、一板三眼加赠板、散板（§4.3）。表 3 还区分与乐音同时发出的头板/中眼/小眼，与后半拍起唱有关的侧位符号，以及用于停顿或散板句读的底板。[征求意见稿，正文第 1、3–4 页，§§3.4、4.2–4.3](https://www.ttbz.org.cn/upload/file/20241231/6387124078379176658257744.pdf)

当前 `bt` 的 `1..8` 不是传统谱字，而是上游软件的私有码。源码当前解释如下：[上游 `banyan.ts` 固定版本](https://github.com/ZhengTong11111/Xiqu-Annotation-System/blob/7351eeec7178310420b2e007d43b5e46379fb8e5/src/utils/banyan.ts#L161-L285)

| 私有码 | 上游实现名 | 读谱用途 | 证据边界 |
| --- | --- | --- | --- |
| `1` | 正板/头板 | 强拍锚点 | 与草案头板符号交叉相符 |
| `2` | 小眼（头末眼） | 弱拍锚点 | 同一符号在循环内是头眼还是末眼须靠板式位置 |
| `3` | 中眼 | 次强拍锚点 | 与草案中眼相符 |
| `4` | 赠板 | 新增板锚点 | 不是“第 4 拍” |
| `5` | 底板 | 句逗、停顿/休止相关 | 不能自动等同固定长度休止符 |
| `6` | 侧头末眼 | 后半拍位置 | 精确是头眼还是末眼仍由循环上下文决定 |
| `7` | 侧中眼 | 中眼的侧位/后半拍位置 | 需板式确定 metric offset |
| `8` | 腰赠板 | 后半拍赠板 | 需板式确定 metric offset |

严格实现规则：

- `bt` 内多个数字按源顺序是多个板眼锚点；附着在同一工尺字上的多个锚点通常说明该音跨过这些位置，不是重复发音。
- 一个板眼符号与乐音同时出现时，标记的是 onset/经过的拍位；侧位符号说明后半拍关系。它们仍不足以自动说明同一锚区间内多个无标音的精确分值。
- 赠板不是普通小节线，也不是数字 `4` 所暗示的“第四拍”；必须由 `meterSection.cycleType` 解释。
- 散板只在句末以底板表示停顿或休止，其余不点板眼（草案 §4.3.5）。没有散板区段标记时，不能从缺少 `bt` 推断自由节奏。
- `/` 是气口，不是休止。气口可落在持续音末或音间，但休止的长度仍未给出。
- 当前格式没有独立 rest token。时间轴中的空隙在忽略秒数后也不能转成休止。

CN111274771A 提供过一种机器量化先例：把一板三眼的 4 拍细分为 16 个四分之一拍单位，再根据当前板眼定位、连续无板眼工尺数等分配音值。[专利权利要求 1 及说明书“工尺音长值转换”](https://patents.google.com/patent/CN111274771A/zh) 这可以作为测试 profile，但它是实现方案而非昆曲唯一规范；本项目缺少板式区段时，不得默认套用。

### 6. 气口、旁注音与腔格

草案 §5 给出以下读法：[征求意见稿，正文第 5–6 页，§§5.1–5.6](https://www.ttbz.org.cn/upload/file/20241231/6387124078379176658257744.pdf)

- 气口写在谱字左下，表示吸气时机。
- 带腔以较小工尺字旁注，必须轻灵；它仍是行腔的一部分，不能因为字小就一律译成无时值 grace note。
- 擞腔相当于装饰性的颤音。
- 叠腔是同音反复，一次至最多三次反复；若要写成实际音符，必须知道重复次数和节奏。
- 豁腔专用于去声字，首音后出现高一度以上的上倚音，一般高一级或二级，并须滑进而非跳进。
- 掇腔含“顿”和“带”两部分；草案给出半拍实音、四分之一拍轻带、四分之一拍休止的示例性现代记法。

本私有码通过 `/`、括号及 `h/s/d/c` 渲染这些信息；[`gongche.js`](../../src/lib/gongche.js) 与[上游 renderer](https://github.com/ZhengTong11111/Xiqu-Annotation-System/blob/7351eeec7178310420b2e007d43b5e46379fb8e5/src/components/GongcheCharacterRenderer.tsx)证明：`/` 附着到前一主音，括号形成 side note，`h/s/d/c` 被渲染为独立腔格 glyph。项目已进一步人工确认 `/=气口`、`h=豁腔`、`s=擞腔`、`d=叠腔`、`c=掇腔`；“撮腔”和源码标识 `cuoqiang` 作为兼容别名。后续审定又确定：`c` 按草案的“顿—休—带”与 `2:1:1` 比例展开，且不以前置气口、字声或出口位置为执行条件；这些草案所述语境仅作传统用法说明。其他没有审核过的 realization 仍不能擅自展开成某种西乐装饰音。

此外，顶层“腔格轨”只有秒级区段，没有稳定的工尺 token ID 外键；在不使用时间戳时无法把“滑音、豁腔、擞腔、橄榄腔”等 block 确定挂到某个音。要进入五线谱必须先新增 `linkedGongcheSymbolIds`。

## 二、`viewerModel.json` 逐字段审计

### 1. 规模与完整性

当前文件共有：

- 91 个 `lines`；427 个 `chars`；
- 277 个唱字带非空 `gc`；790 个 `gc` symbols；
- 工尺基字实际只出现 `合、四、上、尺、工、六、五`；`r ∈ {-1,0,1}`；
- `bt` 是 `1..8` 的拼接；`o` 是 `h/s/d/c` 的拼接。

与公开[上游标注文件 `新工尺_央视_顾卫英《寻梦》.merged.cleaned.json`](https://github.com/ZhengTong11111/Xiqu-Annotation-System/blob/7351eeec7178310420b2e007d43b5e46379fb8e5/examples_insights/%E6%96%B0%E5%B7%A5%E5%B0%BA_%E5%A4%AE%E8%A7%86_%E9%A1%BE%E5%8D%AB%E8%8B%B1%E3%80%8A%E5%AF%BB%E6%A2%A6%E3%80%8B.merged.cleaned.json)比对：上游有 278 个工尺 annotations、796 个 symbols；当前 viewer 少 1 块、6 音。缺块挂在 `line-36-char-1`，内容为：

```text
工3 六2/ 五46 六 工3/ 上+2d
```

它对应 viewer 中约 265–273 秒、现为 `gc=[]` 的“杨”字附近。由此得到两条硬约束：

1. 当前文件不能声称可导出完整全曲谱；
2. 任何 `gc=[]` 都不得自动生成休止。

### 2. 字段能力表

| 路径/字段 | 当前语义 | 不看 timestamp 后是否有用 | 转谱结论 |
| --- | --- | --- | --- |
| `meta.title/performer/source` | 作品与来源 | 是 | 写入 work/identification；不提供音乐参数 |
| `meta.video/span` | 媒体与播放范围 | 否（谱面转换） | 可进独立 provenance/alignment sidecar，不进音符时值 |
| `lines[].id/text` | 句标识和全文 | 是 | 保持顺序、校验 `text == chars.ch` 拼接 |
| `lines[].s/e` | 视频同步 | 否 | 禁止用于 duration |
| `chars[].ch` | 唱词字 | 是 | 歌词对齐基础 |
| `chars[].st` | `普通唱`/`念白式` | 部分 | 可阻止给念白造固定音；不足以决定正衬、节奏 |
| `chars[].s/e` | 视频同步 | 否 | 禁止用于 duration |
| `chars[].gc[]` | 该字工尺序列 | 是 | 主要输入；数组顺序即读谱顺序 |
| `gc.b` | 基工尺字 | 是 | 相对音级 |
| `gc.r` | `-1/0/1` 音区 | 是 | 相对八度；须验证合法组合 |
| `gc.p` | 单 token 旁注标志 | 不可靠 | 跨 token 括号会丢失，不能单独采用 |
| `gc.bt` | 板眼数字集合的拼接 | 不充分 | 丢失与腔格的交错顺序；只可作校验 |
| `gc.o` | 腔格字母集合的拼接 | 不充分 | 同上；码义已确认，但展开字段仍丢失与其他记号的交错顺序 |
| `gc.q` | 是否出现 `/` | 部分 | 仅布尔值，丢失 `/` 在 token 内的位置 |
| `gc.raw` | 原始私有谱文片段 | **是，且为主** | 必须重新词法分析并保留原顺序 |
| `gc.s/e` | 视频同步/导入等分 | 否 | 禁止用于 duration |
| `breaths[].t` | 演出气息打点 | 否（无外键时） | 不能靠时间挂到音；`gc.raw` 内 `/` 仍可用 |
| `tracks[]` | 腔格、动作等时间轨 | 否（无外键时） | 不能靠重叠秒数转成谱面装饰；动作本就不属音符 |

### 3. `raw` 为什么必须优先

扁平字段不可逆，已有三个具体反例：

```text
raw = 上3dd2       -> bt="32",  o="dd"       # 丢失 3,d,d,2 的交错顺序
raw = 六2/d4dd2    -> bt="242", o="ddd",q=true # 丢失 / 与 d/4/d/d/2 的相对位置
raw tokens = 四2/（  +  尺d）                  # p 均可能为 false；括号跨 token 才能恢复旁注范围
```

因此不能由 `{b,r,p,bt,o,q}` 重建权威谱文。转换器应把同一唱字的所有 `gc.raw` 串按顺序送入一个有括号状态的 lexer，同时保留每个源 token 的边界；结构化字段只用于双向核验。

## 三、可机械、需上下文、不可恢复

| 信息 | 分类 | 原因/处理 |
| --- | --- | --- |
| `lines/chars/gc` 的先后次序 | 可机械转换 | 直接按数组顺序，禁止按 `s` 排序 |
| 工尺基字到相对 1–7 | 可机械转换 | 依 DB3205/T 1172 B.3 |
| `r` 与 `合/四/一` 的相对音区 | 可机械转换（需合法性校验） | 转为相对音级/八度 |
| 私有码 `1..8` 的符号类别 | 可机械解析 | 依固定版本源码；仍只是类别，不等于最终时值 |
| `/`、括号、`h/s/d/c` 的源顺序 | 可机械解析 | 必须从 `raw` 词法分析；码义分别为气口、豁腔、擞腔、叠腔、掇腔（撮腔为别名） |
| 一字多腔与歌词延长 | 可机械转换 | 同一 `char` 内主音顺序可确定 |
| 绝对音高、谱号和调号 | 需调门/调律上下文 | 当前无笛色、`上` 的 concert pitch、律制 |
| 凡/乙的具体调式功能与微分音 | 需全曲/宫调/传本上下文 | 不可由字形自动决定升降号 |
| 板眼循环、拍号、小节线 | 需板式区段上下文 | 当前顶层无曲牌/板式/拍号 |
| 无板眼音在锚点间的细分时值 | 需明确 rhythm profile 或人工校订 | 私有码不直接给出全部 onset/duration |
| 赠板、底板的具体长度 | 需区段上下文 | 赠板依板式，底板可为停顿/散板句读 |
| `p` 旁注音是 grace 还是有时值带腔 | 需腔格规则 | 字小不等于无时值 |
| 豁/擞/叠/掇等实际小音符 | 需字调、腔格参数和校订 | 符号描述程式，未给完整微观音列与时值 |
| 正字/衬字 | 现有数据不可恢复 | 没有角色字段 |
| 独立休止及其长度 | 现有数据不可恢复 | 没有 rest token；空 `gc` 还可能是漏标 |
| 时间轨腔格与具体工尺音的关联 | 忽略 timestamp 后不可恢复 | 没有稳定外键 |
| 缺失的“杨”字 6 音 | 当前文件不可恢复 | 必须从上游/原谱补回 |
| 演唱中的滑音曲线、实际自由速度 | 谱文不可恢复 | 需音频分析或人工标注；不应伪造成传统谱信息 |

## 四、确定性转换设计

### 1. 必须新增的元数据

建议在转换配置而非播放器 JSON 中先补齐：

```yaml
sourceCompleteness:
  expectedSymbolCount: 796
  knownMissingBlocks: [line-36-char-1]

tuning:
  dise: xiaogong
  shangPitch: D4
  temperament: 12-TET       # 或一个逐级 cents profile
  referenceHz: 440
  performanceShiftSemitones: 0

meterSections:
  - fromSourceOrder: ...
    toSourceOrder: ...
    banshi: yi_ban_san_yan  # 或 liushui/yi_ban_yi_yan/zeng/sanban
    time: [4, 4]
    divisions: 16
    pickup: ...
    barlineAnchor: ...
    rhythmProfile: reviewed-v1

lyricRoles:
  line-id/char-index: zheng | chen | spoken | unknown

ornamentProfile:
  h: { kind: huo, realization: reviewed-id }
  s: { kind: sou, realization: symbol-only }
  d: { kind: die, repeats: null }
  c: { kind: cuo, realization: null }
```

`tempo` 不是写出正确音值的前提；它只影响播放。若目标只是五线谱，完全可以没有每音 timestamp，也可暂时不指定 BPM。

### 2. 先转成与 MusicXML 解耦的中间表示

```ts
type Rational = { n: number; d: number };

type SourceMark =
  | { kind: "banyan"; code: "1"|"2"|"3"|"4"|"5"|"6"|"7"|"8" }
  | { kind: "ornament"; code: "h"|"s"|"d"|"c"; resolvedKind?: string }
  | { kind: "breath" }
  | { kind: "sideStart" | "sideEnd" };

type RelativePitch = {
  degree: 1|2|3|4|5|6|7;
  octaveShift: number;
  semitonesFromMiddleShang?: number; // 仅选定 scaleProfile 后填
};

type NoteEvent = {
  id: string;
  sourceOrder: number;
  source: { lineId: string; charIndex: number; gcIndex: number; raw: string };
  pitch: RelativePitch;
  side: boolean;
  marks: SourceMark[];              // 必须保留 raw 中的原顺序
  lyric?: { text: string; role: string; melisma: "start"|"continue"|"stop" };
  onset: Rational | null;           // 未解决时必须为 null
  duration: Rational | null;
  unresolved: string[];
};
```

板眼事件另建 `MetricAnchor`，不要塞成音符时长：

```ts
type MetricAnchor = {
  sourceNoteId: string;
  markIndex: number;
  banyanCode: string;
  measure: number | null;
  offset: Rational | null;
};
```

### 3. 转换步骤

1. **完整性门禁**：核对文件规模、预期 796 音、已知漏块、`text/chars` 一致性。目标为“完整全曲”时，漏块未补即终止。
2. **按数组取序**：遍历 `lines/chars/gc`，不读取 `s/e` 计算音乐顺序或时值。
3. **重新 lex `raw`**：识别基字、紧随其后的 `+/-`、`1..8`、`h/s/d/c`、`/`、全/半角括号；括号状态允许跨 gc token。未知字符、未配对括号即报错。
4. **双向核验**：由 lexer 结果重新计算 `b/r/p/bt/o/q`，与现字段比较；已知不可逆项只报警告，但音符语义始终取自 `raw`。
5. **建立相对音高**：按 B.3 生成 `RelativePitch`；此步无需调门。
6. **绑定歌词**：同一唱字第一个非旁注、实际发音主音写歌词，后续写 melisma；正衬未知则显式标 unknown。
7. **解析板式区段**：只接受人工确认或有出处的 `meterSections`。把 `1..8` 变成 metric anchors，检查循环次序；不得用源码中“全曲默认一板三眼带赠板”的方便值充当史实。
8. **求 onset/duration**：在两个已知锚点间，仅当 `rhythmProfile` 对无标音细分给出唯一解时才分配有理数时值；否则 `null + unresolved`。同一音跨小节时拆音并加 tie。
9. **实现腔格**：有审核过的 realization 才展开成 grace/小音符/滑音/颤音；否则保留为文字或 `other-ornament`，不制造音高和时值。
10. **绝对定调**：给定 `shangPitch + scaleProfile` 后计算 staff step/alter/octave；没有则只输出内部相对谱或要求用户补参数。
11. **生成 MusicXML**：秒级同步信息不进入 note duration；若以后仍需播放器同步，输出独立 `score-alignment.json`，以 note ID 对应原 `s/e`。

### 4. MusicXML 映射

| 中间信息 | MusicXML 4.0 |
| --- | --- |
| 绝对音高 | [`pitch`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/pitch/) 的 `step/alter/octave` |
| 每拍量化单位 | [`divisions`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/divisions/) |
| 有理数音长 | [`duration`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/)；跨小节拆分并 tie |
| 板式所得拍号 | [`time`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/time/) |
| 经确认的调号 | [`key`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/key/)；特殊律制优先逐音 `alter` |
| 真正无时值倚音 | [`grace`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/grace/)；旁注音未确认前不得使用 |
| 擞/叠/豁等 | [`ornaments`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/ornaments/)；无原生等价时用 [`other-ornament`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/other-ornament/) 并保留原码 |
| 气口 | [`breath-mark`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/breath-mark/) |
| 一字多腔 | [`lyric`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/lyric/) + [`extend`](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/extend/) |

五线谱本身记录相对时值、拍号和速度，不要求每个音带媒体时间戳；这正是把同步时间与交换记谱分层的理由。

## 五、fail-closed 验证清单

完整可演奏谱导出必须同时满足：

- [ ] 已补回已知缺失的“杨”字 6 音，或导出范围明确排除该处；
- [ ] 所有 `raw` 字符均被 lexer 消耗，括号平衡；
- [ ] 解析出的基字与 `b/r` 一致，所有音区组合合法；
- [ ] 不把 `gc=[]`、行间时间空隙或 `/` 自动译为休止；
- [ ] 不读取 `line/char/gc.s/e` 推导 onset、duration、tempo；
- [ ] 每个导出区段均有已确认的笛色/`shangPitch`/调律；
- [ ] 每个节拍区段均有已确认的板式、拍格和小节锚点；
- [ ] `1..8` 的循环次序与该板式相容，赠板和底板已人工确认；
- [ ] 每个普通 note 的 `onset`、`duration` 都是唯一有理数，且每小节时值闭合；
- [ ] 所有旁注音、休止与腔格展开都有明确来源；未解决项只作注释，不冒充音符；
- [ ] MusicXML 往返解析后音高、时值、歌词、tie、气口和原始 `raw` 引用不丢失。

若任一项不满足，转换器应输出带 `unresolved` 的相对音高/校订报告，而不是“尽量猜一个能播放的 MIDI”。

## 六、最小测试向量

### A. 音区、板眼与气口

输入：

```text
工-1/合276四46合工-36/
```

预期 lexer 结果：

```text
低工 [1, breath]
合   [2,7,6]
四   [4,6]
合   []
低工 [3,6, breath]
```

此测试只断言相对音高和 mark 顺序；没有 meterSection 时，所有 onset/duration 必须保持 `null`。

### B. 扁平字段不可逆

输入 `上3dd2`：必须得到 `上 → banyan(3) → d → d → banyan(2)`；若实现先读取 `bt="32"` 再读 `o="dd"`，测试应失败。

### C. 跨 token 括号

输入两个连续 raw：

```text
四2/（
尺d）
```

预期：`四` 非旁注，带 `2` 和 breath；括号在它之后开启；`尺` 为旁注并带 `d`，随后关闭。不得相信两个 token 的 `p=false`。

### D. 气口与腔格交错

输入 `六2/d4dd2`：必须完整保留 `2, /, d, 4, d, d, 2` 的次序；`q=true` 不能替代这一序列。

### E. 空工尺不是休止

输入“杨”字 `gc=[]`：预期 `MISSING_NOT_REST`，并指向已知缺失块；不得输出任何 rest。

### F. 缺调门时使用可见默认定调

输入任意可解析 `上尺工`，但无 `tuning.shangPitch`：得到相对 `1,2,3`，并按已审定默认值 `上=D4`（`1=D`、12-TET、A4=440）生成绝对谱；绝对音高为 `inferred`，谱面橙色且可整体覆盖移调。不得把默认值标成 confirmed。

### G. 缺板式时只生成可见排谱推定

输入 `六1676`，但无 `meterSections`：可得到板眼事件序列 `1,6,7,6`；不得把它解释成 1.676 秒。转换器仍可使用可回溯的最佳板式推定与最简量化生成 MusicXML，但所有依赖的拍格、onset 和 duration 必须为 `inferred` 并显示橙色。

## 七、后续审定状态与仍需曲谱级资料

后续项目审定已解决本研究最初提出的若干通用问题：

- 有拍上下文满足前提时采用 `kunqu-gcn-rhythm-v1`，唯一结果为 `derived`；否则回退橙色 `inferred` 最简量化；
- 括注音默认有时值并参与上述分配，只有明确 profile 才改作 grace note；
- `d` 按明记次数生成同音重复；`c` 统一称掇腔并按已审定“顿—休—带”规则处理；
- 缺调门时默认 `上=D4`，但绝对音高保持 `inferred`；
- 只导出一份规范 MusicXML，试听另存 Playback Plan。

仍需按曲谱或区段采集：

1. 当前《寻梦》各曲牌的实际笛色、板式切换、起板/底板和小节边界；
2. 正衬字、独立休止、延长/停顿，以及豁腔、擞腔和其他未审定腔格的具体音程、重复次数与时值；
3. 当前演唱相对传本是否整体移调，以及使用何种传统调律 profile。

这些资料不再阻塞导出：缺失处按执行文档生成可见、可回溯的推定或未决标记，补齐后更新校订清单/profile 并重导出。
