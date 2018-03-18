const kDefaultSettings = require('./default-settings');


chrome.webRequest.onBeforeRequest.addListener(details => {
  console.log(`Denying: ${details.url}`);
  return { cancel: true, };
},
{
  urls: ['https://assets.nflxext.com/*cadmium-playercore*'],
  types: ['script'],
},
['blocking']);


////////////////////////////////////////////////////////////////////////////////


let gSettings = Object.assign({}, kDefaultSettings);

// return true if valid; otherwise return false
function validateSettings(settings) {
  const keys = Object.keys(kDefaultSettings);
  return keys.every(key => (key in settings));
}


chrome.storage.local.get(['settings'], (result) => {
  console.log('Loaded: settings=', result.settings);
  if (result.settings && validateSettings(result.settings))
    gSettings = result.settings;
  else
    saveSettings();
});

function saveSettings() {
  chrome.storage.local.set({ settings: gSettings }, () => {
    console.log('Settings: saved into local storage');
  });
}

// ----------------------------------------------------------------------------

function saturateActionIconForTab(tabId) {
  chrome.browserAction.setIcon({
    tabId: tabId,
    path: {
      '16': 'icon16.png',
      '32': 'icon32.png',
    },
  });
}

function desaturateActionIconForTab(tabId) {
  chrome.browserAction.setIcon({
    tabId: tabId,
    path: {
      '16': 'icon16-gray.png',
      '32': 'icon32-gray.png',
    },
  });
}

// -----------------------------------------------------------------------------

let gExtPorts = {}; // tabId -> msgPort; for config dispatching
function dispatchSettings() {
  const keys = Object.keys(gExtPorts);
  keys.map(k => gExtPorts[k]).forEach(port => {
    try {
      port.postMessage({ settings: gSettings });
    }
    catch (err) {
      console.error('Error: cannot dispatch settings,', err);
    }
  });
}

chrome.runtime.onConnectExternal.addListener(port => {
  const tabId = port.sender && port.sender.tab && port.sender.tab.id;

  gExtPorts[tabId] = port;
  saturateActionIconForTab(tabId);
  console.log(`Connected: ${tabId} (tab)`);

  port.postMessage({ settings: gSettings });

  port.onDisconnect.addListener(() => {
    delete gExtPorts[tabId];
    desaturateActionIconForTab(tabId);
    console.log(`Disconnected: ${tabId} (tab)`);
  });
});


// -----------------------------------------------------------------------------


chrome.runtime.onConnect.addListener(port => {
  const portName = port.name;
  console.log(`Connected: ${portName} (internal)`);

  if (portName === 'settings') {
    port.postMessage({ settings: gSettings });

    port.onMessage.addListener(msg => {
      console.log('Received: settings=', msg.settings);
      if (!msg.settings) {
        gSettings = Object.assign({}, kDefaultSettings);
        port.postMessage({ settings: gSettings });
      }
      else {
        let settings = Object.assign({}, gSettings);
        settings = Object.assign(settings, msg.settings);
        if (!validateSettings(settings)) {
          gSettings = Object.assign({}, kDefaultSettings);
          port.postMessage({ settings: gSettings });
        }
        else {
          gSettings = settings;
        }
      }
      saveSettings();
      dispatchSettings();
    });
  }

  port.onDisconnect.addListener(() => {
    console.log(`Disconnected: ${portName} (internal)`);
  });
});
