const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const fse = require('fs-extra');


// =============================================================================


const kScriptDir = path.dirname(require.main.filename);
const kProjectDir = path.join(kScriptDir, '..');

const kBuildDir = path.join(kProjectDir, 'build');
const kDistDir = path.join(kProjectDir, 'dist');
const kModulesDir = path.join(kProjectDir, 'node_modules');


// -----------------------------------------------------------------------------


if (!fs.lstatSync(kBuildDir).isDirectory()) {
  console.error('Error: build/ unavailable');
  process.exit(1);
}


console.log('Preparing dist/ directory ...');
fse.ensureDirSync(kDistDir);


console.log('Archiving build/ ...');
const archive = (() => {
  const outName = `${process.env.npm_package_name}_v${process.env.npm_package_version}.zip`;

  const srcPath = path.join(kBuildDir);
  const outPath = path.join(kDistDir, outName);

  fse.removeSync(outPath);
  child_process.spawnSync('zip', ['-j', '-r', '-9', outPath, srcPath],
    { stdio: 'inherit' });
})();


console.log('Packed !!');
