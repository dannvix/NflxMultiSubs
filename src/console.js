// wraper console.xxx() to add prefix
const prefix = 'NflxMultiSubs>';
const console = {
  log: (...args) => window.console.log(prefix, ...args),
  warn: (...args) => window.console.warn(prefix, ...args),
  error: (...args) => window.console.error(prefix, ...args),
  debug: (...args) => window.console.debug(prefix, ...args),
};

module.exports = console;
