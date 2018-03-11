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

// TODO: dispatch configs to injected agent on Netflix player page (realtime preview)
chrome.runtime.onConnectExternal.addListener(port => {
  let tabId;
  if (port.sender && port.sender.tab) {
    tabId = port.sender.tab.id;
  }
  console.log(`Connected: ${tabId} (tab)`);

  // saturate our icon
  chrome.browserAction.setIcon({
    tabId: tabId,
    path: {
      '16': 'icon16.png',
      '32': 'icon32.png',
    },
  });

  port.onDisconnect.addListener(() => {
    console.log(`Disconnected: ${tabId} (tab)`);

    // reset the icon to grayscale
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: {
        '16': 'icon16-gray.png',
        '32': 'icon32-gray.png',
      },
    });
  });
});


// -----------------------------------------------------------------------------

// TODO: receive configs from our pop-up/options page (realtime preview)
chrome.runtime.onConnect.addListener(port => {
  const portName = port.name;
  console.log(`Connected: ${portName} (internal)`);

  port.onDisconnect.addListener(() => {
    console.log(`Disconnected: ${portName} (internal)`);
  });
});
