const webpack = require('webpack');
const config = require('../webpack.config');

webpack(config, (err, stats) => {
  if (err) {
    console.error(err.stack || err);
    err.details && console.error(err.details);
    return;
  }

  console.log(stats.toString({ colors: true }));
});
