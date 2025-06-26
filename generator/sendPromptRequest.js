const axios = require('axios');
const fs = require('fs');
const { fetchAuthToken } = require('./authFetcher');

const GENERATE_API_URL = 'https://tools-core.qarh01.services.us-west-2.us-int-micro-qa-h01.csodaws/core-llm-gateway/v3/generate?debug=false';

async function sendPrompt(prompt, task, model = 'llama-8b') {
  let token = null;

  try {
    if (fs.existsSync('./authToken.txt')) {
      token = fs.readFileSync('./authToken.txt', 'utf-8');
    } else {
      token = await fetchAuthToken('https://tools-core.qarh01.services.us-west-2.us-int-micro-qa-h01.csodaws/core-llm-gateway/swagger/v3/swagger.json');
    }
  } catch (err) {
    console.error('❌ Failed to load token:', err.message);
    return;
  }

  const headers = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'x-csod-authentication': token,
    'x-csod-corp-id': 'qa01-chr-mav-es-ed',
    'x-csod-user-id': '1',
    'x-csod-default-culture-id': '1'
  };

  const body = {
    model,
    prompt,
    task
  };

  try {
    const response = await axios.post(GENERATE_API_URL, body, { headers });
    console.log('✅ LLM Response:', response.data);
  } catch (error) {
    console.error('❌ Error from LLM API:', error.response?.data || error.message);
  }
}

module.exports = { sendPrompt };
