// fileUtils.js
const fs = require('fs');
const path = require('path');

function isFileOrDir(inputPath) {
  if (!fs.existsSync(inputPath)) return null;
  return fs.statSync(inputPath).isDirectory() ? 'dir' : 'file';
}

function getTargetFile(targetPath, defaultFileName) {
  if (!fs.existsSync(targetPath)) {
    // If doesn't exist, assume file wanted
    return targetPath;
  }
  if (isFileOrDir(targetPath) === 'file') {
    return targetPath;
  }
  // Directory: use first .cs or create default
  const files = fs.readdirSync(targetPath).filter(f => f.endsWith('.cs'));
  if (files.length > 0) return path.join(targetPath, files[0]);
  return path.join(targetPath, defaultFileName);
}

module.exports = { isFileOrDir, getTargetFile };
