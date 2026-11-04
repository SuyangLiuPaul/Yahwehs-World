// Every word the reader chrome says, in the three interface languages of this release.
//
// Church wording rules apply to all of it (tests/reader/wording.test.ts walks this table):
// the Bible's own words before theology; no 位格 / Trinity vocabulary even to deny it; 他 not 祂;
// 雅偉 (not 雅伟) in Traditional; the Union Version is 和合本 / Chinese Union Version, with no year.
import type { UiLang } from './types.ts';

type Row = Record<UiLang, string>;
const r = (en: string, hans: string, hant: string, ru: string): Row => ({ en, 'zh-Hans': hans, 'zh-Hant': hant, ru });

export const STRINGS = {
  // navigation
  prevChapter: r('Previous chapter', '上一章', '上一章', 'Предыдущая глава'),
  nextChapter: r('Next chapter', '下一章', '下一章', 'Следующая глава'),
  pickChapter: r('Choose book and chapter', '选择书卷和章', '選擇書卷和章', 'Выбрать книгу и главу'),
  chapterN: r('Chapter {n}', '第 {n} 章', '第 {n} 章', 'Глава {n}'),
  oldTestament: r('Old Testament', '旧约', '舊約', 'Ветхий Завет'),
  newTestament: r('New Testament', '新约', '新約', 'Новый Завет'),
  recent: r('Recent', '最近读过', '最近讀過', 'Недавние'),
  chapters: r('Chapters', '章', '章', 'Главы'),
  back: r('Back', '返回', '返回', 'Назад'),
  close: r('Close', '关闭', '關閉', 'Закрыть'),
  done: r('Done', '完成', '完成', 'Готово'),
  // modes
  modeVerse: r('Verses', '逐节', '逐節', 'По стихам'),
  modeParagraph: r('Paragraphs', '段落', '段落', 'Абзацы'),
  modeParallel: r('Parallel', '对照', '對照', 'Параллельно'),
  layout: r('Reading layout', '阅读方式', '閱讀方式', 'Вид чтения'),
  // the edition pill while 对照 is on says how many editions are lined up; the pill beside it (modeParallel) is the switch, so the two never read alike
  parallelN: r('{n} editions', '{n} 个译本', '{n} 個譯本', '{n} издания'),
  // editions
  edition: r('Edition', '译本', '譯本', 'Перевод'),
  chooseEdition: r('Choose an edition', '选择译本', '選擇譯本', 'Выбрать перевод'),
  compareEditions: r('Compare editions', '对照译本', '對照譯本', 'Сравнить переводы'),
  groupEnglish: r('English', 'English', 'English', 'English'),
  // A language group is headed by its own endonym in its own script, as English and Русский are: the Simplified
  // group is 简体中文 on a 繁體 page too (P2-6 — it read 簡體中文, the name of Simplified written in Traditional).
  groupHans: r('简体中文', '简体中文', '简体中文', '简体中文'),
  groupRussian: r('Русский', 'Русский', 'Русский', 'Русский'),
  groupHant: r('繁體中文', '繁體中文', '繁體中文', '繁體中文'),
  maxThree: r('3 is the most', '最多三个', '最多三個', 'Не более трёх'),
  parallelHint: r('Lines appear in this order. The first is the main edition.', '各行按此顺序排列，第一个是主译本。', '各行按此順序排列，第一個是主譯本。', 'Строки идут в этом порядке. Первый — основной перевод.'),
  addToCompare: r('Add an edition to compare', '再加一个译本来对照', '再加一個譯本來對照', 'Добавьте перевод для сравнения'),
  moveUp: r('Move up', '上移', '上移', 'Выше'),
  moveDown: r('Move down', '下移', '下移', 'Ниже'),
  mainEdition: r('Main', '主', '主', 'Основной'),
  licencePD: r('Public domain', '公有领域', '公有領域', 'Общественное достояние'),
  licenceCC0: r('CC0', 'CC0', 'CC0', 'CC0'),
  // the church's own edition, used with permission (Words' record: not public domain): the chip is the (c) sign
  licencePermission: r('©', '©', '©', '©'),
  notInEdition: r('not in this edition', '本译本没有这一节', '本譯本沒有這一節', 'в этом переводе нет этого стиха'),
  editionSwitched: r('Now reading {name}', '现在读 {name}', '現在讀 {name}', 'Теперь читаете: {name}'),
  // selection and copy
  verseN: r('Verse {n}', '第 {n} 节', '第 {n} 節', 'Стих {n}'),
  selectVerse: r('Select verse {n}', '选取第 {n} 节', '選取第 {n} 節', 'Выбрать стих {n}'),
  selectedN: r('{n} selected · {ref}', '已选 {n} 节 · {ref}', '已選 {n} 節 · {ref}', 'Выбрано: {n} \u00b7 {ref}'),
  copy: r('Copy', '复制', '複製', 'Копировать'),
  copyLink: r('Link', '链接', '連結', 'Ссылка'),
  share: r('Share', '分享', '分享', 'Поделиться'),
  shared: r('Shared', '已分享', '已分享', 'Отправлено'),
  shareFailed: r('Sharing is not available here. The passage was copied instead.', '此处无法分享，已改为复制经文。', '此處無法分享，已改為複製經文。', 'Поделиться здесь нельзя. Отрывок скопирован.'),
  selectVerseHint: r('Tap a verse to select it; tap again to clear.', '点一节经文即可选取，再点一次取消。', '點一節經文即可選取，再點一次取消。', 'Коснитесь стиха, чтобы выбрать; ещё раз — снять.'),
  clear: r('Clear', '取消选择', '取消選擇', 'Снять выбор'),
  copied: r('Copied', '已复制', '已複製', 'Скопировано'),
  copiedLimited: r('Copied the first {n} verses (the limit)', '已复制前 {n} 节（以此为限）', '已複製前 {n} 節（以此為限）', 'Скопированы первые {n} стихов (это предел)'),
  linkCopied: r('Link copied', '链接已复制', '連結已複製', 'Ссылка скопирована'),
  copyFailed: r('Copy failed. Select the text and copy it by hand.', '复制失败，请选取文字后手动复制。', '複製失敗，請選取文字後手動複製。', 'Не удалось скопировать. Выделите текст и скопируйте вручную.'),
  nothingToCopy: r('These verses are not in this edition', '这些节在本译本中没有', '這些節在本譯本中沒有', 'Этих стихов нет в этом переводе'),
  // footnotes and headings
  noteN: r('Note {n}', '注 {n}', '註 {n}', 'Примечание {n}'),
  aboutSection: r('About this section', '这一段的背景', '這一段的背景', 'О разделе'),
  // display
  display: r('Display', '显示', '顯示', 'Вид'),
  textSize: r('Text size', '字号', '字號', 'Размер текста'),
  smaller: r('Smaller', '较小', '較小', 'Меньше'),
  larger: r('Larger', '较大', '較大', 'Больше'),
  theme: r('Theme', '主题', '主題', 'Тема'),
  themeAuto: r('Follow system', '跟随系统', '跟隨系統', 'Как в системе'),
  themeDark: r('Dark', '深色', '深色', 'Тёмная'),
  themeLight: r('Light', '浅色', '淺色', 'Светлая'),
  themePaper: r('Paper', '纸', '紙', 'Бумага'),
  // states
  loading: r('Loading…', '加载中…', '載入中…', 'Загрузка\u2026'),
  retry: r('Try again', '重试', '重試', 'Повторить'),
  offlineChapter: r('This chapter is not on this device yet, and you appear to be offline.', '这一章还没有保存在本机，而且你似乎已离线。', '這一章還沒有儲存在本機，而且你似乎已離線。', 'Этой главы ещё нет на устройстве, а вы, похоже, не в сети.'),
  loadFailed: r('This chapter could not be loaded.', '这一章加载失败。', '這一章載入失敗。', 'Не удалось загрузить эту главу.'),
  builtInList: r('Using the built-in list of editions.', '正在使用内置的译本列表。', '正在使用內建的譯本列表。', 'Используется встроенный список переводов.'),
  notReviewed: r('This interface language has not yet been read by a native speaker.', '此界面语言尚未经母语读者审阅。', '此介面語言尚未經母語讀者審閱。', 'Перевод интерфейса ещё не вычитан носителем языка.'),
  // passage (under a picture)
  wholeChapter: r('Read the whole chapter', '读整章', '讀整章', 'Читать всю главу'),
  showMore: r('Show the other {n} verses', '展开其余 {n} 节', '展開其餘 {n} 節', 'Показать остальные стихи: {n}'),
  showLess: r('Show fewer', '收起', '收起', 'Свернуть'),
  passage: r('Passage', '经文', '經文', 'Отрывок'),
  // plates (the painted scenes standing in the text at the verse their event begins)
  openPicture: r('Open the picture', '看这幅画', '看這幅畫', 'Открыть картину'),
  pictureOf: r('{title} — open the picture', '{title} — 看这幅画', '{title} — 看這幅畫', '{title} — открыть картину'),
  // the join between the three doors: this chapter, opened in the church's Bible app (verified route, see
  // src/reader/words-link.ts). The app's own name is Latin in Russian, as its store listing has it.
  continueInWords: r('Continue in Yahweh’s Words', '在《雅伟的话》继续读', '在《雅偉的話》繼續讀', 'Продолжить в Yahweh’s Words'),
  // credit
  creditLabel: r('Edition credit', '译本说明', '譯本說明', 'О переводе'),
  // landmarks
  reader: r('Bible reader', '圣经阅读', '聖經閱讀', 'Чтение Библии'),
  chapterText: r('Chapter text', '本章经文', '本章經文', 'Текст главы'),
  selectionBar: r('Selected verses', '已选经文', '已選經文', 'Выбранные стихи'),
} as const;

export type StringKey = keyof typeof STRINGS;
export type StringOverrides = Partial<Record<StringKey, string>>;

export function t(key: StringKey, ui: UiLang, vars?: Record<string, string | number>, overrides?: StringOverrides): string {
  let s = overrides?.[key] ?? STRINGS[key][ui] ?? STRINGS[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
