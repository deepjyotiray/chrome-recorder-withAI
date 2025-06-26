const fs = require('fs');
const path = require('path');
const { refactorSeleniumFile } = require('./refactorWithAI.js');
const config = require('./paths.config.json');

const seleniumTestDir = config.seleniumTestsDir;
const POLL_INTERVAL_MS = 2000;

if (!seleniumTestDir) {
  console.error("❌ Error: 'seleniumTestsDir' not defined in paths.config.json");
  process.exit(1);
}

console.log(`👀 Polling every 2s for .cs test files in: ${seleniumTestDir}`);

const initialFileSnapshot = new Set(
  fs.readdirSync(seleniumTestDir)
    .filter(file => file.endsWith('.cs'))
    .map(file => path.join(seleniumTestDir, file))
);

const seenFiles = new Set();

setInterval(() => {
  try {
    const currentFiles = fs.readdirSync(seleniumTestDir)
      .filter(file => file.endsWith('.cs'))
      .map(file => path.join(seleniumTestDir, file));

    currentFiles.forEach(filePath => {
      if (!initialFileSnapshot.has(filePath) && !seenFiles.has(filePath)) {
        console.log(`📄 Detected new .cs test file: ${filePath}`);
        seenFiles.add(filePath);

        refactorSeleniumFile(filePath, seleniumTestDir)
          .then(() => {
            console.log(`✅ Refactored: ${filePath}`);
          })
          .catch(err => {
            console.error(`❌ Refactor failed for ${filePath}: ${err.message}`);
          });
      }
    });
  } catch (err) {
    console.error(`❌ Failed to poll directory: ${err.message}`);
  }
}, POLL_INTERVAL_MS);
