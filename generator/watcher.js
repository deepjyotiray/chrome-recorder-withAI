const fs = require('fs');
const path = require('path');
const os = require('os');
const generateTest = require('./generateTestFile');
const generatePOM = require('./generatePOMFile');

const downloadsFolder = path.join(os.homedir(), 'Downloads');
const outputPath = path.resolve(__dirname, '../output');

console.log('👀 Polling every 2s for recordedActions*.json in:', downloadsFolder);

setInterval(() => {
  fs.readdir(downloadsFolder, (err, files) => {
    if (err) {
      console.error('❌ Error reading downloads folder:', err);
      return;
    }

    files
      .filter(file => file.startsWith('recordedActions') && file.endsWith('.json'))
      .forEach(file => {
        const srcPath = path.join(downloadsFolder, file);
        const destPath = path.join(outputPath, file);

        try {
          if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });
          fs.renameSync(srcPath, destPath);
          console.log(`📦 Archived ${file}`);

          setTimeout(() => {
            try {
              const rawData = fs.readFileSync(destPath, 'utf-8');
              const parsed = JSON.parse(rawData);

              const actions = (parsed.actions || []).filter(a =>
                a && a.type && a.xpath && typeof a.xpath === 'string'
              );

              if (actions.length === 0) throw new Error('No valid actions to process.');

              const testName = parsed.testName || null;
              const framework = parsed.framework || 'cypress';

              console.log(`🧪 Processing ${file} with ${actions.length} valid actions`);
              generatePOM(actions, framework);
              generateTest(actions, testName, framework);

              console.log(`✅ Done with ${file}`);
            } catch (err) {
              console.error(`❌ Failed to process ${file}: ${err.message}`);
            }
          }, 500);
        } catch (err) {
          console.error(`❌ Error moving or processing ${file}: ${err.message}`);
        }
      });
  });
}, 2000);
