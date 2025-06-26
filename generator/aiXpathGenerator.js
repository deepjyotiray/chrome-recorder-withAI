const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const LLM_URL = 'http://localhost:11434/api/generate';
const MODEL = 'codellama:13b-instruct';

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node aiXpathGenerator.js <page-url>');
    process.exit(1);
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const elements = await page.evaluate(() => {
    const selector = [
      'button',
      'a[href]',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      'select',
      'textarea'
    ].join(',');

    const nodes = Array.from(document.querySelectorAll(selector));

    function getBasicXPath(el) {
      const parts = [];
      while (el && el.nodeType === Node.ELEMENT_NODE) {
        let idx = 1;
        let sib = el.previousSibling;
        while (sib) {
          if (sib.nodeType === Node.ELEMENT_NODE && sib.nodeName === el.nodeName) idx++;
          sib = sib.previousSibling;
        }
        parts.unshift(`${el.nodeName.toLowerCase()}[${idx}]`);
        el = el.parentNode;
      }
      return '/' + parts.join('/');
    }

    return nodes.map(el => ({
      text: el.innerText?.trim() || el.value || '',
      tag: el.tagName.toLowerCase(),
      attrs: {
        id: el.id || '',
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        'aria-label': el.getAttribute('aria-label') || '',
        title: el.getAttribute('title') || ''
      },
      basicXPath: getBasicXPath(el)
    }));
  });

  await browser.close();

  const prompt = `
You are an AI that generates human-readable XPath selectors and names for web UI elements. 
Given the URL: ${url} and the element list:

${JSON.stringify(elements, null, 2)}

Respond with a JSON array of objects with:
- name: human-readable PascalCase name (e.g. SaveButton, UserNameInput)
- xpath: best XPath using id, text(), aria-label, placeholder, or title attributes
`.trim();

  console.log('[LLM] 🔼 Prompt Sent:', prompt);

  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'codellama:13b-instruct',
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
  const parsed = JSON.parse(cleaned);

  const outPath = path.resolve(__dirname, 'aiXpaths.json');
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf-8');
  console.log(`✅ Saved to ${outPath}`);
})();
