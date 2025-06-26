const { fork } = require('child_process');
const path = require('path');

const watcher1 = fork(path.join(__dirname, 'watcher.js'));
const watcher2 = fork(path.join(__dirname, 'seleniumWatcher.js'));

watcher1.on('exit', (code) => console.log(`🔁 watcher.js exited with code ${code}`));
watcher2.on('exit', (code) => console.log(`🔁 seleniumWatcher.js exited with code ${code}`));
