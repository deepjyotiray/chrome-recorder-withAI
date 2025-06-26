const axios = require('axios');
const fs = require('fs');

async function fetchAuthToken(swaggerUrl, outputFilePath = './authToken.txt') {
  try {
    const response = await axios.get(swaggerUrl, {
      headers: {
        'accept': 'application/json,*/*',
        'accept-language': 'en',
        'dnt': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    });

    const token = response.data?.paths?.['/v3/generate']?.post?.parameters?.find(p => p.name === 'x-csod-authentication')?.default;
    if (!token) throw new Error('JWT token not found in Swagger response');

    fs.writeFileSync(outputFilePath, token);
    console.log(`✅ Auth token saved to ${outputFilePath}`);
    return token;
  } catch (error) {
    console.error('❌ Failed to fetch authentication token:', error.message);
    return null;
  }
}

module.exports = { fetchAuthToken };
