let actions = [];
let visitedUrls = new Set();
let selectedFramework = 'cypress';
let currentFocusedInput = null;
const inputValues = {};
const usedXPaths = new Map();

chrome.runtime.sendMessage({ type: 'get-framework' }, response => {
  if (response?.framework) {
    selectedFramework = response.framework;
  }
});

visitedUrls.add(location.href);
window.addEventListener('popstate', () => visitedUrls.add(location.href));
window.addEventListener('hashchange', () => visitedUrls.add(location.href));
window.addEventListener('DOMContentLoaded', () => visitedUrls.add(location.href));

function startRecording() {
  console.log('[Recorder] Recording started');
  document.addEventListener('click', recordClick, true);
  document.addEventListener('input', recordInput, true);
  document.addEventListener('keydown', recordKeyPress, true);
  injectFloatingStopButton();
}

function stopRecording() {
  console.log('[Recorder] Recording stopped');
  document.removeEventListener('click', recordClick, true);
  document.removeEventListener('input', recordInput, true);
  document.removeEventListener('keydown', recordKeyPress, true);

  const testName = prompt("Enter a custom test name (optional):");

  chrome.runtime.sendMessage({ type: 'ai-name-actions', actions }, response => {
    const finalActions = response?.success ? response.actions : actions;
    const output = {
      actions: finalActions,
      visitedPages: Array.from(visitedUrls),
      testName: testName?.trim() || null,
      framework: selectedFramework
    };
    downloadJSON(output, 'recordedActions.json');
  });

  removeFloatingStopButton();
}

function recordClick(e) {
  const el = getInteractableAncestor(e.target);
  const xpath = getXPath(el);
  const pageUrl = location.href;
  const domContext = getDOMContext(el);

  if (usedXPaths.has(xpath)) {
    const name = usedXPaths.get(xpath);
    actions.push({ type: 'click', xpath, name, pageUrl });
    return;
  }

  chrome.runtime.sendMessage({ type: 'generate-ai-name', xpath, tag: el.tagName, domContext }, response => {
    let name = response?.name;
    if (!name || name.toLowerCase().includes('generated')) name = generateName(el);
    usedXPaths.set(xpath, name);
    actions.push({ type: 'click', xpath, name, pageUrl });
  });

  currentFocusedInput = null; // blur previous input
}

function recordInput(e) {
  const el = getInteractableAncestor(e.target);
  const xpath = getXPath(el);
  const name = getOrGenerateName(el, xpath);
  const pageUrl = location.href;
  const value = el.value;

  if (!value) return;

  inputValues[name] = value;
  currentFocusedInput = name;

  setTimeout(() => {
    if (inputValues[name] === value) {
      actions.push({ type: 'input', xpath, name, value, pageUrl });
    }
  }, 300);
}

function recordKeyPress(e) {
  const el = getInteractableAncestor(e.target);
  const xpath = getXPath(el);
  const name = getOrGenerateName(el, xpath);
  const key = e.key;
  const pageUrl = location.href;

  if (currentFocusedInput && name === currentFocusedInput) {
    return; // skip keys inside active input
  }

  actions.push({ type: 'keypress', key, xpath, name, pageUrl });
}

function getOrGenerateName(el, xpath) {
  if (usedXPaths.has(xpath)) return usedXPaths.get(xpath);

  const domContext = getDOMContext(el);
  let name = null;

  chrome.runtime.sendMessage({ type: 'generate-ai-name', xpath, tag: el.tagName, domContext }, response => {
    name = response?.name;
    if (!name || name.toLowerCase().includes('generated')) name = generateName(el);
    usedXPaths.set(xpath, name);
  });

  if (!name) {
    name = generateName(el);
    usedXPaths.set(xpath, name);
  }

  return name;
}

function getDOMContext(el) {
  const container = document.createElement('div');
  const parent = el.closest('form, section, div, label') || el.parentNode;
  if (!parent) return '';
  container.innerHTML = parent.innerHTML;
  return container.innerText.trim().slice(0, 1000);
}

function generateName(el) {
  const tag = el.tagName?.toLowerCase();
  const text = el.innerText?.trim();
  if (text && text.length < 100) return `xpath${toPascalCase(text)}${tag === 'button' ? 'Button' : ''}`;
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return `xpath${toPascalCase(placeholder)}Input`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `xpath${toPascalCase(aria)}`;
  const title = el.getAttribute('title');
  if (title) return `xpath${toPascalCase(title)}`;
  const label = getLabelText(el);
  if (label) return `xpath${toPascalCase(label)}${tag === 'input' ? 'Input' : ''}`;
  const fallback = el.id || el.name || Math.random().toString(16).slice(2, 8);
  return `xpathGenerated${toPascalCase(fallback)}`;
}

function getLabelText(el) {
  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label && label.innerText.trim()) return label.innerText.trim();
  }
  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.innerText.trim()) return parentLabel.innerText.trim();
  return '';
}

function getInteractableAncestor(el) {
  const interactableTags = ['button', 'a', 'input', 'select', 'textarea'];
  let current = el;
  for (let i = 0; i < 4 && current; i++) {
    if (interactableTags.includes(current.tagName?.toLowerCase())) {
      return current;
    }
    current = current.parentElement;
  }
  return el;
}

function getXPath(el) {
  if (!el || el.nodeType !== 1) return '';

  const tag = el.tagName.toLowerCase();

  if (el.id) return `//*[@id='${el.id}']`;

  const attributes = ['placeholder', 'aria-label', 'title', 'name'];
  for (const attr of attributes) {
    const val = el.getAttribute(attr);
    if (val) return `//${tag}[@${attr}='${val}']`;
  }

  const text = el.textContent?.trim();
  if (text && text.length <= 50 && /\w/.test(text)) {
    return `//${tag}[normalize-space(text())='${text}']`;
  }

  const labelText = getLabelText(el);
  if (labelText) {
    return `//label[normalize-space(text())='${labelText}']//${tag}`;
  }

  for (let i = 0; i < 5 && el.parentElement; i++) {
    el = el.parentElement;
    const parentText = el.innerText?.trim();
    if (
        parentText && parentText.length <= 50 &&
        ['div', 'span', 'button', 'label'].includes(el.tagName.toLowerCase())
    ) {
      return `//${el.tagName.toLowerCase()}[normalize-space(text())="${parentText}"]//${tag}`;
    }

    const className = el.className?.trim();
    if (className) {
      return `//${tag}[ancestor::*[contains(@class, "${className.split(' ')[0]}")]]`;
    }
  }

  return generateFallbackXPath(el);
}

function generateFallbackXPath(el) {
  let path = '';
  while (el && el.nodeType === 1) {
    let index = 1;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === el.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    path = `/${el.tagName.toLowerCase()}[${index}]${path}`;
    el = el.parentNode;
  }
  return path;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function injectFloatingStopButton() {
  const btn = document.createElement('div');
  btn.id = '__floatingStopRecorder';
  btn.textContent = '⏹ Stop Recording';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#dc3545',
    color: 'white',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 'bold',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    zIndex: '999999',
    fontFamily: 'sans-serif'
  });
  btn.addEventListener('click', () => {
    window.dispatchEvent(new Event('stop-recording'));
  });
  document.body.appendChild(btn);
}

function removeFloatingStopButton() {
  const btn = document.getElementById('__floatingStopRecorder');
  if (btn) btn.remove();
}

function toPascalCase(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, ' ')
      .replace(/\s(.)/g, s => s.toUpperCase())
      .replace(/\s+/g, '')
      .replace(/^(.)/, s => s.toUpperCase());
}

window.addEventListener('start-recording', startRecording);
window.addEventListener('stop-recording', stopRecording);
