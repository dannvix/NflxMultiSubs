TODO
====
Welcome to make PR! But please maintain the simplicity and easiness of this project. We'll not merge too complicated functionalities!



Bugfixes
--------
- [ ] The initial loading of image-based secondary subitles (e.g. zh-tw, jp) is quite slow
    - Because image-based subtitle is an ZIP archive with ~MB size. It takes about 30 seconds.
    - The reason of slow download speed is still unknown. Current guess is that we did not select resource CDN properly.



Features
--------
- [ ] Create setting interface to make adjustment previewable in pop-up
    - Configure `gRenderOptions` by message port and call `gRendererLoop.setRenderDirty()` to force rerender, enabling preview.
    - Considering the fact that multiple devices might need different settings for the same user, it's recommended to use `chrome.storage.local` instead of normally adopted `chrome.storage.sync` to store user settings.


- [ ] Create a "What's new" page whenever there is an update



Miscellaneous
-------------
- [ ] Performance Improvement
    - So far we do lots of things brutely in `window.requestAnimationFrame()`
    - Some procedures in renderer loop might be nonnecessary (like irrelevant DOM queries ...)

- [x] Tranlate documentation to both Chinese and English?

- [ ] Refactoring (Well.. it should be a recurrent task and won't be checked ever XD)
