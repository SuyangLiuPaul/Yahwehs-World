// Every word the reader chrome says, in the three interface languages of this release.
//
// Church wording rules apply to all of it (tests/reader/wording.test.ts walks this table):
// the Bible's own words before theology; no 位格 / Trinity vocabulary even to deny it; 他 not 祂;
// 雅偉 (not 雅伟) in Traditional; the Union Version is 和合本 / Chinese Union Version, with no year.
import type { UiLang } from './types.ts';

type Row = Record<UiLang, string>;
const r = (en: string, hans: string, hant: string): Row => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });

export const STRINGS = {
  // navigation
  prevChapter: r('Previous chapter', '上一章', '上一章'),
  nextChapter: r('Next chapter', '下一章', '下一章'),
  pickChapter: r('Choose book and chapter', '选择书卷和章', '選擇書卷和章'),
  chapterN: r('Chapter {n}', '第 {n} 章', '第 {n} 章'),
  oldTestament: r('Old Testament', '旧约', '舊約'),
  newTestament: r('New Testament', '新约', '新約'),
  recent: r('Recent', '最近读过', '最近讀過'),
  chapters: r('Chapters', '章', '章'),
  back: r('Back', '返回', '返回'),
  close: r('Close', '关闭', '關閉'),
  done: r('Done', '完成', '完成'),
  // modes
  modeVerse: r('Verses', '逐节', '逐節'),
  modeParagraph: r('Paragraphs', '段落', '段落'),
  modeParallel: r('Parallel', '对照', '對照'),
  layout: r('Reading layout', '阅读方式', '閱讀方式'),
  parallelN: r('Parallel · {n}', '对照 · {n}', '對照 · {n}'),
  // editions
  edition: r('Edition', '译本', '譯本'),
  chooseEdition: r('Choose an edition', '选择译本', '選擇譯本'),
  compareEditions: r('Compare editions', '对照译本', '對照譯本'),
  groupEnglish: r('English', 'English', 'English'),
  groupHans: r('简体中文', '简体中文', '簡體中文'),
  groupHant: r('繁體中文', '繁體中文', '繁體中文'),
  maxThree: r('3 is the most', '最多三个', '最多三個'),
  parallelHint: r('Lines appear in this order. The first is the main edition.', '各行按此顺序排列，第一个是主译本。', '各行按此順序排列，第一個是主譯本。'),
  addToCompare: r('Add an edition to compare', '再加一个译本来对照', '再加一個譯本來對照'),
  moveUp: r('Move up', '上移', '上移'),
  moveDown: r('Move down', '下移', '下移'),
  mainEdition: r('Main', '主', '主'),
  licencePD: r('Public domain', '公有领域', '公有領域'),
  licenceCC0: r('CC0', 'CC0', 'CC0'),
  notInEdition: r('not in this edition', '本译本没有这一节', '本譯本沒有這一節'),
  editionSwitched: r('Now reading {name}', '现在读 {name}', '現在讀 {name}'),
  // selection and copy
  verseN: r('Verse {n}', '第 {n} 节', '第 {n} 節'),
  selectVerse: r('Select verse {n}', '选取第 {n} 节', '選取第 {n} 節'),
  selectedN: r('{n} selected · {ref}', '已选 {n} 节 · {ref}', '已選 {n} 節 · {ref}'),
  copy: r('Copy', '复制', '複製'),
  copyLink: r('Link', '链接', '連結'),
  clear: r('Clear', '取消选择', '取消選擇'),
  copied: r('Copied', '已复制', '已複製'),
  copiedLimited: r('Copied the first {n} verses (the limit)', '已复制前 {n} 节（以此为限）', '已複製前 {n} 節（以此為限）'),
  linkCopied: r('Link copied', '链接已复制', '連結已複製'),
  copyFailed: r('Copy failed. Select the text and copy it by hand.', '复制失败，请选取文字后手动复制。', '複製失敗，請選取文字後手動複製。'),
  nothingToCopy: r('These verses are not in this edition', '这些节在本译本中没有', '這些節在本譯本中沒有'),
  // footnotes and headings
  noteN: r('Note {n}', '注 {n}', '註 {n}'),
  aboutSection: r('About this section', '这一段的背景', '這一段的背景'),
  // display
  display: r('Display', '显示', '顯示'),
  textSize: r('Text size', '字号', '字號'),
  smaller: r('Smaller', '较小', '較小'),
  larger: r('Larger', '较大', '較大'),
  theme: r('Theme', '主题', '主題'),
  themeAuto: r('Follow system', '跟随系统', '跟隨系統'),
  themeDark: r('Dark', '深色', '深色'),
  themeLight: r('Light', '浅色', '淺色'),
  themePaper: r('Paper', '纸', '紙'),
  // states
  loading: r('Loading…', '加载中…', '載入中…'),
  retry: r('Try again', '重试', '重試'),
  offlineChapter: r('This chapter is not on this device yet, and you appear to be offline.', '这一章还没有保存在本机，而且你似乎已离线。', '這一章還沒有儲存在本機，而且你似乎已離線。'),
  loadFailed: r('This chapter could not be loaded.', '这一章加载失败。', '這一章載入失敗。'),
  builtInList: r('Using the built-in list of editions.', '正在使用内置的译本列表。', '正在使用內建的譯本列表。'),
  // passage (under a picture)
  wholeChapter: r('Read the whole chapter', '读整章', '讀整章'),
  showMore: r('Show the other {n} verses', '展开其余 {n} 节', '展開其餘 {n} 節'),
  showLess: r('Show fewer', '收起', '收起'),
  passage: r('Passage', '经文', '經文'),
  // credit
  creditLabel: r('Edition credit', '译本说明', '譯本說明'),
  // landmarks
  reader: r('Bible reader', '圣经阅读', '聖經閱讀'),
  chapterText: r('Chapter text', '本章经文', '本章經文'),
  selectionBar: r('Selected verses', '已选经文', '已選經文'),
} as const;

export type StringKey = keyof typeof STRINGS;
export type StringOverrides = Partial<Record<StringKey, string>>;

export function t(key: StringKey, ui: UiLang, vars?: Record<string, string | number>, overrides?: StringOverrides): string {
  let s = overrides?.[key] ?? STRINGS[key][ui] ?? STRINGS[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
