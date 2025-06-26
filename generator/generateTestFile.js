const fs = require('fs');
const path = require('path');
const { getMethodNameFromXPath } = require('./utils');

const configPath = path.resolve(__dirname, 'paths.config.json');
let config = {};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function generateTest(actions, testName = null, framework = 'cypress') {
  const groupedByUrl = {};
  actions.forEach(action => {
    const url = action.pageUrl || 'unknown';
    if (!groupedByUrl[url]) groupedByUrl[url] = [];
    groupedByUrl[url].push(action);
  });

  let testDir;
  if (framework === 'cypress' && config.cypressTestDir) {
    testDir = config.cypressTestDir;
  } else if (framework === 'selenium' && config.seleniumTestDir) {
    testDir = config.seleniumTestDir;
  } else {
    testDir = path.join(__dirname, '..', 'e2e');
  }

  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  Object.entries(groupedByUrl).forEach(([url, urlActions], index) => {
    const isCypress = framework === 'cypress';
    const testLines = [];

    if (isCypress) {
      testLines.push(`import PageObjects from '../pageObjects/PageObjects';`);
      testLines.push('');
      testLines.push(`describe('${testName || `Recorded Test for ${url}`}', () => {`);
      testLines.push(`  it('should replay user actions on ${url}', () => {`);
      testLines.push(`    cy.visit('${url}');`);
    } else {
      const className = toPascalCase(testName || `SeleniumTest${index + 1}`);
      testLines.push('using OpenQA.Selenium;');
      testLines.push('using OpenQA.Selenium.Chrome;');
      testLines.push('');
      testLines.push(`class ${className} {`);
      testLines.push(`  static void Main() {`);
      testLines.push(`    IWebDriver driver = new ChromeDriver();`);
      testLines.push(`    driver.Navigate().GoToUrl("${url}");`);
    }

    const valid = urlActions.filter(a => a && a.type && a.xpath);
    const selectorMap = {};
    valid.forEach(a => {
      const name = a.name || getMethodNameFromXPath(a.xpath);
      selectorMap[name] = a.xpath;
      a.name = name;
    });

    Object.entries(selectorMap).forEach(([name, xpath]) => {
      const line = isCypress
        ? `const ${name} = \`${xpath}\`;`
        : `const string ${name} = "${xpath}";`;
      testLines.unshift(line);
    });

    const latestInputs = {};
    for (let i = 0; i < valid.length; i++) {
      const a = valid[i];
      if (a.type === 'input') {
        latestInputs[a.name] = { index: i, value: a.value };
      }
    }

    for (let i = 0; i < valid.length; i++) {
      const a = valid[i];
      const id = a.name;

      if (a.type === 'click') {
        testLines.push(
          isCypress
            ? `    cy.xpath(${id}).click();`
            : `    driver.FindElement(By.XPath(${id})).Click();`
        );
      }

      if (a.type === 'input') {
        if (latestInputs[id]?.index === i) {
          const value = latestInputs[id].value;
          testLines.push(
            isCypress
              ? `    cy.xpath(${id}).clear().type('${value}');`
              : `    var input = driver.FindElement(By.XPath(${id}));\n    input.Clear();\n    input.SendKeys("${value}");`
          );
        }
      }

      if (a.type === 'keypress' && a.key) {
        const key = formatKey(a.key);
        testLines.push(
          isCypress
            ? `    cy.xpath(${id}).trigger('keydown', { key: '${key}' });`
            : `    driver.FindElement(By.XPath(${id})).SendKeys(Keys.${key});`
        );
      }
    }

    if (isCypress) {
      testLines.push(`  });`);
      testLines.push(`});`);
    } else {
      testLines.push(`    driver.Quit();`);
      testLines.push(`  }`);
      testLines.push(`}`);
    }

    const safeName = (testName || `TestPage${index + 1}`).replace(/\s+/g, '_');
    const fileExt = isCypress ? 'js' : 'cs';
    const filePath = path.join(testDir, `${safeName}.${fileExt}`);
    fs.writeFileSync(filePath, testLines.join('\n'), 'utf-8');
    console.log(`✅ Test file generated at ${filePath}`);
  });
}

function formatKey(key) {
  if (typeof key !== 'string') return 'Enter';
  const map = {
    enter: 'Enter',
    tab: 'Tab',
    escape: 'Escape',
    backspace: 'Backspace',
    delete: 'Delete',
    arrowup: 'ArrowUp',
    arrowdown: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    arrowright: 'ArrowRight',
  };
  return map[key.toLowerCase()] || key;
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s(.)/g, s => s.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/^(.)/, s => s.toUpperCase());
}

module.exports = generateTest;
