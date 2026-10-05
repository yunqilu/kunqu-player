# Kunqu Score Conversion

This context describes the score information recovered from Kunqu gongche notation and the progressively stronger guarantees made while converting it to staff notation.

Each term is given in English with the project's Chinese term in parentheses. The _Avoid_ lists name wordings that must not be used for the concept; where the wording to avoid is a Chinese phrase, it is kept and glossed in English.

## Language

**Reviewable Relative Score (可校订的相对谱)**:
The relative pitches, lyrics, ban-yan beats and qiangge (腔格, vocal ornament) events parsed losslessly from the gongche score. Everything unresolved is kept explicitly, and no promise is made about absolute pitch, definite durations or playability.
_Avoid_: 五线谱草稿 (staff-score draft), 半成品乐谱 (half-finished score), 猜测谱 (guessed score)

**Playable Score (可演奏谱)**:
A score whose absolute pitches, definite durations, rests, bars and necessary vocal marks have all been filled in and validated, so that it can be exported as semantically complete MusicXML.
_Avoid_: 完整谱 (complete score), 最终谱 (final score)

**Reviewed Gongche Source (经校订的工尺源)**:
Gongche score data that has been checked by a person or against an authoritative edition, keeps the original order and records where it came from. It is the source of score facts that conversion relies on, and known omissions should be repaired here.
_Avoid_: 转换器补丁 (converter patch), 隐性勘误 (hidden erratum), viewerModel 原谱 (viewerModel as the original score)

**Review Manifest (校订清单)**:
Versioned revision material attached to a single score. It explicitly records `gc.raw` errata, qupai sections, dise (笛色, flute key), banshi (板式, metrical type), tuning, sources, evidence status and score-level configuration overrides. Together with the playback projection it is compiled into the reviewed gongche source.
_Avoid_: 转换器特判 (special case in the converter), 隐藏补丁 (hidden patch), 全局曲目配置 (global piece configuration)

**Playback Projection (播放投影)**:
A data view generated for player synchronization and display, such as `viewerModel.json`. It may carry timestamps and convenience fields, but it does not own score facts and cannot override the reviewed gongche source.
_Avoid_: 权威谱本 (authoritative edition), 原始谱 (original score), 唯一真相 (single source of truth)

**Gongche Raw (工尺原文)**:
The `gc.raw` string kept in its original syntax in the reviewed gongche source. It is the only semantic input for a single gongche token, and must preserve character order, grouping and unknown marks.
_Avoid_: 拼接字段 (concatenated fields), 标准化串 (normalized string), 展开工尺 (expanded gongche)

**Flattened Gongche Fields (展开字段)**:
The convenience fields `b`, `r`, `p`, `bt`, `o`, `q` and so on in the playback projection. They are lossy derivatives of `gc.raw`. They may be used only for compatible display and consistency diagnostics, never to produce score facts.
_Avoid_: 解析输入 (parser input), 备用真相 (fallback truth), 纠错来源 (source for corrections)

**Relative Score IR (相对谱中间表示)**:
The versioned, reviewable JSON parsed from gongche raw. It keeps relative pitch, lyrics, ban-yan, qiangge, source positions, unknown marks and diagnostics, and is the only musical input for producing the canonical score interpretation.
_Avoid_: 临时 JSON (temporary JSON), MusicXML 替代品 (substitute for MusicXML), 最终输出 (final output)

**MusicXML Export (MusicXML 导出)**:
An interchange file with a plain staff-notation surface, generated from the canonical score interpretation. It may use clearly marked, traceable inferences to fill in unresolved musical semantics, and may project purple playback cue marks that do not change score events. It does not show gongche characters as visible reference text, and must not interpret the playback projection or gongche raw directly, bypassing the relative score and the canonical score interpretation.
_Avoid_: 直接转换 (direct conversion), 工尺转 XML (gongche-to-XML), 第一阶段解析 (first-stage parsing)

**Best-effort Staff Score (推定五线谱)**:
MusicXML generated from the relative score, with musical semantics as complete as possible and every inference visible and traceable. It can be reviewed and played through, but becomes a playable score only when every inferred item has been confirmed.
_Avoid_: 猜测谱 (guessed score), 最终谱 (final score), 已确认谱 (confirmed score)

**Inferred Value (推定值)**:
A pitch, duration, rest, bar or other score value supplied from recorded Kunqu rules or review configuration. Inference status is recorded per field, so that the relative pitch, absolute pitch, duration, rest and so on of one score event can each be confirmed or inferred separately, each linked to its gongche raw position, the rule used and its confidence status.
_Avoid_: 默认值 (default value), 自动修正 (automatic correction), 确定值 (definite value)

**Provenance Chain (回溯链)**:
The stable link from a score element in MusicXML, through relative-score events and inference records, back to the reviewed gongche source and the specific `gc.raw` position.
_Avoid_: 调试日志 (debug log), 时间戳映射 (timestamp mapping), 备注文本 (note text)

**Dual-layer Inference Marking (双层推定标记)**:
In the visible layer of the staff score, colour and a short field label point out inferred content. In the data layer, MusicXML element `id`s link back to the field-level rule, source position and confidence status in the relative score. Neither layer alone is a complete provenance record.
_Avoid_: 只着色 (colour only), XML 内嵌全部审校数据 (embedding all review data in the XML), 无来源问号 (a question mark with no source)

**Playback Effect Marking (试听效果标记)**:
A compact editorial mark in canonical MusicXML that shows where a playback rendering effect falls. It is shown as a short purple label together with a legend for the whole score, and produces no canonical note, rest or duration. Qiangge names stated explicitly in the source score are shown in green, and the canonical score's own inferences remain orange.
_Avoid_: writing “试听” (shìtīng, "playback preview") over and over, 只靠颜色 (relying on colour alone), 表演效果音符 (notes for performance effects)

**Evidence Status (证据状态)**:
Each inferable field in the relative score uses one of four discrete states. `confirmed` means confirmed by the source edition or by a person. `derived` means uniquely derived by an explicit rule. `inferred` means the best inference when evidence is insufficient. `unresolved` means there is no reasonable value yet. Percentage confidence must not replace these reviewable evidence categories.
_Avoid_: 置信分数 (confidence score), 真假标记 (true/false flag), 统一猜测状态 (a single "guessed" state)

**Minimal Rhythm Quantization (最简量化)**:
The fallback used when banshi rules cannot uniquely determine note durations between ban-yan anchors. It keeps the order of the gongche notes and the anchor positions, prefers equal division, and then chooses the legal rhythm with the fewest dots and tuplets. Every affected onset and duration is marked `inferred`, and playback timestamps must not be read.
_Avoid_: 时间戳量化 (timestamp quantization), 任意均分 (arbitrary equal division), 默认时值 (default duration)

**Canonical Metered Allocation (通用有拍分配)**:
The rule that determines metered note durations from the ban-yan window, the order of articulation and the weight relation of side notes, when the banshi is confirmed, the ban-yan cycle is legal and exactly one score-reading rule applies. The result is a `derived` value, uniquely derivable from the score and confirmed rules. Only when these preconditions fail does it fall back to inference.
_Avoid_: 网站猜拍 (guessing the beat from the website), 默认等分 (default equal division), 播放时值 (playback duration)

**Ban-yan Anchor (板眼锚点)**:
A beat event attached to a gongche note that locates a strong beat, weak beat, zengban (赠板, added beat), diban (底板, beat falling on a rest) or offbeat position. The current `1..8` are category codes used by the playback projection. Consecutive digits mean that the same note passes through several anchors, not a duration value or a repeated articulation.
_Avoid_: 时长数字 (duration number), 拍数 (beat count), 重复音 (repeated note)

**Breath and Qiangge Codes (气口与腔格码)**:
In gongche raw, `/` is a qikou (气口, breath mark), `h` is huoqiang (豁腔), `s` is souqiang (擞腔), `d` is dieqiang (叠腔) and `c` is duoqiang (掇腔). “撮腔” (cuōqiāng) and the website source's `cuoqiang` are compatible aliases of `c`. The meaning of the codes has been confirmed by a person, but apart from the reviewed dieqiang and duoqiang, which Western notes and durations each one expands to is still decided by the qiangge realization configuration.
_Avoid_: reading `/` as a rest, `h` as 橄榄腔 (gǎnlǎnqiāng, the "olive" swell), `s` as 滑音 (glide), `d` as 断腔 (duànqiāng, the cut-off ornament), or `c` as 擞腔 (sǒuqiāng)

**Qiangge Realization (腔格实现)**:
The versioned rules that expand a qiangge code into concrete intervals, repeat counts, durations and Western notation marks. Where no reviewed realization exists, a breath mark may be written directly as a breath sign, and a qiangge is preserved only by its Chinese name and `other-ornament`, without manufacturing micro-notes.
_Avoid_: 腔格名称即音列 (treating the qiangge name as a note series), 全局装饰音映射 (a global ornament mapping), 源码提示标签 (hint labels from source code)

**Dieqiang Realization (叠腔展开)**:
Each `d` in gongche raw produces, in the canonical score interpretation, one repetition of the preceding main note at the same pitch. The repeated pitch and the count are `derived`; the duration takes its own evidence status from its metered or free-meter context.
_Avoid_: 仅标叠腔 (only labelling it dieqiang), 试听重复 (repeating in playback only), 固定叠腔时值 (a fixed dieqiang duration)

**Duoqiang Realization (掇腔展开)**:
A `c` in gongche raw explicitly marks duoqiang (compatible alias “撮腔”, cuōqiāng). The canonical score interpretation uses a “顿—休—带” (dùn–xiū–dài, stop–rest–carry) structure: the preceding note is sung solidly for half a beat, a rest of a quarter beat follows, and the next written note is carried lightly for a quarter beat.

- **Conditions.** Recognition and realization do not depend on a preceding breath mark, the tone of the syllable or the position of the release. These are only common traditional contexts.
- **Evidence.** The structure, the existence of the rest and the `2:1:1` ratio are `derived` from the reviewed rule. When a metered context locates it uniquely, the rest is ordinary black. Only when free meter or an uncertain beat position makes the concrete onset or duration `inferred` is it orange. It is never the purple of the playback layer.
- **Anchors come first.** Ban-yan anchors written on the preceding and following notes take priority over `2:1:1`; anchors must not be moved to satisfy the ratio. If the ratio and the anchors are incompatible but there is still room for positive durations, the stop–rest–carry structure is kept, the affected concrete durations are marked `inferred`, and `DUOQIANG_ANCHOR_CONFLICT` is reported. If the space between anchors cannot hold even a rest of positive duration, the anchors are not moved, no zero-duration rest or grace rest is produced, the original note and the green label are kept, the micro-realization is marked `unresolved`, and `DUOQIANG_NO_METRIC_SPACE` is reported.
- **The carry note.** The "carry" is a normal-sized, black score note with duration. The green “掇腔” (duōqiāng) text and `other-ornament` appear once only, on the "stop" note that carries the `c`. The rest and the "carry" link back only through a shared `realizationId` and do not repeat the label. Even when the realization is `unresolved`, the label stays on the "stop" note.
- **Finding the carry note.** The search may cross `gc` tokens and lyric characters, but may take only the next score note within the same confirmed phrase and qupai section. It stops at a confirmed phrase boundary or a qupai boundary.
- **Lyrics.** A "carry" taken across a lyric character still prolongs the preceding character, using that character's lyric extension in MusicXML. The following lyric may attach only to a non-"carry" main note among its own remaining gongche notes, and must not push on to take a note of the lyric after it. If there is no such landing place, that lyric is kept as orange text awaiting review and `DUOQIANG_LYRIC_COLLISION` is reported.
- **Failures.** When no eligible "carry" is found, only the green “掇腔” label is kept and an unresolved diagnostic is reported. When several `c` follow the same preceding note, only the first is realized and `DUPLICATE_DUOQIANG_CODE` is reported; several structures must not be generated.

_Avoid_: 同音复制 (same-pitch copy), confusing 撮腔 with 叠腔 (dieqiang), 气口前置条件 (a breath-mark precondition), 平声字校验 (a level-tone check), 出口位置校验 (a release-position check), cue note, grace note, grace rest, 零时值休止 (zero-duration rest), 绿色带音 (a green carry note), 歌词连锁顺延 (chained shifting of lyrics), 连续掇腔展开 (realizing consecutive duoqiang), 为凑比例移动板眼 (moving ban-yan to fit the ratio)

**Side Note (旁注音)**:
A lightly placed melodic note marked by a parenthesized range in gongche raw. By default it has duration and takes part in the rhythmic allocation of its ban-yan interval. It is shown at a smaller size in staff notation, and becomes a zero-duration grace note only when a qiangge or qupai rule says so explicitly.
_Avoid_: 一律倚音 (always a grace note), 无时值小音符 (a small note without duration), `gc.p` 真值 (`gc.p` as the truth)

**Unpitched Text Event (无工尺文字)**:
Text with `gc=[]` in the playback projection. The review manifest must classify it as spoken text, a prolongation of the previous note, a gap in the score, or unresolved text. An empty array alone must not produce a note or a rest.
_Avoid_: 空拍 (empty beat), 默认休止 (default rest), 无声歌词 (silent lyric)

**Inferred Rest (推定休止)**:
Apart from canonical rests explicitly required by a reviewed qiangge, a rest arises only in a metered section, at a beat position that the confirmed bar structure and the ban-yan anchors together require and that no sounding event occupies. Both the existence and the length of such a gap rest are marked `inferred`. A diban can only offer a candidate pause; a breath mark, an empty gongche array or a gap in the video cannot produce a rest on its own.
_Avoid_: 空隙休止 (gap rest), 气口休止 (breath-mark rest), 底板固定休止 (a fixed rest on the diban)

**Free-meter Engraving Duration (散板排谱时值)**:
The simplest relative duration assigned to a free-meter (散板, sǎnbǎn) event so that MusicXML note structure is satisfied. The score uses `senza-misura` and groups only by confirmed phrase boundaries or sections, without filling out bars. Every duration is `inferred` and does not represent the actual singing tempo.
_Avoid_: 散板拍号 (a time signature for free meter), 录像时值 (durations from the recording), 隐形固定拍 (a hidden fixed beat)

**Default Banshi Meter (默认板式拍格)**:
The Western meter the conversion profile uses when there is no score-level override: `1/4` for liushui ban (流水板), `2/4` for one ban one yan (一板一眼), `4/4` for one ban three yan (一板三眼), `8/4` grouped as `4+4` for one ban three yan with zengban (一板三眼加赠板), and `senza-misura` for free meter (散板). The meter implies no tempo.
_Avoid_: 板式速度 (banshi tempo), 时间戳拍号 (a time signature from timestamps), 赠板 `4/2` (`4/2` for zengban)

**Qupai Section (曲牌区段)**:
A score context bounded by qupai boundaries, carrying this section's dise, tuning, banshi and their sources. Conversion rules are resolved and applied per section, and must not assume that one score uses the same key or banshi throughout.
_Avoid_: 全曲默认调 (a default key for the whole piece), 硬编码曲牌 (hard-coded qupai), 播放器片段 (player segment)

**Conversion Profile (转换配置)**:
A reusable, versionable set of Kunqu score-reading rules, covering dise mapping, tuning, banshi, quantization and qiangge realization. Piece data only references or overrides a profile. Values belonging to a single piece such as *Seeking the Dream* (寻梦) must not be written into the general conversion logic.
_Avoid_: 寻梦规则 (rules for Seeking the Dream), 转换器常量 (converter constants), 曲目特判 (per-piece special cases)

**Canonical Score Interpretation (规范谱解释)**:
The interpretation layer that produces reviewable score semantics uniquely from the relative score. It contains facts from the source score, definite derivations and traceable inferences, and is the only source of notes, rests, pitches, beat positions and durations for the single MusicXML. It does not add unreviewed score events for the sake of a playback effect. The Playback Plan may give MusicXML only purple cue marks that do not change the musical semantics.
_Avoid_: 多版本乐谱 (multiple score versions), 默认试听 (default playback), 网站兼容谱 (a website-compatible score)

**Playback Rendering (试听渲染)**:
The process of adding performance effects such as breath pauses, phrase-end stretching, re-articulation, glides and vibrato on top of the canonical score interpretation. It produces a playback plan rather than a second MusicXML, and must not modify the canonical score interpretation or the relative score in return.
_Avoid_: 试听版乐谱 (a playback edition of the score), 第二套规范时值 (a second set of canonical durations), 回写乐谱 (writing back into the score)

**Playback Plan (试听方案)**:
Versioned event data produced by playback rendering for scheduling by the browser audio engine. It stores canonical-score source IDs, beat positions, the tempo map and performance parameters, but is not a score interchange format.
_Avoid_: 试听 MusicXML (playback MusicXML), MIDI 真相 (MIDI as the truth), 规范谱 (canonical score)

**Section Context Resolution (区段上下文解析)**:
The process of expanding the complete dise, tuning, banshi and other context for each qupai section. The resolution priority is fixed: what the section states explicitly, then sourced carry-over rules in the conversion profile, then the best inference. The corresponding status is written according to the actual evidence.
_Avoid_: 无条件继承 (unconditional inheritance), 隐式全局默认 (implicit global default), 空上下文 (empty context)

**Approximate Western Tuning (近似西乐定调)**:
When the dise is known but there is no exact absolute pitch or temperament, the tuning that produces an interchangeable staff score from the formal correspondence table using twelve-tone equal temperament at `A4=440`. The resulting absolute pitches are always `inferred`, and can be overridden by the actual `shangPitch`, tuning and transposition of an edition or a performance.
_Avoid_: 传统律制 (traditional temperament), 确认调高 (confirmed pitch level), 笛色等于西乐调 (dise equals a Western key)

**Default Tuning Inference (默认定调)**:
When even the dise of a qupai cannot be reasonably determined, the general converter still produces a staff score using twelve-tone equal temperament at `A4=440` with the middle-register `上` (shàng, the gongche degree) set to `D4`, that is `1=D`. The tuning and the absolute pitches that follow from it are `inferred`, must show the inference mark, and may be transposed as a whole or have `shangPitch` overridden by the score configuration.
_Avoid_: 调门未定参考谱 (a reference score with undetermined key), `1=C`, 确认的小工调 (a confirmed xiaogong key)

**Conversion Core (转换核心)**:
Pure JavaScript modules that depend on neither Vue nor the video clock. They handle review compilation, gongche parsing, generating the relative score and the canonical score, MusicXML export and Playback Plan rendering. The command line and the viewer must call the same core.
_Avoid_: viewer 转换逻辑 (conversion logic in the viewer), CLI 专用实现 (a CLI-only implementation), 寻梦导出器 (an exporter for Seeking the Dream)

**Review Loop (审阅闭环)**:
The local editing workflow in the viewer for inferred and unresolved fields: change a value, mark it as confirmed by a person, record an evidence note, regenerate the relative score, canonical score, MusicXML and Playback Plan, and download the new review manifest. The first version depends on no server, account or database.
_Avoid_: 只读诊断 (read-only diagnostics), 数据库审校 (database-backed review), 直接修改生成 XML (editing the generated XML directly)
