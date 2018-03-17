const path = require('path');

const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');


// =============================================================================


const kProjectDir = __dirname;
const kSourceDir = path.join(kProjectDir, 'src');
const kBuildDir = path.join(kProjectDir, 'build');
const kModulesDir = path.join(kProjectDir, 'node_modules');


// -----------------------------------------------------------------------------


const config = {
  mode: process.env.NODE_ENV || 'production',

  entry: {
    background: path.join(kSourceDir, 'background.js'),
    content: path.join(kSourceDir, 'content.js'),
    settings: path.join(kSourceDir, 'settings.js'),
    nflxmultisubs: path.join(kSourceDir, 'nflxmultisubs.js'),
  },
  output: {
    path: kBuildDir,
    filename: '[name].min.js',
  },

  plugins: [
    new CleanWebpackPlugin(kBuildDir),
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
  ],
};

module.exports = config;
