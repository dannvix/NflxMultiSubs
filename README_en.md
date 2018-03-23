<img src="docs/icon.png?raw=true" height="48"> NflxMultiSubs
============================================================


Best ever Chrome/Firefox extension to unleash bilingual subtitles on Netflix!


[![Download on Chrome Web Store](docs/chrome-webstore-badge58.png?raw=true)](https://chrome.google.com/webstore/detail/pjhnilfooknlkdonmjnleaomamfehkli/)
[![Download on Firefox Add-ons](docs/firefox-addons-badge58.png?raw=true)](https://addons.mozilla.org/firefox/addon/nflxmultisubs/)


Features
----
- The first unofficial browser extension supporting second subtitle in any language (including those image-based subtitles)
- Smart selection on secondary subitle: display Japanese while watching Japanese animation; display English while watching American films
- Integrated in original Netflix menu. Switch languages in ease without leaving watch page
- All subitltes offered by Netflix are available. No need to search for src files
- Activate 1080p high-res as well :)
- Functionalities to adjust playing speed (with key `[` and `]`)
- Open source!


A picture is worth thousands of words
----------
![Bilingual Subtitles with zh-tw/jp](docs/zh-ja.jpg?raw=true)
![Intergrated in original menu](docs/popup-menu.jpg?raw=true)


User guide & Known issues
-------------------
- Developers are not responsible for any accident caused by this extension. Please use it with cautious.
- This extension is not developed by Netflix, Inc. The copyright belongs to the author.
- This extension might conflict with other existing Netflix extensions (e.g. [netflix-1080p](https://github.com/truedread/netflix-1080p)). Please choose one among these extensions.
- This extension migh conflict with ad-block extensions (e.g. [uBlock Origin](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm)). Please solve it on your own so far XD 
- We haven't coped with text-based subtitles under right-to-left (RTL) system.


Encounter Trouble?
--------------
### Netflix player keeps showing animated circle, pops up error messages afterward
- Usually it happens when switch from "films list" to "watch page".
- Try pressing Refresh (F5) several times XD
- If it still doesn't work, it might be accidentally blocked by "ad-block extensions". Please add `netflix.com` into the white list or temporarily disable it.

### Large gap between main subtitle and secondary subtitle
- Usually it happnes only when the progress bar is being displayed, and it's automatically resolved after the progress bar is hidden.

### Main subtitle moved to center of the visible region
- Usually it happnes only when the progress bar is being displayed, and it's automatically resolved after the progress bar is hidden.

### The font size of English secondary subtitle is too small
- We released `v1.5.0` to solve this issue. Please update your extension. (Restart Chrome or do it manually, see below)

### Hi-res 1080p is not activated
- Please report this issue with the procedure described below.

### Is it only available in Chrome/ Firefox Desktop version?
- Yes. cellphones, tablets, smart TVs, apple TV, chromecast, ... are all not supported.
- Due to technical restriction, they won't be supported in the future. Maybe the only thing we can do is wishing for an official release from Netflix itself.

### Could I load subtitles from other distric/area?
- We repsect Netflix resources, hence currently we only support official subitltes in the watching area (Same langugae set for secondary subtitles and main subtitles).
- We will not add the functionality to upload custom subtitles in the future. 

### Could you add functions to ______?
- This extension only wants to focus the single task: Offer nice watching experience with bilingual subtitles.
- We'll probably not add other functions which the developers don't need so far.


Reporting Issues
--------
- Please help gathering the execution log (as the below picture), and paste it onto [Issues](https://github.com/dannvix/NflxMultiSubs/issues).
    - View > Developer > JavaScript Console
    - Please also write down your chrome/ Firefox's version, this extension's version and other related information.

![JavaScript console logs](docs/js-console.png?raw=true)


How to update Chrome extension?
--------------------------
- It should be automatically done after restarting Chrome.
- If you prefer do it manually without restarting (see below picture)
    - Go to extension manager, check Developer mode
    - Press the fresh button "Update extensions now"
    - Close Developer mode

![Update Chrome extensions manually](docs/chrome-ext-update-manually.png?raw=true)


Let's Oepn source! Willing to contribute?
--------------------------
- Clone the project, and then `$ npm install && npm run build`
- Refer to [TODO.md](TODO.md) for todo list.


Licenses
--------
MIT. Refer to [LICENSE.md](LICENSE.md) for details.
