const fs = require('fs');
const path = require('path');
const { getMethodNameFromXPath, cleanXPath } = require('./utils');

const configPath = path.resolve(__dirname, 'paths.config.json');
let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function generatePOM(actions, framework = 'cypress') {
  const methodMap = {};
  const nameCounts = {};

  actions.forEach(action => {
    if (!action?.xpath || typeof action.xpath !== 'string') {
      console.warn('⚠️ Skipping malformed action in POM:', action);
      return;
    }

    let baseName = action.name?.trim()
      ? action.name.replace(/[^\w]/g, '')
      : getMethodNameFromXPath(action.xpath);

    if (!nameCounts[baseName]) {
      nameCounts[baseName] = 0;
    } else {
      nameCounts[baseName] += 1;
    }

    const methodName = nameCounts[baseName] === 0
      ? baseName
      : `${baseName}_${nameCounts[baseName]}`;

    methodMap[methodName] = cleanXPath(action.xpath);
  });

  const classLines = Object.entries(methodMap).map(
    ([name, xpath]) => `  static ${name} = \`${xpath}\`;`
  );

  const content = `export default class PageObjects {
${classLines.join('\n')}
}
`;

  let pageObjectDir;
  if (framework === 'cypress' && config.cypressPageObjectDir) {
    pageObjectDir = config.cypressPageObjectDir;
  } else if (framework === 'selenium' && config.seleniumPageObjectDir) {
    pageObjectDir = config.seleniumPageObjectDir;
  } else {
    pageObjectDir = path.join(__dirname, '..', 'RecordedPageObjects');
  }

  if (!fs.existsSync(pageObjectDir)) fs.mkdirSync(pageObjectDir, { recursive: true });

  const filePath = path.join(pageObjectDir,
    framework === 'selenium' ? 'SeleniumPageObjects.js' : 'CypressPageObjects.js');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ POM file generated at', filePath);
}

module.exports = generatePOM;
