(() => {

// wraper console.xxx() to add prefix
const prefix = 'NflxMultiSubs>';
const console = {
  log: (...args) => window.console.log(prefix, ...args),
  warn: (...args) => window.console.warn(prefix, ...args),
  error: (...args) => window.console.error(prefix, ...args),
};

////////////////////////////////////////////////////////////////////////////////


// global states
let gSubtitles = [], gSubtitleMenu;
let gMsgPort, gRendererLoop;
let gVideoRatio = (1080 / 1920);

// FIXME: dedup default settings with background script
const kDefaultSettings = {
  centerLinePos: 0.5,
  topBaselinePos: 0.15,
  btmBaselinePos: 0.85,
  primaryImageScale: 0.75,
  primaryImageOpacity: 0.85,
  primaryTextScale: 0.95,
  primaryTextOpacity: 0.85,
  secondaryImageScale: 0.5,
  secondaryImageOpacity: 0.85,
  secondaryTextScale: 1.0,
  secondaryTextStroke: 2.0,
  secondaryTextOpacity: 0.85,
};
let gRenderOptions = Object.assign({}, kDefaultSettings);


////////////////////////////////////////////////////////////////////////////////


class SubtitleBase {
  constructor(lang, bcp47, url) {
    this.state = 'GENESIS';
    this.active = false;
    this.lang = lang;
    this.bcp47 = bcp47;
    this.url = url;
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

  deactivate(){
    this.active = false;
  }

  render(seconds, options, forced) {
    if (!this.active || this.state !== 'READY' || !this.lines) return [];
    const lines = this.lines.filter(line => (line.begin <= seconds && seconds <= line.end));
    const ids = lines.map(line => line.id).sort().toString();

    if (this.lastRenderedIds === ids && !forced) return null;
    this.lastRenderedIds = ids;
    return this._render(lines, options);
  }

  getExtent() {
    return [ this.extentWidth, this.extentHeight ];
  }

  setExtent(width, height) {
    [ this.extentWidth, this.extentHeight ] = [ width, height ];
  }

  _render(lines, options) {
    // implemented in derived class
  }

  _download() {
    // implemented in derived class
    return Promise.resolve();
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

  _download() {
    return (new Promise((resolve, reject) => {
      fetch(this.url).then(r => r.text()).then(xmlText => {
        const xml = (new DOMParser()).parseFromString(xmlText, 'text/xml');

        const LINE_SELECTOR = 'tt > body > div > p';
        const lines = [].map.call(xml.querySelectorAll(LINE_SELECTOR), (line, id) => {
          let text = '';
          let extractTextRecur = (parentNode) => {
            [].forEach.call(parentNode.childNodes, node => {
              if (node.nodeType === Node.ELEMENT_NODE)
                if (node.nodeName.toLowerCase() === 'br') text += ' ';
                else extractTextRecur(node);
              else if (node.nodeType === Node.TEXT_NODE)
                text += node.nodeValue;
            });
          };
          extractTextRecur(line);

          // convert microseconds to seconds
          const begin = parseInt(line.getAttribute('begin')) / 10000000;
          const end = parseInt(line.getAttribute('end')) / 10000000;
          return { id, begin, end, text };
        });

        this.lines = lines;
        resolve();
      });
    }));
  }

  _render(lines, options) {
    // `em` as font size was not so good -- some other extensions change the em (?)
    // these magic numbers looks good on my screen XD
    const fontSize = Math.sqrt(this.extentWidth / 1600) * 28;

    const textContent = lines.map(line => line.text).join('\n');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttributeNS(null, 'text-anchor', 'middle');
    text.setAttributeNS(null, 'alignment-baseline', 'hanging');
    text.setAttributeNS(null, 'paint-order', 'stroke');
    text.setAttributeNS(null, 'stroke', 'black');
    text.setAttributeNS(null, 'stroke-width', `${1.0 * options.secondaryTextStroke}px`);
    text.setAttributeNS(null, 'x', this.extentWidth * 0.5);
    text.setAttributeNS(null, 'y', this.extentHeight * (options.btmBaselinePos + 0.01));
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

  _download() {
    return (new Promise((resolve, reject) => {
      const fetchP = fetch(this.url).then(r => r.blob());
      const unzipP = fetchP.then(zipBlob => (new JSZip()).loadAsync(zipBlob));
      unzipP.then(zip => {
        zip.file('manifest_ttml2.xml').async('string').then(xmlText => {
          const xml = (new DOMParser()).parseFromString(xmlText, 'text/xml');

          // dealing with `ns2:extent`, `ns3:extent`, ...
          const _getAttributeAnyNS = (domNode, attrName) => {
            const name = domNode.getAttributeNames().find(n =>
              (n.split(':').pop().toLowerCase() === attrName));
            return domNode.getAttribute(name);
          };

          const extent = _getAttributeAnyNS(xml.querySelector('tt'), 'extent');
          [this.extentWidth, this.extentHeight] = extent.split(' ').map(n => parseInt(n));

          const _ttmlTimeToSeconds = (timestamp) => {
            // e.g., _ttmlTimeToSeconds('00:00:06.005') -> 6.005
            const regex = /(\d+):(\d+):(\d+(?:\.\d+)?)/;
            const [hh, mm, sssss] = regex.exec(timestamp).slice(1).map(parseFloat);
            return (hh * 3600 + mm * 60 + sssss);
          };

          const LINE_SELECTOR = 'tt > body > div';
          const lines = [].map.call(xml.querySelectorAll(LINE_SELECTOR), (line, id) => {
            const extentAttrName = line.getAttributeNames().find(n => n.split(':').pop().toLowerCase() === 'extent');

            const [width, height] = _getAttributeAnyNS(line, 'extent').split(' ').map(n => parseInt(n));
            const [left, top] = _getAttributeAnyNS(line, 'origin').split(' ').map(n => parseInt(n));
            const imageName = line.querySelector('image').getAttribute('src');
            const begin = _ttmlTimeToSeconds(line.getAttribute('begin'));
            const end = _ttmlTimeToSeconds(line.getAttribute('end'));
            return { id, width, height, top, left, imageName, begin, end };
          });

          this.lines = lines;
          this.zip = zip;
          resolve();
        });
      });
    }));
  }

  _render(lines, options) {
    const scale = options.secondaryImageScale;
    const centerLine = this.extentHeight * options.centerLinePos;
    const topBaseline = this.extentHeight * options.topBaselinePos;
    const btmBaseline = this.extentHeight * options.btmBaselinePos;
    return lines.map(line => {
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      this.zip.file(line.imageName).async('blob').then(blob => {
        const { left, top, width, height } = line;
        const [ newWidth, newHeight ] = [ width * scale, height * scale ];
        const newLeft = (left + 0.5 * (width - newWidth));
        const newTop = (top <= centerLine) ? (topBaseline) : (btmBaseline);

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
    const isImageBased = track.downloadables.some(d => d.isImage);
    const isCaption = (track.trackType === 'CLOSEDCAPTIONS');
    const lang = track.language + (isCaption ? ' [CC]' : '');
    const bcp47 = track.bcp47;

    if (isImageBased) {
      return this._buildImageBased(track, lang, bcp47);
    }
    return this._buildTextBased(track, lang, bcp47);
  }

  static _buildImageBased(track, lang, bcp47) {
    const maxHeight = Math.max(...track.downloadables.map(d => d.pixHeight));
    const d = track.downloadables.find(d => d.pixHeight === maxHeight);
    const url = d.urls[Object.keys(d.urls)[0]];
    return new ImageSubtitle(lang, bcp47, url);
  }

  static _buildTextBased(track, lang, bcp47) {
    const targetProfile = 'dfxp-ls-sdh';
    const d = track.downloadables.find(d => d.contentProfile === targetProfile);
    if (!d) {
      console.error(`Cannot find "${targetProfile}" for ${lang}`);
      return null;
    }

    const url = d.urls[Object.keys(d.urls)[0]];
    return new TextSubtitle(lang, bcp47, url);
  }
}


// textTracks: manifest.textTracks
const buildSubtitleList = (textTracks) => {
  const dummy = new DummySubtitle();
  dummy.activate();

  // sorted by language in alphabetical order (to align with official UI)
  const subs = textTracks.filter(t => !t.isNone)
    .map(t => SubtitleFactory.build(t)).sort((a, b) => a.lang.localeCompare(b.lang));
  return [dummy].concat(subs);
};


////////////////////////////////////////////////////////////////////////////////


const SUBTITLE_LIST_CLASSNAME = 'nflxmultisubs-subtitle-list';
class SubtitleMenu {
  constructor() {
    this.elem = document.createElement('ul');
    this.elem.classList.add('track-list', 'structural', 'track-list-subtitles');
    this.elem.classList.add(SUBTITLE_LIST_CLASSNAME);
  }

  render() {
    const checkIcon = `<span class="video-controls-check">
      <svg class="svg-icon svg-icon-nfplayerCheck" focusable="false">
      <use filter="" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#nfplayerCheck"></use>
      </svg></span>`;

    const loadingIcon = `<span class="video-controls-check">
      <svg class="svg-icon svg-icon-nfplayerCheck" focusable="false" viewBox="0 -5 50 55">
          <path d="M 6 25 C6 21, 0 21, 0 25 C0 57, 49 59, 50 25 C50 50, 8 55, 6 25" stroke="transparent" fill="red">
            <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>
          </path>
      </svg></span>`;

    this.elem.innerHTML = `<li class="list-header">Secondary Subtitles</li>`;
    gSubtitles.forEach((sub, id) => {
      let item = document.createElement('li');
      item.classList.add('track');
      if (sub.active) {
        const icon = (sub.state === 'LOADING') ? loadingIcon : checkIcon;
        item.classList.add('selected');
        item.innerHTML = `${icon}${sub.lang}`;
      }
      else {
        item.innerHTML = sub.lang;
        item.addEventListener('click', () => {
          activateSubtitle(id);
        });
      }
      this.elem.appendChild(item);
    });
  }
}


// -----------------------------------------------------------------------------


const isPopupMenuElement = (node) => {
  return (node.nodeName.toLowerCase() === 'div') &&
    (node.classList.contains('audio-subtitle-controller'));
};

// FIXME: can we disconnect this observer once our menu is injected ?
// we still don't know whether Netflix would re-build the pop-up menu after
// switching to next episodes
const bodyObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (isPopupMenuElement(node)) {
        // popup menu attached
        if (!node.getElementsByClassName(SUBTITLE_LIST_CLASSNAME).length) {
          if (!gSubtitleMenu) {
            gSubtitleMenu = new SubtitleMenu();
            gSubtitleMenu.render();
          }
          node.appendChild(gSubtitleMenu.elem);
        }
      }
    });
    mutation.removedNodes.forEach(node => {
      if (isPopupMenuElement(node)) {
        // popup menu detached
      }
    });
  });
});
const observerOptions = {attributes: true, subtree: true, childList: true, characterData: true, };
bodyObserver.observe(document.body, observerOptions);


////////////////////////////////////////////////////////////////////////////////


activateSubtitle = (id) => {
  gSubtitles.forEach(sub => sub.deactivate());
  const sub = gSubtitles[id];
  if (sub) {
    sub.activate().then(() => gSubtitleMenu && gSubtitleMenu.render());
  }
  gSubtitleMenu && gSubtitleMenu.render();
};

const buildSecondarySubtitleElement = (options) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('nflxmultisubs-subtitle-svg');
  svg.style = 'position:absolute; width:100%; top:0; bottom:0; left:0; right:0;';
  svg.setAttributeNS(null, 'width', '100%');
  svg.setAttributeNS(null, 'height', '100%');

  const padding = document.createElement('div');
  padding.classList.add('nflxmultisubs-subtitle-padding');
  padding.style = `display:block; content:' '; width:100%; padding-top:${gVideoRatio*100}%;`;

  const container = document.createElement('div');
  container.classList.add('nflxmultisubs-subtitle-container');
  container.style = 'position:relative; width:100%; max-height:100%;';
  container.appendChild(svg);
  container.appendChild(padding);

  const wrapper = document.createElement('div');
  wrapper.classList.add('nflxmultisubs-subtitle-wrapper');
  wrapper.style = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; display:flex; align-items:center;';
  wrapper.appendChild(container);
  return wrapper;
};


// -----------------------------------------------------------------------------


class PrimaryImageTransformer {
  constructor() {
  }

  transform(svgElem, controlsActive, forced) {
    const selector = forced ? 'image' : 'image:not(.nflxmultisubs-scaled)';
    const images = svgElem.querySelectorAll(selector);
    if (images.length > 0) {
      const viewBox = svgElem.getAttributeNS(null, 'viewBox');
      const [ extentWidth, extentHeight ] = viewBox.split(' ').slice(-2).map(n => parseInt(n));

      // TODO: if there's no secondary subtitle, center the primary on baseline
      const options = gRenderOptions;
      const centerLine = extentHeight * options.centerLinePos;
      const topBaseline = extentHeight * options.topBaselinePos;
      const btmBaseline = extentHeight * options.btmBaselinePos;
      const scale = options.primaryImageScale;
      const opacity = options.primaryImageOpacity;

      [].forEach.call(images, img => {
        img.classList.add('nflxmultisubs-scaled');
        const left = parseInt(img.getAttributeNS(null, 'data-orig-x') || img.getAttributeNS(null, 'x'));
        const top = parseInt(img.getAttributeNS(null, 'data-orig-y') || img.getAttributeNS(null, 'y'));
        const width = parseInt(img.getAttributeNS(null, 'data-orig-width') || img.getAttributeNS(null, 'width'));
        const height = parseInt(img.getAttributeNS(null, 'data-orig-height') || img.getAttributeNS(null, 'height'));

        const attribs = [['x', left], ['y', top], ['width', width], ['height', height]];
        attribs.forEach(p => {
          const attrName = `data-orig-${p[0]}`, attrValue = p[1];
          if (!img.getAttributeNS(null, attrName)) {
            img.setAttributeNS(null, attrName, attrValue);
          }
        });

        const [ newWidth, newHeight ] = [ width * scale, height * scale ];
        const newLeft = (left + 0.5 * (width - newWidth));
        const newTop = (top <= centerLine) ? (topBaseline - newHeight) : (btmBaseline - newHeight);
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
      wrapper.style = 'position:absolute; width:100%; height:100%; top:0; left:0;';

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
    const newFontSize = (fontSize * scale);
    const styleText = `.player-timedtext-text-container span {
        font-size: ${newFontSize}px !important;
        opacity: ${opacity};
      }`;
    style.textContent = styleText;

    const rect = divElem.getBoundingClientRect();
    const [ extentWidth, extentHeight ] = [ rect.width, rect.height ];

    const btmBaseline = extentHeight * options.btmBaselinePos;
    const { left, top, width, height } = container.getBoundingClientRect();
    const newLeft = ((extentWidth * 0.5) - (width * 0.5));
    let newTop = (btmBaseline - height);

    // FIXME: dirty transform & magic offets
    // we out run the official player, so the primary text-based subtitles
    // does not move automatically when the navs are active
    newTop += (controlsActive ? -120 : 0);

    style.textContent = styleText + '\n' + `
      .player-timedtext-text-container {
        top: ${newTop}px !important;
        left: ${newLeft}px !important;
      }`;
  }
}


// FIXME: refactor this class
class RendererLoop {
  constructor() {
    this.isRunning = false;
    this.isRenderDirty = undefined; // windows resize or config change, force re-render
    this.videoElem = undefined;
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
  }

  stop() {
    this.isRunning = false;
  }

  loop() {
    try {
      do {
        if (!this.videoElem || !this.videoElem.parentNode) {
          this.videoElem = document.querySelector('#appMountPoint video');
        }
        if (!this.videoElem) {
          // this script may be loaded while user's at the movie list page,
          // thus if there's no video playing, we can end the renderer loop
          if (!(/netflix\.com\/watch/i.test(window.location.href))) {
            // disconnect with background to make our icon grayscale again
            // FIXME: renderer loop shouldn't be responsible for this
            gMsgPort && (gMsgPort.disconnect() && (gMsgPort = null));

            this.stop();
            break;
          }
        }

        let controlsActive = false;
        const controlsElem = document.querySelector('.controls');
        if (controlsElem) {
          if (!controlsElem.style.zIndex) {
            // elevate the navs' z-index (to be on top of our subtitles)
            controlsElem.style.zIndex = 3;
          }
          controlsActive = controlsElem.classList.contains('active');
        }

        // NOTE: don't do this, the render rate is too high to shown the
        // image in SVG for secondary subtitles.... O_Q
        // if (controlsActive) {
        //   this.setRenderDirty(); // to move up subttles
        // }

        if (!this.subtitleWrapperElem || !this.subtitleWrapperElem.parentNode) {
          const playerContainerElem = document.querySelector('.nf-player-container');
          if (!playerContainerElem) break;
          this.subtitleWrapperElem = buildSecondarySubtitleElement(gRenderOptions);
          playerContainerElem.appendChild(this.subtitleWrapperElem);
        }


        // transform & scale primary subtitles
        // ---------------------------------------------------------------------
        // NOTE: we cannot put `primaryImageSubSvg` into instance state,
        // because there are multiple instance of the SVG and they're switched
        // when the langauge of primary subtitles is switched.
        const primaryImageSubSvg = document.querySelector('.image-based-timed-text svg');
        if (primaryImageSubSvg) {
          this.primaryImageTransformer.transform(
            primaryImageSubSvg, controlsActive, !!this.isRenderDirty);
        }

        const primaryTextSubDiv = document.querySelector('.player-timedtext');
        if (primaryTextSubDiv) {
          this.primaryTextTransformer.transform(
            primaryTextSubDiv, controlsActive, !!this.isRenderDirty);
        }


        // render secondary subtitles
        // ---------------------------------------------------------------------
        if (!this.subSvg || !this.subSvg.parentNode) {
          this.subSvg = this.subtitleWrapperElem.querySelector('svg');
        }
        const seconds = this.videoElem.currentTime;
        const sub = gSubtitles.find(sub => sub.active);
        if (sub) {
          if (sub instanceof TextSubtitle) {
            const rect = this.videoElem.getBoundingClientRect();
            sub.setExtent(rect.width, rect.height);
          }

          const renderedElems = sub.render(seconds, gRenderOptions, !!this.isRenderDirty);
          if (renderedElems) {
            const [ extentWidth, extentHeight ] = sub.getExtent();
            if (extentWidth && extentHeight) {
              this.subSvg.setAttribute('viewBox', `0 0 ${extentWidth} ${extentHeight}`);
            }
            [].forEach.call(this.subSvg.querySelectorAll('*'), elem => elem.parentNode.removeChild(elem));
            renderedElems.forEach(elem => this.subSvg.appendChild(elem));
          }
        }
        // FIXME: dirty transform & magic offets
        // this leads to a big gap between primary & secondary subtitles
        // when the progress bar is shown
        this.subtitleWrapperElem.style.top = (controlsActive) ? '-100px' : '0';

        // everything rendered, clear the dirty bit with ease
        this.isRenderDirty = false;
      } while (0);

      this.isRunning && window.requestAnimationFrame(this.loop.bind(this));
    }
    catch (err) {
      console.error('Fatal: ', err);
    }
  }
}


window.addEventListener('resize', (evt) => {
  gRendererLoop && gRendererLoop.setRenderDirty();
  console.log('Resize:',
    `${window.innerWidth}x${window.innerHeight} (${evt.timeStamp})`);
});


// -----------------------------------------------------------------------------

class NflxMultiSubsManager {
  constructor() {
    this.lastMovieId = undefined;
    this.playerUrl = undefined;
    this.playerVersion = undefined;
  }
  updateManifest(manifest) {
    const isInPlayerPage = /netflix\.com\/watch/i.test(window.location.href);
    if (!isInPlayerPage) return;

    // connect with background script
    // FIXME: should disconnect this port while there's no video playing, to gray out our icon;
    // However, we can't disconnect when <video> not found in the renderer loop,
    // because there's a small time gap between updateManifest() and <video> is initialize.
    if (!gMsgPort) {
      try {
        const extensionId = window.__nflxMultiSubsExtId;
        gMsgPort = chrome.runtime.connect(extensionId);
        console.log(`Linked: ${extensionId}`);

        gMsgPort.onMessage.addListener((msg) => {
          if (msg.settings) {
            gRenderOptions = Object.assign({}, msg.settings);
            gRendererLoop && gRendererLoop.setRenderDirty();
          }
        });
      }
      catch (err) {
        console.warn('Error: cannot talk to background,', err);
      }
    }

    // player actually loaded could be different to the `<script>` one
    // (the loaded one may come from other extension)
    try {
      const originalPlayerVersion = window.__originalPlayerVersion;
      const loadedPlayerVersion = window.netflix.player.getVersion();
      console.log(`Player: loaded=${loadedPlayerVersion}`);

      if (loadedPlayerVersion !== originalPlayerVersion) {
        console.warn(`Unoffcial player detected:`,
          `presumed=${originalPlayerVersion}, loaded=${loadedPlayerVersion}`);
      }
    }
    catch (err) {
      console.warn('Error:', err);
    }

    try {
      console.log(`Manifest: ${manifest.movieId}`);

      const movieChanged = (manifest.movieId !== this.lastMovieId);
      if (movieChanged) {
        this.lastMovieId = manifest.movieId;
        gSubtitles = buildSubtitleList(manifest.textTracks);

        gSubtitleMenu = new SubtitleMenu();
        gSubtitleMenu.render();

        // select subtitle to match the default audio track
        try {
          const defaultAudioTrack = manifest.audioTracks.find(t => manifest.defaultMedia.indexOf(t.id) >= 0);
          if (defaultAudioTrack) {
            const bcp47 = defaultAudioTrack.bcp47;
            let autoSubtitleId = gSubtitles.findIndex(t => (t.bcp47 === bcp47 && t.isCaption));
            autoSubtitleId = (autoSubtitleId < 0) ? gSubtitles.findIndex(t => t.bcp47 === bcp47) : autoSubtitleId;
            if (autoSubtitleId >= 0) {
              console.log(`Subtitle "${bcp47}" auto-enabled to match audio`);
              activateSubtitle(autoSubtitleId);
            }
          }
        }
        catch (err) {
          console.error('Default audio track not found, ', err);
        }

        // retrieve video ratio
        try {
          let { width, height } = manifest.videoTracks[0].downloadables[0];
          gVideoRatio = height / width;
        }
        catch (err) {
          console.error('Video ratio not available, ', err);
        }
      }
    }
    catch (err) {
      console.error('Fatal: ', err);
    }


    if (gRendererLoop) {
      // just for safety
      gRendererLoop.stop();
      gRendererLoop = null;
      console.log('Terminated: old renderer loop');
    }

    if (!gRendererLoop) {
      gRendererLoop = new RendererLoop();
      gRendererLoop.start();
      console.log('Started: renderer loop');
    }
  }
}
window.__NflxMultiSubs = new NflxMultiSubsManager();
})();
