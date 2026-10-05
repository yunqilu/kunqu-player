// 左栏目录：曲牌（或念白段）→ 分句。只做组装，不做任何断句判断——那是后端的事。
// 标签和提示随界面语言变；在 computed 里调用它，切换语言时目录会重建。
import { t } from '../i18n/index.js'
import { qupaiLabel, qupaiTip } from '../i18n/qupai.js'

const ROUTINE = new Set(['lyric_punct', 'lyric_boundary']) // 每句都有的例行依据，不放进差异提示

// 依据按界面语言显示：后端给 {code, params}，模板在 i18n 对照表的 evidence.<code>
export const evidenceText = (item) => t(`evidence.${item.code}`, item.params)

function tipOf(line) {
  const items = line.evidence_items
  if (line.status === 'inferred') return [t('outline.tipInferred'), ...items.map(evidenceText)].join('\n')
  if (line.status === 'variant') {
    return [t('outline.tipVariant'), ...items.filter((x) => !ROUTINE.has(x.code)).map(evidenceText)].join('\n')
  }
  return ''
}

const KIND_KEY = { 唱: 'kind.sung', 白: 'kind.spoken' }
const kindLabel = (kind) => (kind in KIND_KEY ? t(KIND_KEY[kind]) : kind)

export function buildOutline(model) {
  const indexOf = new Map(model.lines.map((l, i) => [l.id, i]))
  return model.sections.map((sec) => {
    const items = sec.phrase_ids.map((id) => {
      const index = indexOf.get(id)
      if (index === undefined) throw new Error(`段落 ${sec.key} 引用了不存在的分句 ${id}`)
      const line = model.lines[index]
      return { index, id, s: line.s, text: line.text, status: line.status, tip: tipOf(line) }
    })
    return {
      key: sec.key,
      // 曲牌未知时只标「唱 / 白」，不编造曲牌名
      label: sec.qupai ? qupaiLabel(sec.qupai) : kindLabel(sec.kind),
      labelTip: sec.qupai ? qupaiTip() : '',
      kind: sec.kind,
      count: items.length,
      inferred: items.filter((x) => x.status === 'inferred').length,
      items,
    }
  })
}
