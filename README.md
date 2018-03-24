<img src="docs/icon.png?raw=true" height="48"> NflxMultiSubs
============================================================
全球首款支援 Netflix 全語言雙字幕的 Chrome/Firefox 擴充套件，提供您更佳的觀影體驗！  

Best ever Chrome/Firefox extension to unleash bilingual subtitles on Netflix!

[![Download on Chrome Web Store](docs/chrome-webstore-badge58.png?raw=true)](https://chrome.google.com/webstore/detail/pjhnilfooknlkdonmjnleaomamfehkli/)
[![Download on Firefox Add-ons](docs/firefox-addons-badge58.png?raw=true)](https://addons.mozilla.org/firefox/addon/nflxmultisubs/)

***For English Description, please refer to [`README_en.md`](README_en.md).***

特色
----
- 坊間首款全自動支援日語等語言 (image-based) 第二字幕的擴充套件
- 智慧選擇雙語字幕：看日本動畫顯示日語，看美劇顯示英文
- 整合原生 Netflix 選單，不需離開播放介面即可切換語言
- Netflix 有提供的字幕通通可以選，不需要另外找字幕組
- 順便啟用了 1080p 高畫質播放 :)
- 也順便做了調整播放速度的功能（按 `[` 與 `]` 鍵）
- 開放原始碼！



有圖有真相
----------
![中文、日語雙字幕](docs/zh-ja.jpg?raw=true)
![整合原生語言選單](docs/popup-menu.jpg?raw=true)



使用須知 & 已知問題
-------------------
- 使用過程中發生的問題，本套件與開發者概不負責哦，請謹慎使用
- 本套件與 Netflix, Inc. 原廠沒有關係，各資源版權均屬原創作者所有
- 本套件可能與其他 Netflix 相關套件相衝（如 [netflix-1080p](https://github.com/truedread/netflix-1080p)），很遺憾請擇一使用
- 本套件可能與「廣告阻擋套件」（如 [uBlock Origin](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm) 等）相衝，目前請自行解決 XD
- 目前 text-based 第二字幕沒有處理 right-to-left (RTL) 語系



遇到問題了嗎？
--------------
### Netflix 播放器一直轉圈圈，最後跳出錯誤訊息
- 通常從「影片列表」進到「播放頁面」會發生這種狀況
- 多按幾次重新整理 (F5) 試試看 XD
- 還是不行的話，可能是被「廣告阻擋套件」誤判擋下來了，請將 `netflix.com` 加入白名單或暫時停用該套件

### 主字幕跟第二字幕分很開
- 通常只有在進度條顯示的時候才會發生，等到進度條隱藏就好了

### 主字幕跳到畫面中間
- 通常只有在進度條顯示的時候才會發生，等到進度條隱藏就好了

### 第二字幕的英文字超小
- 我們發佈了 `v1.5.0` 來解決這個問題，請更新（重開 Chrome 或手動強制更新，見下方）

### 高畫質 1080p 沒有啟用
- 請依下方提到的步驟來回報問題

### 只能在 Chrome/ Firefox 桌面版用嗎？
- 沒錯，手機、平版電腦、智慧電視、Apple TV、Chromecast、………通通不支援
- 因為技術限制，未來也不會支援這些平台，只能跪求 Netflix 官方釋出囉

### 可以跨區載入字幕嗎？
- 本套件尊重 Netflix 資源，目前只支援該地區官方有提供的字幕（主字幕有什麼語言，第二字幕就有相同選擇）
- 未來也不會加入「自行掛載字幕檔」的功能

### 可不可以加入＿＿＿＿功能？
- 這個套件只想專注做好一件事：提供「雙語字幕」的良好觀影體驗
- 目前開發者沒用到的功能就不會加入



回報問題
--------
- 請幫忙蒐集執行記錄（如下圖），然後貼到 [Issues](https://github.com/dannvix/NflxMultiSubs/issues) 回報
    - View > Developer > JavaScript Console
    - 希望也能同時提供您使用的 Chrome/ Firefox 版本、此套件的版本等資訊

![JavaScript console logs](docs/js-console.png?raw=true)



如何更新 Chrome 套件？
--------------------------
- 重開整個 Chrome 應該就會更新了
- 不想重開 Chrome，手動強制更新（見下圖）
    - 進到套件管理頁面，打勾開發者模式 (Developer mode)
    - 按新鮮出爐的按鈕 Update extensions now
    - 可以關閉 Developer mode 了

![Update Chrome extensions manually](docs/chrome-ext-update-manually.png?raw=true)



開源囉！想一起改進本套件？
--------------------------
- Clone 之後跑 `$ npm install && npm run build`
- 參見 [TODO.md](TODO.md) 的計劃事項



Licenses
--------
MIT. Refer to [LICENSE.md](LICENSE.md) for details.
