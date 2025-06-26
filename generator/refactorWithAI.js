// refactorWithAI.js (Updated to wait for LLM and parse full response)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./paths.config.json');

const GENERATE_API_URL = 'https://tools-core.qarh01.services.us-west-2.us-int-micro-qa-h01.csodaws/core-llm-gateway/v3/generate?debug=false';
const SWAGGER_TOKEN_URL = 'https://tools-core.qarh01.services.us-west-2.us-int-micro-qa-h01.csodaws/core-llm-gateway/swagger/v3/swagger.json';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // TEMP: ignore self-signed cert errors

async function fetchInternalToken() {
  console.log('🌐 Fetching token from Swagger...');
  try {
    const response = await axios.get(SWAGGER_TOKEN_URL, {
      headers: {
        'accept': 'application/json,*/*',
        'accept-language': 'en',
        'dnt': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    const token = response.data?.paths?.['/v3/generate']?.post?.parameters?.find(p => p.name === 'x-csod-authentication')?.default;
    console.log('🔐 Token retrieved from Swagger:', token?.substring(0, 80) + '...');
    return token;
  } catch (err) {
    console.error('❌ Failed to fetch authentication token:', err.message);
    return null;
  }
}

async function sendPromptWithToken(prompt, task, token, logFilePath) {
  const headers = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'x-csod-authentication': token,
    'x-csod-corp-id': 'qa01-chr-mav-es-ed',
    'x-csod-user-id': '1',
    'x-csod-default-culture-id': '1'
  };

  const body = { model: 'llama-8b', prompt, task };

  console.log('📤 Sending prompt to LLM Gateway...');
  try {
    const response = await axios.post(GENERATE_API_URL, body, { headers, timeout: 60000 });
    const result = response.data;
    fs.writeFileSync(path.join(config.seleniumTestDir, 'llm-response.json'), JSON.stringify(result, null, 2));
    console.log('✅ LLM Response received and logged');
    return result?.data?.processedResponse || result?.data?.originalResponse;
  } catch (err) {
    console.error('❌ Error from LLM API:', err.response?.data || err.message);
    return null;
  }
}

async function refactorSeleniumFile(newFilePath, dir) {
  const allFiles = fs.readdirSync(dir)
    .filter(f => f.endsWith('.cs'))
    .map(f => path.join(dir, f));

  const contextSamples = allFiles
    .filter(f => f !== newFilePath)
    .slice(0, 1)
    .map(f => {
      const content = fs.readFileSync(f, 'utf8');
      return `// From ${path.basename(f)}\n${content.substring(0, 1000)}...`;
    })
    .join('\n\n');

  const newTestContent = fs.readFileSync(newFilePath, 'utf8').substring(0, 2000);

  const prompt = `
You are a senior automation engineer. Here are some custom Selenium test files using wrapper methods:

${contextSamples}

Now refactor the following newly generated Selenium test file to follow the same structure, using those wrapper methods and page objects where appropriate.

=== BEGIN TEST FILE ===
${newTestContent}
=== END TEST FILE ===

Only return the refactored C# code.
`.trim();

  const task = 'Refactor Selenium file using internal framework';

  try {
    console.log('⚡ Starting refactor for file:', newFilePath);
    const token = await fetchInternalToken();
    if (!token) throw new Error('No token received');

    const aiOutput = await sendPromptWithToken(prompt, task, token);
    if (!aiOutput || aiOutput.length < 10) throw new Error('Empty or invalid response from AI');

    const blocks = [...aiOutput.matchAll(/```csharp[\s\S]*?```/g)].map(match =>
      match[0].replace(/```csharp|```/g, '').trim()
    );
    const mainCode = blocks.length > 0 ? blocks[0] : aiOutput.trim();

    const backupPath = newFilePath + '.bak';
    fs.renameSync(newFilePath, backupPath);
    fs.writeFileSync(newFilePath, mainCode, 'utf8');

    console.log(`✅ Refactored file saved: ${newFilePath}`);
  } catch (err) {
    console.error(`❌ Refactor failed: ${err.message}`);
  }
}

module.exports = { refactorSeleniumFile };
