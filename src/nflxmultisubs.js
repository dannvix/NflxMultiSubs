const console = require('./console');
const JSZip = require('jszip');
const kDefaultSettings = require('./default-settings');
const PlaybackRateController = require('./playback-rate-controller');

////////////////////////////////////////////////////////////////////////////////

// Hook JSON.parse() and attempt to intercept the manifest
// For cadmium-playercore-6.0022.710.042.js and later
const hookJsonParseAndAddCallback = function(_window) {
  const _parse = JSON.parse;
  _window.JSON.parse = (...args) => {
      const result = _parse.call(JSON, ...args);
      if (result && result.result && result.result.movieId) {
          const movieId = result.result.movieId
          console.log(`Intercepted manifest ${movieId}`);
          window.__NflxMultiSubs.updateManifest(result.result);
      }
      return result;
  };
};
hookJsonParseAndAddCallback(window);


// hook `history.pushState()` as there is not "pushstate" event in DOM API
// Because Netflix preload manifests when the user hovers mouse over movies on index page,
// our .updateManifest() won't be trigger after user clicks a movie to start watching (they must reload the player page)
(() => {
  const _pushState = history.pushState;
  history.pushState = (state, ...args) => {
    _pushState.call(history, state, ...args);
    console.log(`pushState: ${state.url}`);

    const movieIdInUrl = extractMovieIdFromUrl();
    if (!movieIdInUrl) return;
    console.log(`Movie changed, movieId: ${movieIdInUrl}`);
    nflxMultiSubsManager.activateManifest(movieIdInUrl);
  };
})();

////////////////////////////////////////////////////////////////////////////////

// global states
let gSubtitles = [],
  gSubtitleMenu;
let gMsgPort, gRendererLoop;
let gVideoRatio = 1080 / 1920;
let gRenderOptions = Object.assign({}, kDefaultSettings);

////////////////////////////////////////////////////////////////////////////////

class SubtitleBase {
  constructor(lang, bcp47, urls) {
    this.state = 'GENESIS';
    this.active = false;
    this.lang = lang;
    this.bcp47 = bcp47;
    this.urls = urls;
    this.extentWidth = undefined;
    this.extentHeight = undefined;
    this.lines = undefined;
    this.lastRenderedIds = undefined;
  }

  activate(options) {
    return new Promise((resolve, reject) => {
      this.active = true;
      if (this.state === 'GENESIS') {
        this.state = 'LOADING';
        console.log(`Subtitle "${this.lang}" downloading`);
        this._download().then(() => {
          this.state = 'READY';
          console.log(`Subtitle "${this.lang}" loaded`);
          resolve(this);
        });
      }
    });
  }

  deactivate() {
    this.active = false;
  }

  render(seconds, options, forced) {
    if (!this.active || this.state !== 'READY' || !this.lines) return [];
    const lines = this.lines.filter(
      line => line.begin <= seconds && seconds <= line.end
    );
    const ids = lines
      .map(line => line.id)
      .sort()
      .toString();

    if (this.lastRenderedIds === ids && !forced) return null;
    this.lastRenderedIds = ids;
    return this._render(lines, options);
  }

  getExtent() {
    return [this.extentWidth, this.extentHeight];
  }

  setExtent(width, height) {
    [this.extentWidth, this.extentHeight] = [width, height];
  }

  _download() {
    if (!this.urls) return Promise.resolve();

    console.debug('Selecting fastest server, candidates: ',
      this.urls.map(u => u.substr(0, 24)));

    return Promise.race(
      this.urls.map(url => fetch(new Request(url), {method: 'HEAD'}))
    ).then(r => {
      const url = r.url;
      console.debug(`Fastest: ${url.substr(0, 24)}`);
      return this._extract(fetch(url));
    });
  }

  _render(lines, options) {
    // implemented in derived class
  }

  _extract(fetchPromise) {
    // extract contents downloaded from fetch()
    // implemented in derived class
  }
}

class DummySubtitle extends SubtitleBase {
  constructor() {
    super('Off');
  }

  activate() {
    this.active = true;
    return Promise.resolve();
  }
}

class TextSubtitle extends SubtitleBase {
  constructor(...args) {
    super(...args);
  }

  _extract(fetchPromise) {
    return new Promise((resolve, reject) => {
      fetchPromise
        .then(r => r.text())
        .then(xmlText => {
          const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

          const LINE_SELECTOR = 'tt > body > div > p';
          const lines = [].map.call(
            xml.querySelectorAll(LINE_SELECTOR),
            (line, id) => {
              let text = '';
              let extractTextRecur = parentNode => {
                [].forEach.call(parentNode.childNodes, node => {
                  if (node.nodeType === Node.ELEMENT_NODE)
                    if (node.nodeName.toLowerCase() === 'br') text += ' ';
                    else extractTextRecur(node);
                  else if (node.nodeType === Node.TEXT_NODE)
                    text += node.nodeValue + ' ';
                });
              };
              extractTextRecur(line);

              // convert microseconds to seconds
              const begin = parseInt(line.getAttribute('begin')) / 10000000;
              const end = parseInt(line.getAttribute('end')) / 10000000;
              return { id, begin, end, text };
            }
          );

          this.lines = lines;
          resolve();
        });
    });
  }

  _render(lines, options) {
    // `em` as font size was not so good -- some other extensions change the em (?)
    // these magic numbers looks good on my screen XD
    const fontSize = Math.sqrt(this.extentWidth / 1600) * 28;

    const textContent = lines.map(line => line.text).join('\n');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttributeNS(null, 'text-anchor', 'middle');
    text.setAttributeNS(null, 'alignment-baseline', 'hanging');
    text.setAttributeNS(null, 'dominant-baseline', 'hanging'); // firefox
    text.setAttributeNS(null, 'paint-order', 'stroke');
    text.setAttributeNS(null, 'stroke', 'black');
    text.setAttributeNS(
      null,
      'stroke-width',
      `${1.0 * options.secondaryTextStroke}px`
    );
    text.setAttributeNS(null, 'x', this.extentWidth * 0.5);
    text.setAttributeNS(
      null,
      'y',
      this.extentHeight * (options.lowerBaselinePos + 0.01)
    );
    text.setAttributeNS(null, 'opacity', options.secondaryTextOpacity);
    text.style.fontSize = `${fontSize * options.secondaryTextScale}px`;
    text.style.fontFamily = 'Arial, Helvetica';
    text.style.fill = 'white';
    text.style.stroke = 'black';
    text.textContent = textContent;
    return [text];
  }
}

class ImageSubtitle extends SubtitleBase {
  constructor(...args) {
    super(...args);
    this.zip = undefined;
  }

  _extract(fetchPromise) {
    return new Promise((resolve, reject) => {
      const unzipP = fetchPromise.then(r => r.blob()).then(zipBlob => new JSZip().loadAsync(zipBlob));
      unzipP.then(zip => {
        zip
          .file('manifest_ttml2.xml')
          .async('string')
          .then(xmlText => {
            const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

            // dealing with `ns2:extent`, `ns3:extent`, ...
            const _getAttributeAnyNS = (domNode, attrName) => {
              const name = domNode.getAttributeNames().find(
                n =>
                  n
                    .split(':')
                    .pop()
                    .toLowerCase() === attrName
              );
              return domNode.getAttribute(name);
            };

            const extent = _getAttributeAnyNS(
              xml.querySelector('tt'),
              'extent'
            );
            [this.extentWidth, this.extentHeight] = extent
              .split(' ')
              .map(n => parseInt(n));

            const _ttmlTimeToSeconds = timestamp => {
              // e.g., _ttmlTimeToSeconds('00:00:06.005') -> 6.005
              const regex = /(\d+):(\d+):(\d+(?:\.\d+)?)/;
              const [hh, mm, sssss] = regex
                .exec(timestamp)
                .slice(1)
                .map(parseFloat);
              return hh * 3600 + mm * 60 + sssss;
            };

            const LINE_SELECTOR = 'tt > body > div';
            const lines = [].map.call(
              xml.querySelectorAll(LINE_SELECTOR),
              (line, id) => {
                const extentAttrName = line.getAttributeNames().find(
                  n =>
                    n
                      .split(':')
                      .pop()
                      .toLowerCase() === 'extent'
                );

                const [width, height] = _getAttributeAnyNS(line, 'extent')
                  .split(' ')
                  .map(n => parseInt(n));
                const [left, top] = _getAttributeAnyNS(line, 'origin')
                  .split(' ')
                  .map(n => parseInt(n));
                const imageName = line
                  .querySelector('image')
                  .getAttribute('src');
                const begin = _ttmlTimeToSeconds(line.getAttribute('begin'));
                const end = _ttmlTimeToSeconds(line.getAttribute('end'));
                return { id, width, height, top, left, imageName, begin, end };
              }
            );

            this.lines = lines;
            this.zip = zip;
            resolve();
          });
      });
    });
  }

  _render(lines, options) {
    const scale = options.secondaryImageScale;
    const centerLine = this.extentHeight * 0.5;
    const upperBaseline = this.extentHeight * options.upperBaselinePos;
    const lowerBaseline = this.extentHeight * options.lowerBaselinePos;
    return lines.map(line => {
      const img = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
      );
      this.zip
        .file(line.imageName)
        .async('blob')
        .then(blob => {
          const { left, top, width, height } = line;
          const [newWidth, newHeight] = [width * scale, height * scale];
          const newLeft = left + 0.5 * (width - newWidth);
          const newTop = top <= centerLine ? upperBaseline : lowerBaseline;

          const src = URL.createObjectURL(blob);
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
          img.setAttributeNS(null, 'width', newWidth);
          img.setAttributeNS(null, 'height', newHeight);
          img.setAttributeNS(null, 'x', newLeft);
          img.setAttributeNS(null, 'y', newTop);
          img.setAttributeNS(null, 'opacity', options.secondaryImageOpacity);
          img.addEventListener('load', () => {
            URL.revokeObjectURL(src);
          });
        });
      return img;
    });
  }
}

// -----------------------------------------------------------------------------

class SubtitleFactory {
  // track: manifest.textTracks[...]
  static build(track) {
    const isImageBased = Object.values(track.ttDownloadables).some(d => d.isImage);
    const isCaption = track.rawTrackType === 'closedcaptions';
    const lang = track.languageDescription + (isCaption ? ' [CC]' : '');
    const bcp47 = track.language;

    if (isImageBased) {
      return this._buildImageBased(track, lang, bcp47);
    }
    return this._buildTextBased(track, lang, bcp47);
  }

  static isNoneTrack(track) {
    // Sometimes Netflix places "fake" text tracks into manifests.
    // Such tracks have "isNoneTrack: false" and even have downloadable URLs,
    // while their display name is "Off" (localized in UI language, e.g., "關閉").
    // Here we use a huristic rule concluded by observation to filter those "fake" tracks out.
    if (track.isNoneTrack) {
      return true;
    }

    // "new_track_id" example "T:1:0;1;zh-Hant;1;1;"
    // the last bit is 1 for NoneTrack text tracks
    try {
      const isNoneTrackBit = track.new_track_id.split(';')[4];
      if (isNoneTrackBit === '1') {
        return true;
      }
    }
    catch (err) {
    }

    // "rank" === -1
    if (track.rank !== undefined && track.rank < 0) {
      return true;
    }
    return false;
  }

  static _buildImageBased(track, lang, bcp47) {
    const maxHeight = Math.max(...Object.values(track.ttDownloadables).map(d => d.height));
    const d = Object.values(track.ttDownloadables).find(d => d.height === maxHeight);
    const urls = Object.values(d.downloadUrls);
    return new ImageSubtitle(lang, bcp47, urls);
  }

  static _buildTextBased(track, lang, bcp47) {
    const targetProfile = 'dfxp-ls-sdh';
    const d = track.ttDownloadables[targetProfile];
    if (!d) {
      console.error(`Cannot find "${targetProfile}" for ${lang}`);
      return null;
    }
    const urls = Object.values(d.downloadUrls);
    return new TextSubtitle(lang, bcp47, urls);
  }
}

// textTracks: manifest.textTracks
const buildSubtitleList = textTracks => {
  const dummy = new DummySubtitle();
  dummy.activate();

  // sorted by language in alphabetical order (to align with official UI)
  const subs = textTracks
    .filter(t => !SubtitleFactory.isNoneTrack(t))
    .map(t => SubtitleFactory.build(t));
  return subs.concat(dummy);
};

////////////////////////////////////////////////////////////////////////////////

const SUBTITLE_LIST_CLASSNAME = 'nflxmultisubs-subtitle-list';
class SubtitleMenu {
  constructor() {
    this.elem = document.createElement('div');
    this.elem.classList.add(SUBTITLE_LIST_CLASSNAME);
  }

  render(nativeSubtitleMenuContainerElem) {
    const checkIcon = `<svg viewBox="0 0 24 24" class="ltr-17kyzwm">
      <path fill="currentColor" d="M3.707 12.293l-1.414 1.414L8 19.414 21.707 5.707l-1.414-1.414L8 16.586z">
      </path></svg>`;

    const loadingIcon = `<svg class="svg-icon svg-icon-nfplayerCheck" focusable="false" viewBox="0 -5 50 55">
          <path d="M 6 25 C6 21, 0 21, 0 25 C0 57, 49 59, 50 25 C50 50, 8 55, 6 25" stroke="transparent" fill="red">
            <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>
          </path>
      </svg></span>`;

    this.elem.innerHTML = `<h3>Secondary Subtitles</h3>`;

    const listElem = document.createElement('ul');
    gSubtitles.forEach((sub, id) => {
      let item = document.createElement('li');
      if (sub.active) {
        const icon = sub.state === 'LOADING' ? loadingIcon : checkIcon;
        item.innerHTML = `<div>${icon}<div>${sub.lang}</div></div>`;
      } else {
        item.innerHTML = `<div><div>${sub.lang}</div></div>`;
        item.addEventListener('click', () => {
          activateSubtitle(id);
        });
      }
      listElem.appendChild(item);
    });
    this.elem.appendChild(listElem);

    // Dirty hack to mimic Netflix native subtitle menu.
    // This routine may be called from the MutationObserver, at that moment
    // the native subtitle menu may not be ready in DOM tree yet
    const subtitleMenuElem = document.querySelector('div[data-uia="selector-audio-subtitle"]') || nativeSubtitleMenuContainerElem;
    if (subtitleMenuElem) {
      subtitleMenuElem.firstElementChild.classList.forEach(x => this.elem.classList.add(x));
      ['div>h3', 'div>ul', 'div>ul>li', 'div>ul>li>div>svg', 'div>ul>li>div>div'].forEach(selector =>
        subtitleMenuElem.querySelector(selector).classList.forEach(x =>
          [].forEach.call(this.elem.querySelectorAll(selector), elem => elem.classList.add(x))));
    }
  }
}

// -----------------------------------------------------------------------------

// FIXME: can we disconnect this observer once our menu is injected ?
// we still don't know whether Netflix would re-build the pop-up menu after
// switching to next episodes
const bodyObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      // FIXME: performance hazard
      const subtitleMenuElem = node.querySelector('div[data-uia="selector-audio-subtitle"]');
      if (subtitleMenuElem) {
        // popup menu attached
        if (!subtitleMenuElem.getElementsByClassName(SUBTITLE_LIST_CLASSNAME).length) {
          if (!gSubtitleMenu) {
            gSubtitleMenu = new SubtitleMenu();
            gSubtitleMenu.render(subtitleMenuElem);
          }
          subtitleMenuElem.appendChild(gSubtitleMenu.elem);
          subtitleMenuElem.parentNode.parentNode.parentNode.style.left = '';
          subtitleMenuElem.parentNode.parentNode.parentNode.style.right = '10px';
          // debugger;
        }
        gSubtitleMenu.render(subtitleMenuElem);
      }
    });
  });
});
const observerOptions = {
  attributes: true,
  subtree: true,
  childList: true,
  characterData: true
};
bodyObserver.observe(document.body, observerOptions);

////////////////////////////////////////////////////////////////////////////////

activateSubtitle = id => {
  const sub = gSubtitles[id];
  if (sub) {
    gSubtitles.forEach(sub => sub.deactivate());
    sub.activate().then(() => gSubtitleMenu && gSubtitleMenu.render());
  }
  gSubtitleMenu && gSubtitleMenu.render();
};

const buildSecondarySubtitleElement = options => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('nflxmultisubs-subtitle-svg');
  svg.style =
    'position:absolute; width:100%; top:0; bottom:0; left:0; right:0;';
  svg.setAttributeNS(null, 'width', '100%');
  svg.setAttributeNS(null, 'height', '100%');

  const padding = document.createElement('div');
  padding.classList.add('nflxmultisubs-subtitle-padding');
  padding.style = `display:block; content:' '; width:100%; padding-top:${gVideoRatio *
    100}%;`;

  const container = document.createElement('div');
  container.classList.add('nflxmultisubs-subtitle-container');
  container.style = 'position:relative; width:100%; max-height:100%;';
  container.appendChild(svg);
  container.appendChild(padding);

  const wrapper = document.createElement('div');
  wrapper.classList.add('nflxmultisubs-subtitle-wrapper');
  wrapper.style = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; display:flex; align-items:center; pointer-events: none;';
  wrapper.appendChild(container);
  return wrapper;
};

// -----------------------------------------------------------------------------

class PrimaryImageTransformer {
  constructor() {}

  transform(svgElem, controlsActive, forced) {
    const selector = forced ? 'image' : 'image:not(.nflxmultisubs-scaled)';
    const images = svgElem.querySelectorAll(selector);
    if (images.length > 0) {
      const viewBox = svgElem.getAttributeNS(null, 'viewBox');
      const [extentWidth, extentHeight] = viewBox
        .split(' ')
        .slice(-2)
        .map(n => parseInt(n));

      // TODO: if there's no secondary subtitle, center the primary on baseline
      const options = gRenderOptions;
      const centerLine = extentHeight * 0.5;
      const upperBaseline = extentHeight * options.upperBaselinePos;
      const lowerBaseline = extentHeight * options.lowerBaselinePos;
      const scale = options.primaryImageScale;
      const opacity = options.primaryImageOpacity;

      [].forEach.call(images, img => {
        img.classList.add('nflxmultisubs-scaled');
        const left = parseInt(
          img.getAttributeNS(null, 'data-orig-x') ||
            img.getAttributeNS(null, 'x')
        );
        const top = parseInt(
          img.getAttributeNS(null, 'data-orig-y') ||
            img.getAttributeNS(null, 'y')
        );
        const width = parseInt(
          img.getAttributeNS(null, 'data-orig-width') ||
            img.getAttributeNS(null, 'width')
        );
        const height = parseInt(
          img.getAttributeNS(null, 'data-orig-height') ||
            img.getAttributeNS(null, 'height')
        );

        const attribs = [
          ['x', left],
          ['y', top],
          ['width', width],
          ['height', height]
        ];
        attribs.forEach(p => {
          const attrName = `data-orig-${p[0]}`,
            attrValue = p[1];
          if (!img.getAttributeNS(null, attrName)) {
            img.setAttributeNS(null, attrName, attrValue);
          }
        });

        const [newWidth, newHeight] = [width * scale, height * scale];
        const newLeft = left + 0.5 * (width - newWidth);
        const newTop =
          top <= centerLine
            ? upperBaseline - newHeight
            : lowerBaseline - newHeight;
        img.setAttributeNS(null, 'width', newWidth);
        img.setAttributeNS(null, 'height', newHeight);
        img.setAttributeNS(null, 'x', newLeft);
        img.setAttributeNS(null, 'y', newTop);
        img.setAttributeNS(null, 'opacity', opacity);
      });
    }
  }
}

class PrimaryTextTransformer {
  constructor() {
    this.lastScaledPrimaryTextContent = undefined;
  }

  transform(divElem, controlsActive, forced) {
    let parentNode = divElem.parentNode;
    if (!parentNode.classList.contains('nflxmultisubs-primary-wrapper')) {
      // let's use `<style>` + `!imporant` to outrun the offical player...
      const wrapper = document.createElement('div');
      wrapper.classList.add('nflxmultisubs-primary-wrapper');
      wrapper.style =
        'position:absolute; width:100%; height:100%; top:0; left:0;';

      const styleElem = document.createElement('style');
      wrapper.appendChild(styleElem);

      // wrap the offical text-based subtitle container, hehe!
      parentNode.insertBefore(wrapper, divElem);
      wrapper.appendChild(divElem);
      parentNode = wrapper;
    }

    const container = divElem.querySelector('.player-timedtext-text-container');
    if (!container) return;

    const textContent = container.textContent;
    if (this.lastScaledPrimaryTextContent === textContent && !forced) return;
    this.lastScaledPrimaryTextContent = textContent;

    const style = parentNode.querySelector('style');
    if (!style) return;

    const textSpan = container.querySelector('span');
    if (!textSpan) return;

    const fontSize = parseInt(textSpan.style.fontSize);
    if (!fontSize) return;

    const options = gRenderOptions;
    const opacity = options.primaryTextOpacity;
    const scale = options.primaryTextScale;
    const newFontSize = fontSize * scale;
    const styleText = `.player-timedtext-text-container span {
        font-size: ${newFontSize}px !important;
        opacity: ${opacity};
      }`;
    style.textContent = styleText;

    const rect = divElem.getBoundingClientRect();
    const [extentWidth, extentHeight] = [rect.width, rect.height];

    const lowerBaseline = extentHeight * options.lowerBaselinePos;
    const { left, top, width, height } = container.getBoundingClientRect();
    const newLeft = extentWidth * 0.5 - width * 0.5;
    let newTop = lowerBaseline - height;

    // FIXME: dirty transform & magic offets
    // we out run the official player, so the primary text-based subtitles
    // does not move automatically when the navs are active
    newTop += controlsActive ? -120 : 0;

    style.textContent =
      styleText +
      '\n' +
      `
      .player-timedtext-text-container {
        top: ${newTop}px !important;
        left: ${newLeft}px !important;
      }`;
  }
}

class RendererLoop {
  constructor(video) {
    this.isRunning = false;
    this.isRenderDirty = undefined; // windows resize or config change, force re-render
    this.videoElem = video;
    this.subtitleWrapperElem = undefined; // secondary subtitles wrapper (outer)
    this.subSvg = undefined; // secondary subtitles container
    this.primaryImageTransformer = new PrimaryImageTransformer();
    this.primaryTextTransformer = new PrimaryTextTransformer();
  }

  setRenderDirty() {
    this.isRenderDirty = true;
  }

  start() {
    this.isRunning = true;
    window.requestAnimationFrame(this.loop.bind(this));
    this._connect();
  }

  stop() {
    this.isRunning = false;
    this._clearSecondarySubtitles();
    this._disconnect();
  }

  loop() {
    try {
      this._loop();
      this.isRunning && window.requestAnimationFrame(this.loop.bind(this));
    }
    catch (err) {
      console.error('Fatal: ', err);
    }
  }

  _loop() {
    const currentVideoElem = document.querySelector('#appMountPoint video');
    if (currentVideoElem && this.videoElem.src !== currentVideoElem.src) {
      // some video change episodes by update video src
      // force terminate renderer loop if src changed
      window.__NflxMultiSubs.rendererLoopDestroy();
      return;
    }

    // this script may be loaded while user's at the movie list page,
    // thus if there's no video playing, we can end the renderer loop
    if (!this.videoElem && !/netflix\.com\/watch/i.test(window.location.href)) {
      this.stop();
      return;
    }

    const controlsActive = this._getControlsActive();
    // NOTE: don't do this, the render rate is too high to shown the
    // image in SVG for secondary subtitles.... O_Q
    // if (controlsActive) {
    //   this.setRenderDirty(); // to move up subttles
    // }
    if (!this._appendSubtitleWrapper()) {
      return;
    }

    this._adjustPrimarySubtitles(controlsActive, !!this.isRenderDirty);
    this._renderSecondarySubtitles();

    // render secondary subtitles
    // ---------------------------------------------------------------------
    // FIXME: dirty transform & magic offets
    // this leads to a big gap between primary & secondary subtitles
    // when the progress bar is shown
    this.subtitleWrapperElem.style.top = controlsActive ? '-100px' : '0';

    // everything rendered, clear the dirty bit with ease
    this.isRenderDirty = false;
  }

  _connect() {
    // connect with background script
    // FIXME: should disconnect this port while there's no video playing, to gray out our icon;
    // However, we can't disconnect when <video> not found in the renderer loop,
    // because there's a small time gap between updateManifest() and <video> is initialize.
    if (BROWSER === 'chrome') {
      if (gMsgPort) return;
      try {
        const extensionId = window.__nflxMultiSubsExtId;
        gMsgPort = chrome.runtime.connect(extensionId);
        console.log(`Linked: ${extensionId}`);

        gMsgPort.onMessage.addListener(msg => {
          if (!msg.settings) return;
          gRenderOptions = Object.assign({}, msg.settings);
          gRendererLoop && gRendererLoop.setRenderDirty();
        });
      } catch (err) {
        console.warn('Error: cannot talk to background,', err);
      }
      return;
    }

    // Firefox
    try {
      window.postMessage({
        namespace: 'nflxmultisubs',
        action: 'connect'
      }, '*');
    } catch (err) {
      console.warn('Error: cannot talk to background,', err);
    }
  }

  _disconnect() {
    // disconnect with background to make our icon grayscale again
    // FIXME: renderer loop shouldn't be responsible for this
    if (BROWSER === 'chrome') {
      if (gMsgPort && gMsgPort.disconnect()) gMsgPort = null;
    } else if (BROWSER === 'firefox') {
      window.postMessage(
        {
          namespace: 'nflxmultisubs',
          action: 'disconnect'
        },
        '*'
      );
    }
  }

  _getControlsActive() {
    // FIXME: better solution to handle different versions of Netflix web player UI
    // "Neo Style" refers to the newer version as in 2018/07
    let controlsElem = document.querySelector('.controls'),
      neoStyle = false;
    if (!controlsElem) {
      controlsElem = document.querySelector('.PlayerControlsNeo__layout');
      if (!controlsElem) {
        return false;
      }
      neoStyle = true;
    }
    // elevate the navs' z-index (to be on top of our subtitles)
    if (!controlsElem.style.zIndex) {
      controlsElem.style.zIndex = 3;
    }

    if (neoStyle) {
      return !controlsElem.classList.contains(
        'PlayerControlsNeo__layout--inactive'
      );
    }
    return controlsElem.classList.contains('active');
  }

  // @returns {boolean} Successed?
  _appendSubtitleWrapper() {
    if (!this.subtitleWrapperElem || !this.subtitleWrapperElem.parentNode) {
      const playerContainerElem = document.querySelector('div[data-uia="video-canvas"]');
      if (!playerContainerElem) return false;
      this.subtitleWrapperElem = buildSecondarySubtitleElement(gRenderOptions);
      playerContainerElem.appendChild(this.subtitleWrapperElem);
    }
    return true;
  }

  // transform & scale primary subtitles
  _adjustPrimarySubtitles(active, dirty) {
    // NOTE: we cannot put `primaryImageSubSvg` into instance state,
    // because there are multiple instance of the SVG and they're switched
    // when the langauge of primary subtitles is switched.
    const primaryImageSubSvg = document.querySelector('.image-based-subtitles svg');
    if (primaryImageSubSvg) {
      this.primaryImageTransformer.transform(primaryImageSubSvg, active, dirty);
    }

    const primaryTextSubDiv = document.querySelector('.player-timedtext');
    if (primaryTextSubDiv) {
      this.primaryTextTransformer.transform(primaryTextSubDiv, active, dirty);
    }
  }

  _clearSecondarySubtitles() {
    if (!this.subSvg || !this.subSvg.parentNode) return;
    [].forEach.call(this.subSvg.querySelectorAll('*'), elem =>
      elem.parentNode.removeChild(elem));
  }

  _renderSecondarySubtitles() {
    if (!this.subSvg || !this.subSvg.parentNode) {
      this.subSvg = this.subtitleWrapperElem.querySelector('svg');
    }
    const seconds = this.videoElem.currentTime;
    const sub = gSubtitles.find(sub => sub.active);
    if (!sub) {
      return;
    }

    if (sub instanceof TextSubtitle) {
      const rect = this.videoElem.getBoundingClientRect();
      sub.setExtent(rect.width, rect.height);
    }

    const renderedElems = sub.render(
      seconds,
      gRenderOptions,
      !!this.isRenderDirty
    );
    if (renderedElems) {
      const [extentWidth, extentHeight] = sub.getExtent();
      if (extentWidth && extentHeight) {
        this.subSvg.setAttribute(
          'viewBox',
          `0 0 ${extentWidth} ${extentHeight}`
        );
      }
      this._clearSecondarySubtitles();
      renderedElems.forEach(elem => this.subSvg.appendChild(elem));
    }
  }
}

window.addEventListener('resize', evt => {
  gRendererLoop && gRendererLoop.setRenderDirty();
  console.log(
    'Resize:',
    `${window.innerWidth}x${window.innerHeight} (${evt.timeStamp})`
  );
});


// -----------------------------------------------------------------------------

class ManifestManagerBase {
  enumManifest() {}
  getManifest(movieId) {}
  saveManifest(manifest) {}
}


class ManifestManagerInMemory extends ManifestManagerBase {
  constructor(...args) {
    super(...args);
    this.manifests = {};
  }

  enumManifest() {
    return this.manifests;
  }

  getManifest(movieId) {
    return this.manifests[movieId];
  }

  saveManifest(manifest) {
    this.manifests[manifest.movieId] = manifest;
  }
}

class ManifestManagerLocalStorage extends ManifestManagerBase {
  enumManifests() {
    return Object.entries(window.localStorage).filter((key, val) => {
      return key.indexOf('manifest=') == 0;
    });
  }

  getManifest(movieId) {
    const key = `manifest=${movieId}`;
    const item = window.localStorage.getItem(key);
    if (!item) {
      console.log(`Manifet ${movieId} not found in localStorage`);
      return null;
    }

    // console.log(`Manifest ${movieId} found in localStorage`);
    const manifest = JSON.parse(item).manifest;
    return manifest;
  }

  saveManifest(manifest) {
    const key = `manifest=${manifest.movieId}`;
    window.localStorage.setItem(key, JSON.stringify({
      manifest: manifest,
      timestamp: new Date(),
    }));
  }
}



const extractMovieIdFromUrl = () => {
  const isInPlayerPage = /netflix\.com\/watch/i.test(window.location.href);
  if (!isInPlayerPage) {
    // console.log('Not in player page');
    return null;
  }

  try {
    const movieIdInUrl = /^\/watch\/(\d+)/.exec(window.location.pathname)[1];
    const movieId = parseInt(movieIdInUrl);
    console.log(`Movie in URL: ${movieId}`)
    return movieId;
  }
  catch (err) {
    console.error(err);
  }
  return null;
};

class NflxMultiSubsManager {
  constructor() {
    this.version = VERSION;
    this.lastMovieId = undefined;
    this.playerUrl = undefined;
    this.playerVersion = undefined;
    this.busyWaitTimeout = 100000; // ms
    this.manifestManager = new ManifestManagerInMemory();
    console.log(`Version: ${this.version}`)
  }

  busyWaitVideoElement() {
    // Never reject
    return new Promise((resolve, _) => {
      let timer = 0;
      const intervalId = setInterval(() => {
        const video = document.querySelector('#appMountPoint video');
        if (video) {
          clearInterval(intervalId);
          resolve(video);
        }
        if (timer * 200 === this.busyWaitTimeout) {
          // Notify user can F5 or just keep wait...
          clearInterval(intervalId);
        }
        timer += 1;
      }, 200);
    });
  }

  activateManifest(movieId) {
    const manifest = this.manifestManager.getManifest(movieId);
    if (!manifest) {
      console.error(`Cannot find manifest: ${movieId}`);
      return;
    }

    const movieIdInUrl = extractMovieIdFromUrl();
    if (!movieIdInUrl) return;

    if (movieIdInUrl != manifest.movieId) {
      console.log(`Different manifest, movieIdInUrl=${movieIdInUrl}, manifest.movieId=${manifest.movieId}`);
      return;
    }

    // Sometime the movieId in URL may be different to the actually playing manifest
    // Thus we also need to check the player DOM tree...
    this.busyWaitVideoElement()
      .then(video => {
        try {
          const movieIdInUrl = extractMovieIdFromUrl();
          let playingManifest = (manifest.movieId === movieIdInUrl);

          if (!playingManifest) {
            // magic! ... div.VideoContainer > div#12345678 > video[src=blob:...]
            const movieIdInPlayerNode = video.parentNode.id;
            console.log(`Note: movieIdInPlayerNode=${movieIdInPlayerNode}`);
            playingManifest = movieIdInPlayerNode.includes(manifest.movieId.toString());
          }

          if (!playingManifest) {
            console.log(`Ignored: manifest ${manifest.movieId} not playing`);
            // Ignore but store it.
            // this.manifestList.push(manifest);
            return;
          }

          const movieChanged = manifest.movieId !== this.lastMovieId;
          if (!movieChanged) {
            console.log(`Ignored: manifest ${manifest.movieId} loaded yet`);
            return;
          }

          console.log(`Activating manifest ${manifest.movieId} (last=${this.lastMovieId})`);
          this.lastMovieId = manifest.movieId;

          // For cadmium-playercore-6.0012.183.041.js and later
          gSubtitles = buildSubtitleList(manifest.timedtexttracks);
          gSubtitleMenu = new SubtitleMenu();
          gSubtitleMenu.render();

          // select subtitle to match the default audio track
          try {
            let defaultAudioId, defaultAudioTrack;
            if (manifest.defaultTrackOrderList !== undefined) {
              defaultAudioId = manifest.defaultTrackOrderList[0].audioTrackId;
              defaultAudioTrack = manifest.audio_tracks.find(t => t.id == defaultAudioId);
            }
            else if (manifest.recommendedMedia !== undefined) {
              defaultAudioId = manifest.recommendedMedia.audioTrackId;
              defaultAudioTrack = manifest.audio_tracks.find(t => t.new_track_id == defaultAudioId);
            }
            console.log(`Default audio track language: ${defaultAudioLanguage}`);
            const autoSubtitleId = gSubtitles.findIndex(t => t.bcp47 == defaultAudioLanguage);
            if (autoSubtitleId >= 0) {
              console.log(`Subtitle #${autoSubtitleId} auto-enabled to match audio`);
              activateSubtitle(autoSubtitleId);
            }
          }
          catch (err) {
            console.error('Default audio track not found, ', err);
          }

          // retrieve video ratio
          try {
            let { maxWidth, maxHeight } = manifest.video_tracks[0];
            gVideoRatio = maxHeight / maxWidth;
          }
          catch (err) {
            console.error('Video ratio not available, ', err);
          }
        }
        catch (err) {
          console.error('Fatal: ', err);
        }

        if (gRendererLoop) {
          gRendererLoop.stop();
          gRendererLoop = null;
          console.log('Terminated: old renderer loop');
        }

        if (!gRendererLoop) {
          gRendererLoop = new RendererLoop(video);
          gRendererLoop.start();
          console.log('Started: renderer loop');
        }

        // detect for newer version of Netflix web player UI
        const hasNeoStyleControls = !!document.querySelector('[class*=PlayerControlsNeo]');
        console.log(`hasNeoStyleControls: ${hasNeoStyleControls}`);
      })
      .catch(err => {
        console.error('Fatal: ', err);
      });
  }

  updateManifest(manifest) {
    try {
      console.log(`Manifest: ${manifest.movieId}`);
    }
    catch (err) {
      console.warn('Error:', err);
    }

    this.manifestManager.saveManifest(manifest);
    this.activateManifest(manifest.movieId);
  }

  rendererLoopDestroy() {
    const movieIdInUrl = extractMovieIdFromUrl();
    if (!movieIdInUrl) return;

    console.log(`rendererLoop destroyed, trying to activate: ${movieIdInUrl}`);
    this.activateManifest(movieIdInUrl);
  }
}

const nflxMultiSubsManager = new NflxMultiSubsManager();
window.__NflxMultiSubs = nflxMultiSubsManager;  // interface between us and the the manifest hook

// =============================================================================

// Firefox: this injected agent cannot talk to extension directly, thus the
// connection (for applying settings) is relayed by our content script through
// window.postMessage().

if (BROWSER === 'firefox') {
  window.addEventListener(
    'message',
    evt => {
      if (!evt.data || evt.data.namespace !== 'nflxmultisubs') return;

      if (evt.data.action === 'apply-settings' && evt.data.settings) {
        gRenderOptions = Object.assign({}, evt.data.settings);
        gRendererLoop && gRendererLoop.setRenderDirty();
      }
    },
    false
  );
}

// =============================================================================

// control video playback rate
const playbackRateController = new PlaybackRateController();
playbackRateController.activate();
