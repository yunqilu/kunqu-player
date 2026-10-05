import { lang } from '../i18n/index.js'

// 左栏「剧目简介 / 选角」内容（参考 Noh 站点的导读面板）。
// 这里的史实部分是确定的；带「—」的字段为占位，待填入该场具体演出信息。
export const PLAY_INFO = {
  title: '牡丹亭 · 寻梦',
  subtitle: '〔传奇〕汤显祖　明·万历二十六年（1598）',
  fields: [
    { k: '选段', v: '《寻梦》' },
    { k: '角色', v: '杜丽娘' },
    { k: '行当', v: '闺门旦' },
    { k: '演唱', v: '顾卫英' },
    { k: '来源', v: '央视录像' },
    { k: '曲牌', v: '—（待补全）' },
    { k: '司笛 / 乐队', v: '—（待补全）' },
  ],
  synopsis:
    '杜丽娘游园惊梦之后，魂牵梦绕，独自重返后花园，寻觅梦中与书生柳梦梅相会之境。' +
    '满园春色依旧，而梦境难再，一段缠绵悱恻的独唱由此展开。《寻梦》几乎全为旦角一人' +
    '的成套唱腔，对气息、行腔、身段要求极高，历来被视为昆曲闺门旦的试金石。',
  note: '本面板内容可在 src/data/meta.js 中编辑；可按 Noh 站点思路扩展为分段导读、术语注释等。',
}

// 英文版：自己撰写，不是任何已出版译本的摘录。字段与 PLAY_INFO 一一对应。
export const PLAY_INFO_EN = {
  title: 'The Peony Pavilion · Seeking the Dream',
  subtitle: 'Chuanqi drama by Tang Xianzu · Ming dynasty, Wanli 26 (1598)',
  fields: [
    { k: 'Scene', v: 'Seeking the Dream (Xún Mèng)' },
    { k: 'Character', v: 'Du Liniang' },
    { k: 'Role type', v: 'Guimen dan (young noblewoman)' },
    { k: 'Singer', v: 'Gu Weiying' },
    { k: 'Source', v: 'CCTV broadcast recording' },
    { k: 'Qupai', v: '— (to be added)' },
    { k: 'Flute / ensemble', v: '— (to be added)' },
  ],
  synopsis:
    'After her walk in the garden and the dream that followed, Du Liniang cannot let the dream go. ' +
    'She returns alone to the back garden to look for the place where she met the scholar Liu Mengmei. ' +
    'The spring garden is just as it was, but the dream cannot be found again, and a long, lingering solo unfolds. ' +
    'Seeking the Dream is sung almost entirely by one performer. Its demands on breath, melodic line and ' +
    'movement have long made it a touchstone for the guimen dan role in Kunqu.',
  note: 'Edit this panel in src/data/meta.js.',
}

export function playInfo() {
  return lang.value === 'zh' ? PLAY_INFO : PLAY_INFO_EN
}
