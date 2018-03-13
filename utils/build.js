const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const fse = require('fs-extra');


// =============================================================================


const kScriptDir = path.dirname(require.main.filename);
const kProjectDir = path.join(kScriptDir, '..');

const kExtSrcDir = path.join(kProjectDir, 'src');
const kBuildDir = path.join(kProjectDir, 'build');
const kModulesDir = path.join(kProjectDir, 'node_modules');


// -----------------------------------------------------------------------------


console.log('Preparing build/ directory ...');
fse.removeSync(kBuildDir);
fse.ensureDirSync(kBuildDir);


console.log('Generating manifest.json ...');
const buildManifest = (() => {
  const manifestInPath = path.join(kExtSrcDir, 'manifest.json');
  const manifestOutPath = path.join(kBuildDir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(manifestInPath), 'utf-8');
  fs.writeFileSync(manifestOutPath, JSON.stringify({
    short_name: process.env.npm_package_name,
    description: process.env.npm_package_description,
    version: process.env.npm_package_version,
    ...m
  }, null, '\t'), 'utf-8');
})();


console.log('Minifying *.js scripts ...');
fs.readdirSync(kExtSrcDir).forEach(basename => {
  const p = path.parse(basename);
  if (p.ext.toLowerCase() !== '.js') return;

  const inPath = path.join(kExtSrcDir, basename);
  const outPath = path.join(kBuildDir, `${p.name}.min.js`);
  child_process.spawnSync('babel-minify', [inPath, '--outFile', outPath],
    { stdio: 'inherit' });
});


console.log('Copying dependencies ...');
const minifyAcorn = (() => {
  const inPath = path.join(kModulesDir, 'acorn', 'dist', 'acorn.js');
  const outPath = path.join(kBuildDir, 'acorn.min.js');
  child_process.spawnSync('babel-minify', [inPath, '--outFile', outPath],
    { stdio: 'inherit' });
})();

const copyJsZip = (() => {
  const srcPath = path.join(kModulesDir, 'jszip', 'dist', 'jszip.min.js');
  const dstPath = path.join(kBuildDir, 'jszip.min.js');
  fse.copySync(srcPath, dstPath);
})();


console.log('Copying assets ...');
fs.readdirSync(kExtSrcDir).forEach(basename => {
  const p = path.parse(basename);
  if (!['.html', '.png'].some(n => p.ext.toLowerCase() === n)) return;

  const srcPath = path.join(kExtSrcDir, basename);
  const dstPath = path.join(kBuildDir, basename);
  fse.copySync(srcPath, dstPath);
});

console.log('Built !!');
