let settings = {};

const port = chrome.runtime.connect({ name: 'settings' });
port.onMessage.addListener((msg) => {
  settings = msg.settings || settings;
  renderActiveSettings();
});

// -----------------------------------------------------------------------------

const layoutPresets = [
  { // compact
    upperBaselinePos: 0.20,
    lowerBaselinePos: 0.80,
  },
  { // moderate (default)
    upperBaselinePos: 0.15,
    lowerBaselinePos: 0.85,
  },
  { // ease
    upperBaselinePos: 0.10,
    lowerBaselinePos: 0.90,
  },
];

const primarySizePresets = [
  { // x-small
    primaryImageScale: 0.55,
    primaryTextScale: 0.75,
  },
  { // small
    primaryImageScale: 0.65,
    primaryTextScale: 0.85,
  },
  { // medium (default)
    primaryImageScale: 0.75,
    primaryTextScale: 0.95,
  },
  { // large
    primaryImageScale: 0.85,
    primaryTextScale: 1.05,
  },
  { // x-large
    primaryImageScale: 0.95,
    primaryTextScale: 1.10,
  },
];

const secondarySizePresets = [
  { // x-small
    secondaryImageScale: 0.35,
    secondaryTextScale: 0.85,
  },
  { // small
    secondaryImageScale: 0.42,
    secondaryTextScale: 0.92,
  },
  { // medium (default)
    secondaryImageScale: 0.50,
    secondaryTextScale: 1.00,
  },
  { // large
    secondaryImageScale: 0.60,
    secondaryTextScale: 1.10,
  },
  { // x-large
    secondaryImageScale: 0.70,
    secondaryTextScale: 1.20,
  },
];


function uploadSettings() {
  port.postMessage({ settings: settings });
}

function resetSettings() {
  port.postMessage({ settings: null });
}

function renderActiveSettings() {
  if (document.readyState !== 'complete') return;

  // clear all
  [].forEach.call(document.querySelectorAll('.active'), elem => {
    elem.classList.remove('active');
  });

  let elem;

  // layout
  const layoutId = layoutPresets.findIndex(k => (k.lowerBaselinePos === settings.lowerBaselinePos));
  if (layoutId !== -1) {
    elem = document.querySelector(`.settings-layout > div[data-id="${layoutId}"]`);
    elem && elem.classList.add('active');
  }
  // primary font size
  const primaryFontSizeId = primarySizePresets.findIndex(k => (k.primaryImageScale === settings.primaryImageScale));
  if (primaryFontSizeId !== -1) {
    elem = document.querySelector(`.settings-primary-font-size div.font-size[data-id="${primaryFontSizeId}"]`);
    elem && elem.classList.add('active');
  }

  // secondary font size
  const secondaryFontSizeId = secondarySizePresets.findIndex(k => (k.secondaryImageScale === settings.secondaryImageScale));
  if (secondaryFontSizeId !== -1) {
    elem = document.querySelector(`.settings-secondary-font-size div.font-size[data-id="${secondaryFontSizeId}"]`);
    elem && elem.classList.add('active');
  }

  // secondary language
  // TODO
}

function updateLayout(layoutId) {
  if (layoutId < 0 || layoutId >= layoutPresets.length) return;

  settings = Object.assign(settings, layoutPresets[layoutId]);
  uploadSettings();
  renderActiveSettings();
}

function updatePrimaryFontSize(fontSizeId) {
  if (fontSizeId < 0 || fontSizeId >= primarySizePresets.length) return;

  settings = Object.assign(settings, primarySizePresets[fontSizeId]);
  uploadSettings();
  renderActiveSettings();
}

function updateSecondaryFontSize(fontSizeId) {
  if (fontSizeId < 0 || fontSizeId >= secondarySizePresets.length) return;

  settings = Object.assign(settings, secondarySizePresets[fontSizeId]);
  uploadSettings();
  renderActiveSettings();
}


function renderVersion() {
  let elem = document.querySelector('#version');
  if (elem) {
    elem.textContent = VERSION;
  }
}


window.addEventListener('load', evt => {
  renderVersion();
  renderActiveSettings();

  // handle click events
  // ---------------------------------------------------------------------------
  const layouts = document.querySelectorAll('.settings-layout > div');
  [].forEach.call(layouts, div => {
    const layoutId = parseInt(div.getAttribute('data-id'));
    div.addEventListener('click', evt => updateLayout(layoutId), false);
  });

  const primarySizes = document.querySelectorAll('.settings-primary-font-size div.font-size');
  [].forEach.call(primarySizes, div => {
    const fontSizeId = parseInt(div.getAttribute('data-id'));
    div.addEventListener('click', evt => updatePrimaryFontSize(fontSizeId), false);
  });

  const secondarySizes = document.querySelectorAll('.settings-secondary-font-size div.font-size');
  [].forEach.call(secondarySizes, div => {
    const fontSizeId = parseInt(div.getAttribute('data-id'));
    div.addEventListener('click', evt => updateSecondaryFontSize(fontSizeId), false);
  });

  const btnReset = document.getElementById('btnReset');
  btnReset.addEventListener('click', evt => {
    resetSettings();
  }, false);
});
