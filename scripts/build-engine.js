const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const binDir = path.resolve(__dirname, '../simulation-engine/bin');
fs.mkdirSync(binDir, { recursive: true });

const binName = os.platform() === 'win32' ? 'cloud_sim_engine.exe' : 'cloud_sim_engine';
const target = path.join(binDir, binName);
const src = path.resolve(__dirname, '../simulation-engine/src/main.cpp');

console.log(`Compiling C++ simulation engine to ${target}...`);
execSync(`g++ -std=c++14 -O3 "${src}" -o "${target}"`, { stdio: 'inherit' });
console.log('C++ engine build complete.');
