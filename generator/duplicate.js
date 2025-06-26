const fs = require('fs');
const path = require('path');
const { getMethodNameFromXPath, cleanXPath } = require('./utils');

/**
 * Generates a PageObjects.js file with human-readable and unique XPath entries.
 * It uses the 'name' field from recorded actions if available, falling back to a hash-based name.
 */
function generatePOM(actions, outputRootPath) {
    const methodMap = {};
    const nameCounts = {};

    actions.forEach(action => {
        let baseName = action.name && action.name.trim()
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

        const cleanedXPath = cleanXPath(action.xpath);

        if (!methodMap[methodName]) {
            methodMap[methodName] = cleanedXPath;
        }
    });

    const classLines = Object.entries(methodMap).map(([name, xpath]) =>
        `  static ${name} = \`${xpath}\`;`
    );

    const content = `export default class PageObjects {
${classLines.join('\n')}
}
`;
    // ✅ Update: write to cypress/PageObjects/PageObjects.js
    const pageObjectDir = path.join(outputRootPath, '..', 'PageObjects');
    if (!fs.existsSync(pageObjectDir)) fs.mkdirSync(pageObjectDir, { recursive: true });

    const filePath = path.join(pageObjectDir, 'PageObjects.js');
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log('✅ POM file generated at', filePath);
}

module.exports = generatePOM;
