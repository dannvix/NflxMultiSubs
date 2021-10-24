class PlaybackRateController {
  constructor() {
    this.keyUpHandler = undefined;
    this.timer = undefined;
  }


  activate() {
    if (this.keyUpHandler) return;

    this.keyUpHandler = window.addEventListener('keyup',
      this._keyUpHandler.bind(this));
  }


  deactivate() {
    if (!this.keyUpHandler) return;

    window.removeEventListener('keyup', this.keyUpHandler);
    this.keyUpHandler = null;
  }


  _keyUpHandler(evt) {
    if (evt.ctrlKey || evt.altKey || evt.shiftKey || evt.metaKey) return;
    if ((evt.keyCode !== 219 /* [ */) && (evt.keyCode !== 221 /* ] */)) return;

    const playerContainer = document.querySelector('.watch-video');
    if (!playerContainer) return;

    const video = playerContainer.querySelector('video');
    if (!video) return;

    let playbackRate = video.playbackRate;
    if (evt.keyCode === 219) playbackRate -= 0.1; // key [ pressed
    else if (evt.keyCode == 221) playbackRate += 0.1; // ] pressed

    playbackRate = Math.max(Math.min(playbackRate, 3.0), 0.1);
    video.playbackRate = playbackRate;

    let osd = document.querySelector('.nflxmultisubs-playback-rate');
    if (!osd) {
      osd = document.createElement('div');
      osd.classList.add('nflxmultisubs-playback-rate');
      osd.style.position = 'absolute'; osd.style.top = '10%'; osd.style.right = '5%';
      osd.style.fontSize = '36px'; osd.style.fontFamily = 'sans-serif';
      osd.style.fontWeight = '800'; osd.style.color = 'white';
      osd.style.display = 'flex'; osd.style.alignItems='center';
      osd.style.zIndex = 2;
      playerContainer.appendChild(osd);
    }
    if (!osd) return;

    const icon = `<svg viewBox="0 0 100 100" style="height:28px; margin:0 10px;">
      <polygon points="0 0 45 50 50 50 50 0 95 50 50 100 50 50 45 50 0 100" fill="white"/>
    </svg>`;

    osd.innerHTML = `${icon}<span>${playbackRate.toFixed(1)}x</span>`;

    if (this.timer) clearTimeout(this.timer);
    osd.style.transition = 'none';
    osd.style.opacity = '1';
    this.timer = setTimeout(() => {
      osd.style.transition = 'opacity 2.3s';
      osd.style.opacity = '0';
      this.timer = null;
    }, 200);
  }
}

module.exports = PlaybackRateController;
