const acorn = require('acorn');
const console = require('./console');
const { patch } = require('./nflx-player-patch');


////////////////////////////////////////////////////////////////////////////////


// updated when we got `<script src...>` in the observer
let origPlayerUrl, origPlayerVersion;

window.addEventListener('load', () => {
  let scriptElem = document.createElement('script');
  scriptElem.setAttribute('type', 'text/javascript');
  scriptElem.textContent = `(() => {
      window.__originalPlayerUrl = ${JSON.stringify(origPlayerUrl)};
      window.__originalPlayerVersion = ${JSON.stringify(origPlayerVersion)};
      window.__nflxMultiSubsExtId = ${JSON.stringify(chrome.runtime.id)};
    })();`;
  document.body.appendChild(scriptElem);

  const scriptsToInject = ['nflxmultisubs.min.js'];
  scriptsToInject.forEach(scriptName => {
    const scriptElem = document.createElement('script');
    scriptElem.setAttribute('type', 'text/javascript');
    scriptElem.setAttribute('src', chrome.extension.getURL(scriptName));
    document.head.appendChild(scriptElem);
    console.log(`Injected: ${scriptName}`);
  });
});



////////////////////////////////////////////////////////////////////////////////


function mutateUrl(url) {
  const u = new URL(url);
  const doubleSlashPath = u.pathname.replace(/\//g, '//');
  const encodedPath = doubleSlashPath.replace('-', '%2d');
  const port = (uu.port || (/https:/i.test(u.protocol) ? ':443' : ':80'));
  const mutatedUrl = `${u.protocol}\/\/:@${u.host}${port}${encodedPath}#`;
  return mutatedUrl;
}


const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeName.toLowerCase() !== 'script') return;
      if (node.id !== 'player-core-js') return;

      const playerNode = node;
      let playerUrl = playerNode.getAttribute('src');
      playerNode.removeAttribute('src');
      console.log(`Intercepted: ${playerUrl}`);

      // URL looks like "https://assets.nflxext.com/en_us/ffe/player/html/cadmium-playercore-5.0008.727.011.js"
      origPlayerUrl = playerUrl;
      let match = /playercore-(\d+\.\d+\.\d+\.\d+)\.js/.exec(origPlayerUrl);
      if (match) {
        origPlayerVersion = match[1];
      }

      const _patchCodeAndLoad = (playerScript) => {
        const patched = patch(playerScript);
        const blob = new Blob([patched], { type: 'text/javascript', });
        playerNode.setAttribute('src', URL.createObjectURL(blob));
        playerNode.addEventListener('load', () => {
          URL.revokeObjectURL(node.getAttribute('src'));
        });
      };

      // fetch original player code, and patch it!
      fetch(playerUrl).then(r => r.text()).then(body => {
        if ((typeof origPlayerVersion === 'string') &&
            (body.indexOf(origPlayerVersion) < 0))
        {
          // trying to bypass other extensinos :-)
          // they intercept the request and reply with a local patched code (likely out-dated)
          console.warn("Warning: the player might be tempered by others -- let's bypass them ^_<");

          const mutatedUrl = mutateUrl(playerUrl);
          fetch(mutatedUrl).then(r => r.text()).then(body2 => {
            if (body2.indexOf(origPlayerVersion) < 0) {
              console.warn('Warning: still got a outdated player, fine :-(');
              _patchCodeAndLoad(body); // body2 may be more corrupt
            }
            else {
              console.log('Success: got the latest official player, hehe!');
              _patchCodeAndLoad(body2);
            }
          });
        }
        else {
          _patchCodeAndLoad(body);
        }
      });

      observer.disconnect();

      // FYI to users who open the developer console
      console.log(`FYI: "net::ERR_BLOCKED_BY_CLIENT" error is intented`,
        `(for player code patching)`);
    });
  });
});
const options = { subtree: true, childList: true, };
observer.observe(document, options);
