TODO
====
歡迎送 PR！但請保持本套件簡單易用，太複雜的功能可能不會被 merge 哦！



Bugfixes
--------
- [ ] 從 Netflix 影片目錄跳轉到播放器時，會一直轉圈圈
    - 這是由於本套件預設會將 Netflix 取得 player core 的 GET 攔下，以便 patch code
    - 這個跳轉是用 `history.pushState()` 做的，Chrome 在切換過去之後不會載入套件的 content script
    - 所以就沒人去幫 Netflix 載入播放器 XD
    - 目前的 workaround 是進入播放頁面之後按 refresh，待我們的 content script 掛載即可，但有點影響使用體驗

- [ ] 首次載入 image-based 的第二字幕（如中文、日文）時很慢
    - 因為 image-based subtitles 是個好幾 MB 的 ZIP archive，大概要抓個 30 秒
    - 下載速度慢的原因不明，暫時猜測是我們抓字幕時亂挑 CDN 導致



Features
--------
- [ ] 新增設定介面，在 pop-up 裡可以即時設整並預覽
    - 目前在 `nflxmultisubs.js` 裡有留路了，參見 `gRenderOptions` 變數
    - 第二字幕可用 `render(forced=true)` 來強迫重繪
    - 但主字幕因為是用相對比例方式調整位置與大小，所以強迫重繪前要先記錄下原始數值
    - 本來想用 `chrome.storage.sync()` 來存設定值，但考慮到使用者不同裝置可能需要不同設定，所以還是存在 local 就好

- [ ] 移植至 Firefox
    - 同為 WebExtension 架構，整體差異不大
    - 有些地方的 `chrome` 要改用 `browser`，如 `browser.webRequest.xxx`
    - CSS style 如果有 vendor prefix 的也需要留意

- [ ] 更新之後跳個 What's new 頁面給使用者看看


Miscellaneous
-------------
- [ ] 改進效能
    - 目前很硬幹地在 `window.requestAnimationFrame()` 裡跑一堆東西
    - 這個 renderer loop 應該可以少做一點事情（像是不必要的 DOM queries ……）

- [ ] 改進開發環境，目前都還挺土砲的 XD
    - 每次都會重 build 所有東西，也沒有過 linter
    - 打算整合 [webpack](https://webpack.js.org/) 或 [Rollup](https://rollupjs.org/guide/en)

- [ ] 將文件都變成中英雙語？

- [ ] 原始碼重構（好吧，這應該是個永遠不會被打勾的持續項目 XD）
