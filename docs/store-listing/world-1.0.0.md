# Yahweh's World 1.0.0: store listing drafts

Drafts for the owner's review; nothing here has been entered in any store. Machine-readable copy: `world-1.0.0.json`. Character counts are `len()` (Unicode code points) from a script; every field is within its limit (see the check at the end of the file).

Names (owner, 2026-11-04 — named like Words). The store title is the product's name in that locale's language, on
its own; the combined "雅偉之界 Yahweh's World" is gone from every field.

| store field | en-US | zh-Hans | zh-Hant | ru |
|---|---|---|---|---|
| Apple **Name** | Yahweh's World | 雅伟之界 | 雅偉之界 | Yahweh's World |
| Play **App name** | Yahweh's World | 雅伟之界 (zh-CN) | 雅偉之界 (zh-TW) | Yahweh's World (ru-RU) |
| Microsoft **Product name** | Yahweh's World | 雅伟之界 | 雅偉之界 | Yahweh's World |

The label under the icon is shorter and is NOT a store field: it comes from the build (`PRODUCT` in
`src/config/site.ts`) — `World` (en), `雅伟之界` (zh-Hans), `雅偉之界` (zh-Hant), `Мир` (ru).

### Exactly which console fields change from the 1.0.0 drafts

* **App Store Connect** → your app → the version → *App Information*: **Name** in each of the four localisations
  (en-US, zh-Hans, zh-Hant, ru). Nothing else changes: subtitle, promotional text, keywords, description and
  What's New are unchanged.
* **Google Play Console** → *Grow* → *Store presence* → *Main store listing*: **App name** in en-US, zh-CN, zh-TW
  and ru-RU. Short and full description unchanged.
* **Microsoft Partner Center** → *Store listings*: **Product name** in en-us, zh-hans, zh-hant and ru-ru. (The MSIX
  package identity `YahwehsPeople.YahwehsWorld` and the reserved name are untouched.)
* Nothing in any console carries the launcher label, so no field changes for that.

Support and marketing URL: https://world.yahwehword.com

## Apple App Store

Locales in App Store Connect: English (U.S.) = `en-US`; Chinese, Simplified = `zh-Hans`; Chinese, Traditional = `zh-Hant`; Russian = `ru`. One record serves iPhone, iPad and Mac. Primary language: English.

### English (en-US)

**Name** (14/30 chars): Yahweh's World

**Subtitle** (26/30 chars): 1,443 Bible scenes to read

**Promotional text** (157/170 chars): Look at the scene, read the passage. 1,443 illustrated Bible scenes from Genesis to Revelation, each with the Bible text beside it. Free, no ads, no account.

**Keywords** (98/100 chars): Bible,pictures,illustrated,scenes,Genesis,chapter,KJV,BSB,ASV,WEB,Yahweh,Russian,Chinese,Scripture

**Description** (1347/4000 chars)

```text
Yahweh's World is a gallery of 1,443 illustrated Bible scenes, from Genesis to Revelation. Every picture is tied to its chapter, and the Bible text sits right beside it, so you can look at a scene and then read the passage it shows.

THE PICTURES
• 1,443 scenes across the whole Bible. Browse by book, or start with the scene of the day on the home page.
• Artist's impressions drawn with AI tools and reviewed verse by verse; not reconstructions. The pictures carry no text; every word is on the page.
• They are illustrations to help you see the scenes. The Bible text is what to read.

READ BESIDE THE PICTURE
• A Bible reader built in beside every picture, in eight editions: the Berean Standard Bible, the World English Bible and the American Standard Version with the name Yahweh restored; the King James Version; the Chinese Union Version-based 和合本 in Simplified and Traditional characters, with the name Yahweh; and the Russian Synodal Bible, with and without the name Yahweh restored.
• Choose the edition you like. The app remembers it.
• Four languages: English, 简体中文, 繁體中文 and Русский.
• A feedback button on every picture, if something looks wrong or you have a thought.

SIMPLE
• Pictures you have opened keep working without a connection.
• Free. No ads, no account, no tracking.

Questions or feedback: https://world.yahwehword.com
```

**What's New (1.0.0)** (257/4000 chars): First release. 1,443 illustrated Bible scenes from Genesis to Revelation, each tied to its chapter, with a Bible reader beside every picture in eight editions. English, Simplified Chinese, Traditional Chinese and Russian. A feedback button on every picture.

**Support URL**: https://world.yahwehword.com  
**Marketing URL**: https://world.yahwehword.com

### 简体中文 (zh-Hans)

**Name** (4/30 chars): 雅伟之界

**Subtitle** (15/30 chars): 1443 幅圣经画卷，图文对读

**Promotional text** (53/170 chars): 看一幕画，读一章经。1443 幅圣经插画，从创世记到启示录，每幅画旁边就是经文。免费，没有广告，不用注册。

**Keywords** (55/100 chars): 圣经,插画,画卷,圣经故事,创世记,章节,经文,和合本,雅伟,耶和华,KJV,BSB,ASV,俄文,繁体,简体

**Description** (465/4000 chars)

```text
雅伟之界是一卷圣经画卷：1443 幅插画，从创世记到启示录。每幅画都对应所在的那一章，经文就在画的旁边，看完这一幕，就可以接着读它所描绘的经文。

画卷
• 1443 幅画，涵盖整本圣经。可以按书卷浏览，也可以从首页的“今日一幕”开始。
• 这些画是画家的想象，用 AI 工具绘制，并逐节对照经文审核；不是考古复原。画里没有文字，说明都在页面上。
• 它们只是帮助你看见经文场景的插画，要读的是经文本身。

画旁读经
• 每幅画旁都有内置的圣经阅读器，共八个译本：带“雅伟”之名的 BSB、WEB 和 ASV，KJV，简体与繁体的和合本雅伟版，以及俄文圣经（有“雅伟”之名与无此名两种）。
• 译本可以自选，应用会记住你的选择。
• 四种语言：English、简体中文、繁體中文、Русский，随时切换。
• 每幅画都有反馈按钮，发现问题或有想法，随手告诉我们。

简单
• 打开过的画，没有网络也能继续看。
• 免费，没有广告，不用注册账号，也不追踪你。

问题与反馈：https://world.yahwehword.com
```

**What's New (1.0.0)** (82/4000 chars): 首个版本。1443 幅圣经插画，从创世记到启示录，每幅都对应所在的章；每幅画旁有内置圣经阅读器，共八个译本。支持英文、简体中文、繁体中文和俄文，每幅画都有反馈按钮。

**Support URL**: https://world.yahwehword.com  
**Marketing URL**: https://world.yahwehword.com

### 繁體中文 (zh-Hant)

**Name** (4/30 chars): 雅偉之界

**Subtitle** (15/30 chars): 1443 幅聖經畫卷，圖文對讀

**Promotional text** (53/170 chars): 看一幕畫，讀一章經。1443 幅聖經插畫，從創世記到啟示錄，每幅畫旁邊就是經文。免費，沒有廣告，不必註冊。

**Keywords** (55/100 chars): 聖經,插畫,畫卷,聖經故事,創世記,章節,經文,和合本,雅偉,耶和華,KJV,BSB,ASV,俄文,繁體,簡體

**Description** (471/4000 chars)

```text
雅偉之界是一卷聖經畫卷：1443 幅插畫，從創世記到啟示錄。每幅畫都對應所在的那一章，經文就在畫的旁邊，看完這一幕，就可以接著讀它所描繪的經文。

畫卷
• 1443 幅畫，涵蓋整本聖經。可以依書卷瀏覽，也可以從首頁的「今日一幕」開始。
• 這些畫是畫家的想像，用 AI 工具繪製，並逐節對照經文審核；不是考古復原。畫裡沒有文字，說明都在頁面上。
• 它們只是幫助你看見經文場景的插畫，要讀的是經文本身。

畫旁讀經
• 每幅畫旁都有內建的聖經閱讀器，共八個譯本：帶「雅偉」之名的 BSB、WEB 和 ASV，KJV，簡體與繁體的和合本雅偉版，以及俄文聖經（有「雅偉」之名與無此名兩種）。
• 譯本可以自選，應用程式會記住你的選擇。
• 四種語言：English、簡體中文、繁體中文、Русский，隨時切換。
• 每幅畫都有意見回饋按鈕，發現問題或有想法，隨手告訴我們。

簡單
• 開啟過的畫，沒有網路也能繼續看。
• 免費，沒有廣告，不必註冊帳號，也不追蹤你。

問題與意見回饋：https://world.yahwehword.com
```

**What's New (1.0.0)** (84/4000 chars): 首個版本。1443 幅聖經插畫，從創世記到啟示錄，每幅都對應所在的章；每幅畫旁有內建聖經閱讀器，共八個譯本。支援英文、簡體中文、繁體中文和俄文，每幅畫都有意見回饋按鈕。

**Support URL**: https://world.yahwehword.com  
**Marketing URL**: https://world.yahwehword.com

### Русский (ru)

**Name** (14/30 chars): Yahweh's World

**Subtitle** (27/30 chars): Мир Яхве: 1443 сцены Библии

**Promotional text** (148/170 chars): Посмотрите сцену и прочтите отрывок. 1443 иллюстрации к Библии от Бытия до Откровения, рядом с каждой — текст. Бесплатно, без рекламы и регистрации.

**Keywords** (95/100 chars): Библия,иллюстрации,картины,сцены,Бытие,глава,Писание,Синодальный,Яхве,KJV,BSB,ASV,WEB,китайский

**Description** (1321/4000 chars)

```text
«Мир Яхве» — галерея из 1443 иллюстраций к Библии, от Бытия до Откровения. Каждая картина привязана к своей главе, а текст Библии лежит рядом: посмотрите на сцену и сразу прочтите отрывок, который она показывает.

КАРТИНЫ
• 1443 сцены из всей Библии. Листайте по книгам или начните со сцены дня на главной странице.
• Художественные образы, созданные с помощью ИИ-инструментов и проверенные стих за стихом; это не реконструкции. На картинах нет текста: все слова — на странице.
• Это иллюстрации, которые помогают увидеть описанные сцены. Читать нужно сам библейский текст.

ЧИТАЙТЕ РЯДОМ С КАРТИНОЙ
• Рядом с каждой картиной — встроенное чтение Библии в восьми изданиях: Berean Standard Bible, World English Bible и American Standard Version с восстановленным именем Яхве; King James Version; китайская Библия на основе «Хэхэбэнь» в упрощённом и традиционном написании, с именем Яхве; Синодальный перевод — с восстановленным именем Яхве и без него.
• Издание выбираете вы, приложение его запоминает.
• Четыре языка интерфейса: English, 简体中文, 繁體中文 и Русский.
• На каждой картине есть кнопка обратной связи: если что-то не так или хочется поделиться мыслью.

ПРОСТО
• Открытые картины продолжают работать без интернета.
• Бесплатно. Без рекламы, без регистрации, без слежки.

Вопросы и отзывы: https://world.yahwehword.com
```

**What's New (1.0.0)** (268/4000 chars): Первая версия. 1443 иллюстрации к Библии от Бытия до Откровения, каждая привязана к своей главе; рядом с каждой картиной — чтение Библии в восьми изданиях. Английский, китайский (упрощённый и традиционный) и русский языки. На каждой картине есть кнопка обратной связи.

**Support URL**: https://world.yahwehword.com  
**Marketing URL**: https://world.yahwehword.com

## Google Play

Play locale codes used: `en-US`, `zh-CN` (Simplified), `zh-TW` (Traditional), `ru-RU`.

### English (en-US) (en-US)

**Title** (14/30 chars): Yahweh's World

**Short description** (77/80 chars): 1,443 illustrated Bible scenes with the Bible text beside each. Free, no ads.

**Full description** (1347/4000 chars)

```text
Yahweh's World is a gallery of 1,443 illustrated Bible scenes, from Genesis to Revelation. Every picture is tied to its chapter, and the Bible text sits right beside it, so you can look at a scene and then read the passage it shows.

THE PICTURES
• 1,443 scenes across the whole Bible. Browse by book, or start with the scene of the day on the home page.
• Artist's impressions drawn with AI tools and reviewed verse by verse; not reconstructions. The pictures carry no text; every word is on the page.
• They are illustrations to help you see the scenes. The Bible text is what to read.

READ BESIDE THE PICTURE
• A Bible reader built in beside every picture, in eight editions: the Berean Standard Bible, the World English Bible and the American Standard Version with the name Yahweh restored; the King James Version; the Chinese Union Version-based 和合本 in Simplified and Traditional characters, with the name Yahweh; and the Russian Synodal Bible, with and without the name Yahweh restored.
• Choose the edition you like. The app remembers it.
• Four languages: English, 简体中文, 繁體中文 and Русский.
• A feedback button on every picture, if something looks wrong or you have a thought.

SIMPLE
• Pictures you have opened keep working without a connection.
• Free. No ads, no account, no tracking.

Questions or feedback: https://world.yahwehword.com
```

### 简体中文 (zh-Hans) (zh-CN)

**Title** (4/30 chars): 雅伟之界

**Short description** (34/80 chars): 1443 幅圣经插画，画旁就是经文，从创世记到启示录。免费，无广告。

**Full description** (465/4000 chars)

```text
雅伟之界是一卷圣经画卷：1443 幅插画，从创世记到启示录。每幅画都对应所在的那一章，经文就在画的旁边，看完这一幕，就可以接着读它所描绘的经文。

画卷
• 1443 幅画，涵盖整本圣经。可以按书卷浏览，也可以从首页的“今日一幕”开始。
• 这些画是画家的想象，用 AI 工具绘制，并逐节对照经文审核；不是考古复原。画里没有文字，说明都在页面上。
• 它们只是帮助你看见经文场景的插画，要读的是经文本身。

画旁读经
• 每幅画旁都有内置的圣经阅读器，共八个译本：带“雅伟”之名的 BSB、WEB 和 ASV，KJV，简体与繁体的和合本雅伟版，以及俄文圣经（有“雅伟”之名与无此名两种）。
• 译本可以自选，应用会记住你的选择。
• 四种语言：English、简体中文、繁體中文、Русский，随时切换。
• 每幅画都有反馈按钮，发现问题或有想法，随手告诉我们。

简单
• 打开过的画，没有网络也能继续看。
• 免费，没有广告，不用注册账号，也不追踪你。

问题与反馈：https://world.yahwehword.com
```

### 繁體中文 (zh-Hant) (zh-TW)

**Title** (4/30 chars): 雅偉之界

**Short description** (34/80 chars): 1443 幅聖經插畫，畫旁就是經文，從創世記到啟示錄。免費，無廣告。

**Full description** (471/4000 chars)

```text
雅偉之界是一卷聖經畫卷：1443 幅插畫，從創世記到啟示錄。每幅畫都對應所在的那一章，經文就在畫的旁邊，看完這一幕，就可以接著讀它所描繪的經文。

畫卷
• 1443 幅畫，涵蓋整本聖經。可以依書卷瀏覽，也可以從首頁的「今日一幕」開始。
• 這些畫是畫家的想像，用 AI 工具繪製，並逐節對照經文審核；不是考古復原。畫裡沒有文字，說明都在頁面上。
• 它們只是幫助你看見經文場景的插畫，要讀的是經文本身。

畫旁讀經
• 每幅畫旁都有內建的聖經閱讀器，共八個譯本：帶「雅偉」之名的 BSB、WEB 和 ASV，KJV，簡體與繁體的和合本雅偉版，以及俄文聖經（有「雅偉」之名與無此名兩種）。
• 譯本可以自選，應用程式會記住你的選擇。
• 四種語言：English、簡體中文、繁體中文、Русский，隨時切換。
• 每幅畫都有意見回饋按鈕，發現問題或有想法，隨手告訴我們。

簡單
• 開啟過的畫，沒有網路也能繼續看。
• 免費，沒有廣告，不必註冊帳號，也不追蹤你。

問題與意見回饋：https://world.yahwehword.com
```

### Русский (ru) (ru-RU)

**Title** (14/30 chars): Yahweh's World

**Short description** (74/80 chars): 1443 иллюстрации к Библии, рядом с каждой — текст. Бесплатно, без рекламы.

**Full description** (1321/4000 chars)

```text
«Мир Яхве» — галерея из 1443 иллюстраций к Библии, от Бытия до Откровения. Каждая картина привязана к своей главе, а текст Библии лежит рядом: посмотрите на сцену и сразу прочтите отрывок, который она показывает.

КАРТИНЫ
• 1443 сцены из всей Библии. Листайте по книгам или начните со сцены дня на главной странице.
• Художественные образы, созданные с помощью ИИ-инструментов и проверенные стих за стихом; это не реконструкции. На картинах нет текста: все слова — на странице.
• Это иллюстрации, которые помогают увидеть описанные сцены. Читать нужно сам библейский текст.

ЧИТАЙТЕ РЯДОМ С КАРТИНОЙ
• Рядом с каждой картиной — встроенное чтение Библии в восьми изданиях: Berean Standard Bible, World English Bible и American Standard Version с восстановленным именем Яхве; King James Version; китайская Библия на основе «Хэхэбэнь» в упрощённом и традиционном написании, с именем Яхве; Синодальный перевод — с восстановленным именем Яхве и без него.
• Издание выбираете вы, приложение его запоминает.
• Четыре языка интерфейса: English, 简体中文, 繁體中文 и Русский.
• На каждой картине есть кнопка обратной связи: если что-то не так или хочется поделиться мыслью.

ПРОСТО
• Открытые картины продолжают работать без интернета.
• Бесплатно. Без рекламы, без регистрации, без слежки.

Вопросы и отзывы: https://world.yahwehword.com
```

## Microsoft Store

Partner Center locale codes: `en-us`, `zh-hans`, `zh-hant`, `ru-ru`. Product name reserved in Partner Center: Yahweh's World (the localised product names below are listing names).

### English (en-US) (en-us)

**Product name** (14/100 chars): Yahweh's World

**Short description** (84 chars): A gallery of 1,443 illustrated Bible scenes with the Bible text beside each picture.

**Description** (1347/10000 chars)

```text
Yahweh's World is a gallery of 1,443 illustrated Bible scenes, from Genesis to Revelation. Every picture is tied to its chapter, and the Bible text sits right beside it, so you can look at a scene and then read the passage it shows.

THE PICTURES
• 1,443 scenes across the whole Bible. Browse by book, or start with the scene of the day on the home page.
• Artist's impressions drawn with AI tools and reviewed verse by verse; not reconstructions. The pictures carry no text; every word is on the page.
• They are illustrations to help you see the scenes. The Bible text is what to read.

READ BESIDE THE PICTURE
• A Bible reader built in beside every picture, in eight editions: the Berean Standard Bible, the World English Bible and the American Standard Version with the name Yahweh restored; the King James Version; the Chinese Union Version-based 和合本 in Simplified and Traditional characters, with the name Yahweh; and the Russian Synodal Bible, with and without the name Yahweh restored.
• Choose the edition you like. The app remembers it.
• Four languages: English, 简体中文, 繁體中文 and Русский.
• A feedback button on every picture, if something looks wrong or you have a thought.

SIMPLE
• Pictures you have opened keep working without a connection.
• Free. No ads, no account, no tracking.

Questions or feedback: https://world.yahwehword.com
```

**What's new in this version** (184 chars): First release. 1,443 illustrated Bible scenes from Genesis to Revelation, a Bible reader beside every picture in eight editions, four languages, and a feedback button on every picture.

**Features** (three short bullets):

- 1,443 illustrated scenes, Genesis to Revelation (47 chars)
- Bible reader beside every picture, eight editions (49 chars)
- English, 简体, 繁體, Русский; free, no ads, no account (50 chars)

### 简体中文 (zh-Hans) (zh-hans)

**Product name** (4/100 chars): 雅伟之界

**Short description** (27 chars): 1443 幅圣经插画，每幅画旁都有经文，免费，无广告。

**Description** (465/10000 chars)

```text
雅伟之界是一卷圣经画卷：1443 幅插画，从创世记到启示录。每幅画都对应所在的那一章，经文就在画的旁边，看完这一幕，就可以接着读它所描绘的经文。

画卷
• 1443 幅画，涵盖整本圣经。可以按书卷浏览，也可以从首页的“今日一幕”开始。
• 这些画是画家的想象，用 AI 工具绘制，并逐节对照经文审核；不是考古复原。画里没有文字，说明都在页面上。
• 它们只是帮助你看见经文场景的插画，要读的是经文本身。

画旁读经
• 每幅画旁都有内置的圣经阅读器，共八个译本：带“雅伟”之名的 BSB、WEB 和 ASV，KJV，简体与繁体的和合本雅伟版，以及俄文圣经（有“雅伟”之名与无此名两种）。
• 译本可以自选，应用会记住你的选择。
• 四种语言：English、简体中文、繁體中文、Русский，随时切换。
• 每幅画都有反馈按钮，发现问题或有想法，随手告诉我们。

简单
• 打开过的画，没有网络也能继续看。
• 免费，没有广告，不用注册账号，也不追踪你。

问题与反馈：https://world.yahwehword.com
```

**What's new in this version** (59 chars): 首个版本。1443 幅圣经插画，从创世记到启示录；每幅画旁有圣经阅读器，共八个译本；支持四种语言，每幅画都有反馈按钮。

**Features** (three short bullets):

- 1443 幅插画，创世记到启示录 (16 chars)
- 每幅画旁都有圣经阅读器，八个译本 (16 chars)
- 四种语言；免费，无广告，不用注册 (16 chars)

### 繁體中文 (zh-Hant) (zh-hant)

**Product name** (4/100 chars): 雅偉之界

**Short description** (27 chars): 1443 幅聖經插畫，每幅畫旁都有經文，免費，無廣告。

**Description** (471/10000 chars)

```text
雅偉之界是一卷聖經畫卷：1443 幅插畫，從創世記到啟示錄。每幅畫都對應所在的那一章，經文就在畫的旁邊，看完這一幕，就可以接著讀它所描繪的經文。

畫卷
• 1443 幅畫，涵蓋整本聖經。可以依書卷瀏覽，也可以從首頁的「今日一幕」開始。
• 這些畫是畫家的想像，用 AI 工具繪製，並逐節對照經文審核；不是考古復原。畫裡沒有文字，說明都在頁面上。
• 它們只是幫助你看見經文場景的插畫，要讀的是經文本身。

畫旁讀經
• 每幅畫旁都有內建的聖經閱讀器，共八個譯本：帶「雅偉」之名的 BSB、WEB 和 ASV，KJV，簡體與繁體的和合本雅偉版，以及俄文聖經（有「雅偉」之名與無此名兩種）。
• 譯本可以自選，應用程式會記住你的選擇。
• 四種語言：English、簡體中文、繁體中文、Русский，隨時切換。
• 每幅畫都有意見回饋按鈕，發現問題或有想法，隨手告訴我們。

簡單
• 開啟過的畫，沒有網路也能繼續看。
• 免費，沒有廣告，不必註冊帳號，也不追蹤你。

問題與意見回饋：https://world.yahwehword.com
```

**What's new in this version** (61 chars): 首個版本。1443 幅聖經插畫，從創世記到啟示錄；每幅畫旁有聖經閱讀器，共八個譯本；支援四種語言，每幅畫都有意見回饋按鈕。

**Features** (three short bullets):

- 1443 幅插畫，創世記到啟示錄 (16 chars)
- 每幅畫旁都有聖經閱讀器，八個譯本 (16 chars)
- 四種語言；免費，無廣告，不必註冊 (16 chars)

### Русский (ru) (ru-ru)

**Product name** (14/100 chars): Yahweh's World

**Short description** (82 chars): 1443 иллюстрации к Библии, рядом с каждой — текст Писания. Бесплатно, без рекламы.

**Description** (1321/10000 chars)

```text
«Мир Яхве» — галерея из 1443 иллюстраций к Библии, от Бытия до Откровения. Каждая картина привязана к своей главе, а текст Библии лежит рядом: посмотрите на сцену и сразу прочтите отрывок, который она показывает.

КАРТИНЫ
• 1443 сцены из всей Библии. Листайте по книгам или начните со сцены дня на главной странице.
• Художественные образы, созданные с помощью ИИ-инструментов и проверенные стих за стихом; это не реконструкции. На картинах нет текста: все слова — на странице.
• Это иллюстрации, которые помогают увидеть описанные сцены. Читать нужно сам библейский текст.

ЧИТАЙТЕ РЯДОМ С КАРТИНОЙ
• Рядом с каждой картиной — встроенное чтение Библии в восьми изданиях: Berean Standard Bible, World English Bible и American Standard Version с восстановленным именем Яхве; King James Version; китайская Библия на основе «Хэхэбэнь» в упрощённом и традиционном написании, с именем Яхве; Синодальный перевод — с восстановленным именем Яхве и без него.
• Издание выбираете вы, приложение его запоминает.
• Четыре языка интерфейса: English, 简体中文, 繁體中文 и Русский.
• На каждой картине есть кнопка обратной связи: если что-то не так или хочется поделиться мыслью.

ПРОСТО
• Открытые картины продолжают работать без интернета.
• Бесплатно. Без рекламы, без регистрации, без слежки.

Вопросы и отзывы: https://world.yahwehword.com
```

**What's new in this version** (177 chars): Первая версия. 1443 иллюстрации к Библии от Бытия до Откровения, чтение Библии рядом с каждой картиной в восьми изданиях, четыре языка и кнопка обратной связи на каждой картине.

**Features** (three short bullets):

- 1443 иллюстрации, от Бытия до Откровения (40 chars)
- Чтение рядом с картиной, восемь изданий (39 chars)
- Четыре языка; бесплатно, без рекламы и регистрации (50 chars)

## Screenshots needed

Sizes below are the store requirements as I know them; check each console when uploading, because Apple and Google change accepted sizes. Existing images are in `docs/evidence/shell-2026-11/` (they are test evidence from simulators and an emulator, not store-ready: no device frame, some with a status bar and the Duo/foldable shape).

**Apple App Store** (screenshots per locale; upload the 6.9" and 13" sets and Apple scales down to smaller devices; 1 to 10 per size)
- iPhone 6.9": 1320x2868 (also accepted 1290x2796 or 1260x2736), portrait.
- iPad 13": 2064x2752 (or 2048x2732), portrait.
- Mac: 1280x800, 1440x900, 2560x1600 or 2880x1800 (16:10). Mac is a separate set; none exists yet.
- Candidates: `duo-home.png`, `duo-picture.png`, `duo-picture2.png`, `duo-picture3.png`, `duo-scenes.png`, `duo-zhhant.png` (1398x2034, foldable shape, need re-capture at an iPhone 6.9" size); `ipad-home.png`, `ipad-picture.png`, `ipad-bible-ru.png`, `ipad-feedback.png` (1668x2420, iPad 11"/12.9" shape, need re-capture at 2064x2752 or 2048x2732). `ipad-bible-ru.png` shows the Russian reader.

**Google Play** (2 to 8 per type)
- Phone: 1080x1920 up to 1080x3840 (16:9 to 9:16, each side 320 to 3840 px). `android-home.png`, `android-scenes.png`, `android-after-statusbar.png` (1080x2400) qualify.
- 7" tablet: 1200x1920 or similar (min 320 px, max 3840 px, ratio at most 2:1); none exists.
- 10" tablet: 1600x2560 or similar; `ipad-home.png`, `ipad-picture.png`, `ipad-bible-ru.png`, `ipad-feedback.png` (1668x2420) fit the ratio but are iPad shots, so re-capture on an Android tablet.
- App icon: 512x512 PNG (32-bit, up to 1 MB); from the icon in `src-tauri/icons/` once the owner chooses the final mark.
- Feature graphic: 1024x500 JPG or PNG; none exists, make it from a picture plus the name.

**Microsoft Store** (1 to 10 screenshots, PNG, up to 50 MB each)
- Desktop screenshots: at least 1366x768 (up to 3840x2160); 16:9 preferred. None exists (Windows is not built yet); use the web build in a 1366x768 or larger window until then.
- Optional: store logo tiles (300x300 and 150x150 minimum set in the Partner Center listing) from the same icon; promo art 1080x1080 or 1920x1080 optional.
- Existing images are all portrait phone/tablet shots and do not meet the desktop shape.

## Counts check

Run at write time: every field is at or under its limit, no field contains the year 1919, trinitarian vocabulary, or the words official/inspired, Apple keywords contain no spaces after commas, and the Simplified and Traditional listings contain no characters of the other script from a probe set. Result: **PASS**

| Store | Locale | Field | Chars | Limit |
|---|---|---|---|---|
| apple | en-US | name | 19 | 30 |
| apple | en-US | subtitle | 26 | 30 |
| apple | en-US | promotionalText | 157 | 170 |
| apple | en-US | description | 1347 | 4000 |
| apple | en-US | keywords | 98 | 100 |
| apple | en-US | whatsNew | 257 | 4000 |
| apple | zh-Hans | name | 19 | 30 |
| apple | zh-Hans | subtitle | 15 | 30 |
| apple | zh-Hans | promotionalText | 53 | 170 |
| apple | zh-Hans | description | 465 | 4000 |
| apple | zh-Hans | keywords | 55 | 100 |
| apple | zh-Hans | whatsNew | 82 | 4000 |
| apple | zh-Hant | name | 19 | 30 |
| apple | zh-Hant | subtitle | 15 | 30 |
| apple | zh-Hant | promotionalText | 53 | 170 |
| apple | zh-Hant | description | 471 | 4000 |
| apple | zh-Hant | keywords | 55 | 100 |
| apple | zh-Hant | whatsNew | 84 | 4000 |
| apple | ru | name | 19 | 30 |
| apple | ru | subtitle | 27 | 30 |
| apple | ru | promotionalText | 148 | 170 |
| apple | ru | description | 1321 | 4000 |
| apple | ru | keywords | 95 | 100 |
| apple | ru | whatsNew | 268 | 4000 |
| play | en-US | title | 19 | 30 |
| play | en-US | shortDescription | 77 | 80 |
| play | en-US | fullDescription | 1347 | 4000 |
| play | zh-CN | title | 19 | 30 |
| play | zh-CN | shortDescription | 34 | 80 |
| play | zh-CN | fullDescription | 465 | 4000 |
| play | zh-TW | title | 19 | 30 |
| play | zh-TW | shortDescription | 34 | 80 |
| play | zh-TW | fullDescription | 471 | 4000 |
| play | ru-RU | title | 19 | 30 |
| play | ru-RU | shortDescription | 74 | 80 |
| play | ru-RU | fullDescription | 1321 | 4000 |
| microsoft | en-us | name | 19 | 100 |
| microsoft | en-us | shortDescription | 84 | 100 |
| microsoft | en-us | description | 1347 | 10000 |
| microsoft | en-us | whatsNew | 184 | 1500 |
| microsoft | zh-hans | name | 19 | 100 |
| microsoft | zh-hans | shortDescription | 27 | 100 |
| microsoft | zh-hans | description | 465 | 10000 |
| microsoft | zh-hans | whatsNew | 59 | 1500 |
| microsoft | zh-hant | name | 19 | 100 |
| microsoft | zh-hant | shortDescription | 27 | 100 |
| microsoft | zh-hant | description | 471 | 10000 |
| microsoft | zh-hant | whatsNew | 61 | 1500 |
| microsoft | ru-ru | name | 19 | 100 |
| microsoft | ru-ru | shortDescription | 82 | 100 |
| microsoft | ru-ru | description | 1321 | 10000 |
| microsoft | ru-ru | whatsNew | 177 | 1500 |