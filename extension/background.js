const LLM_URL = 'http://localhost:11434/api/generate';
const MODEL = 'codellama:13b-instruct';

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'generate-ai-info') {
    const { tag, domContext } = req;
    const prompt = `
You are an AI that creates XPath selectors and human-readable names for HTML elements.

Given:
- Tag: ${tag}
- DOM: """${domContext.slice(0, 1000)}"""

Return:
{
  "name": "SaveButton",
  "xpath": "//button[text()='Save']"
}
`;

    callLLM(prompt)
        .then(resp => {
          const parsed = JSON.parse(resp);
          sendResponse({
            success: true,
            name: sanitizeName(parsed.name),
            xpath: parsed.xpath
          });
        })
        .catch(err => {
          console.error('[LLM] Failed to generate AI info:', err);
          sendResponse({ success: false });
        });
    return true;
  }

  if (req.type === 'get-framework') {
    chrome.storage.local.get('framework', data => {
      const framework = data.framework || 'cypress';
      sendResponse({ framework });
    });
    return true;
  }
});

async function callLLM(prompt) {
  console.log('[LLM] 🔼 Prompt Sent:', prompt);

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false
    })
  });

  const body = await res.text();

  if (!res.ok) {
    console.error('[LLM] ❌ HTTP Error:', res.status);
    console.error('[LLM] ❌ Response Body:', body);
    throw new Error(`LLM server returned status ${res.status}`);
  }

  console.log('[LLM] ✅ Raw Response:', body);

  const cleaned = body.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  return cleaned;
}

function sanitizeName(name) {
  return name
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/^(\d)/, '_$1');
}
