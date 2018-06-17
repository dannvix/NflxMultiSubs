<i align="center"><a href="TODO_en.md">English</a>, <a href="TODO.md">中文</a></i>


TODO
====
PR's welcome! Thumb rule: keep this extension simple.



Bugfixes
--------
- [ ] Slow downloading for image-based secondary subitles (e.g., zh-TW, jp) (ref. #8)
    - Image-based subtitles come within a Zip archive (a few megs)
    - It takes about 30 secs to download the archive in my environment
    - Root cause is unknown; wild guess: we don't pick CDN properly

- [ ] Vertical primary subtitles can run outside the view port (ref. #1)

- [ ] Time gap of rendering between primary subtitles and secondary subtitles (ref. #9)



Features
--------
- [ ] Show a "What's new" page to the user after updates



Miscellaneous
-------------
- [ ] Performance improvement
    - So far we do lots of things brutely in `window.requestAnimationFrame()`
    - Some procedures in renderer loop might be nonnecessary (some DOM queries ……)

- [ ] Refactoring (Well.. it should be a recurrent task and won't be checked ever XD)
