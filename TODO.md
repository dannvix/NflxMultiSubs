<i align="center"><a href="TODO_en.md">English</a>, <a href="TODO.md">中文</a></i>


TODO
====
歡迎送 PR！但請保持本套件簡單易用，太複雜的功能可能不會被 merge 哦！



Bugfixes
--------
- [ ] 首次載入 image-based 的第二字幕（如中文、日文）時很慢 (ref. #8)
    - 因為 image-based subtitles 是個好幾 MB 的 ZIP archive，大概要抓個 30 秒
    - 下載速度慢的原因不明，暫時猜測是我們抓字幕時亂挑 CDN 導致

- [ ] 直書主字幕會超出畫面 (ref. #1)

- [ ] 主字幕與次字幕的顯示時間有差異 (ref. #9)



Features
--------
- [ ] 更新之後跳個 What's new 頁面給使用者看看



Miscellaneous
-------------
- [ ] 改進效能
    - 目前很硬幹地在 `window.requestAnimationFrame()` 裡跑一堆東西
    - 這個 renderer loop 應該可以少做一點事情（像是不必要的 DOM queries ……）

- [ ] 原始碼重構（好吧，這應該是個永遠不會被打勾的持續項目 XD）
