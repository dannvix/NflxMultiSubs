const path = require('path');

const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsWebpackPlugin = require('uglifyjs-webpack-plugin');


// =============================================================================

const mode = (process.env.NODE_ENV || 'production');

const kProjectDir = __dirname;
const kSourceDir = path.join(kProjectDir, 'src');
const kBuildDir = path.join(kProjectDir, 'build');
const kModulesDir = path.join(kProjectDir, 'node_modules');


// -----------------------------------------------------------------------------

const browsers = ['chrome', 'firefox'];
const configs = browsers.map(browser => {
  const buildDir = path.join(kBuildDir, browser);
  return {
    mode: mode,

    entry: {
      background: path.join(kSourceDir, 'background.js'),
      content: path.join(kSourceDir, 'content.js'),
      settings: path.join(kSourceDir, 'settings.js'),
      nflxmultisubs: path.join(kSourceDir, 'nflxmultisubs.js'),
    },
    output: {
      path: buildDir,
      filename: '[name].min.js',
    },

    plugins: [
      new CleanWebpackPlugin(buildDir),
      new CopyWebpackPlugin([
        {
          from: path.join(kSourceDir, 'manifest.json'),
          transform: (content, path) => Buffer.from(JSON.stringify({
            short_name: process.env.npm_package_name,
            description: process.env.npm_package_description,
            version: process.env.npm_package_version,
            ...JSON.parse(content.toString('utf-8'))
          }, null, '\t')),
        },
        {
          from: path.join(kSourceDir, '*.+(html|png|css)'),
          flatten: true,
        },
      ]),
      new UglifyJsWebpackPlugin({
        // ref. https://github.com/webpack/webpack/issues/6567#issuecomment-369554250
        uglifyOptions: {
          ecma: 8,
          compress: {
            inline: 1,
          },
          parallel: true,
        },
      }),
      new webpack.DefinePlugin({
        BROWSER: JSON.stringify(browser),
      }),
    ],
  };
});


module.exports = configs;
