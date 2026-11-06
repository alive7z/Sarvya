const normalize = (text = '') => text.replace(/\s+/g, ' ').trim();
const blocks = new Set(['P', 'DIV', 'LI', 'SECTION', 'ARTICLE', 'UL', 'OL', 'TABLE', 'TR', 'BR']);
const landmarks = new Set(['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'region']);

// A bounded DOM reading outline, not an implementation of the accessibility tree.
export function accessibleName(element, document) {
  const references = (element.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  const referenced = normalize(references.map((id) => document.getElementById(id)?.textContent || '').join(' '));
  if (referenced) return referenced;
  const aria = normalize(element.getAttribute('aria-label') || '');
  if (aria) return aria;
  if (element.tagName === 'IMG') return normalize(element.getAttribute('alt') || '');
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
    const labels = Array.from(element.labels || []);
    const label = normalize(labels.map((node) => node.textContent).join(' '));
    if (label) return label;
    if (['submit', 'reset', 'button'].includes(element.type)) {
      return normalize(element.getAttribute('value') || ({ submit: 'Submit', reset: 'Reset' }[element.type] || ''));
    }
    if (element.type === 'image') return normalize(element.getAttribute('alt') || '');
    return normalize(element.getAttribute('title') || '');
  }
  return normalize(element.textContent || element.getAttribute('title') || '');
}

function semanticRole(element) {
  const explicit = element.getAttribute('role')?.split(/\s+/)[0];
  if (explicit) return explicit;
  const tag = element.tagName;
  if (/^H[1-6]$/.test(tag)) return 'heading';
  if (tag === 'A' && element.hasAttribute('href')) return 'link';
  if (tag === 'BUTTON') return 'button';
  if (tag === 'IMG') return 'img';
  if (tag === 'SELECT') return 'combobox';
  if (tag === 'TEXTAREA') return 'textbox';
  if (tag === 'INPUT') {
    return ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', submit: 'button', reset: 'button', button: 'button', image: 'button' })[element.type] || 'textbox';
  }
  if (tag === 'MAIN') return 'main';
  if (tag === 'NAV') return 'navigation';
  if (tag === 'ASIDE') return 'complementary';
  if (tag === 'HEADER' && !element.closest('article, section, main')) return 'banner';
  if (tag === 'FOOTER' && !element.closest('article, section, main')) return 'contentinfo';
  return '';
}

export function collectReadingItems(document, { maxItems = 500, maxCharacters = 30000 } = {}) {
  const items = [];
  let buffer = '';
  let bufferElement = null;
  let characters = 0;
  let visited = 0;
  let truncated = false;
  const add = (text, kind, element) => {
    text = normalize(text);
    if (!text) return;
    // Short utterances avoid feeding entire documents to a single speech request.
    const chunks = text.match(/.{1,260}(?:\s|$)|\S{1,260}/g) || [text];
    for (const chunk of chunks) {
      if (items.length >= maxItems || characters + chunk.length > maxCharacters) { truncated = true; return; }
      characters += chunk.length;
      items.push({ text: chunk.trim(), kind, element });
    }
  };
  const flush = () => { add(buffer, 'text', bufferElement); buffer = ''; bufferElement = null; };
  const visit = (node) => {
    if (truncated) return;
    if (++visited > 10000) { truncated = true; return; }
    if (node.nodeType === 3) {
      buffer += ` ${node.textContent}`;
      bufferElement ||= node.parentElement;
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    if (el.matches('script, style, noscript, template, [hidden], [inert], [aria-hidden="true"], input[type="hidden"], #accesslens-overlay-script, [id^="accesslens-marker"], [id^="accesslens-tooltip"]')) return;
    if (el.style.display === 'none' || ['hidden', 'collapse'].includes(el.style.visibility)) return;
    const style = document.defaultView?.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse')) return;
    const role = semanticRole(el);
    if (role === 'heading') {
      flush(); add(`Heading level ${el.getAttribute('aria-level') || (/^H[1-6]$/.test(el.tagName) ? el.tagName.slice(1) : '2')}, ${accessibleName(el, document)}`, 'heading', el); return;
    }
    if (landmarks.has(role)) {
      flush(); const name = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ? accessibleName(el, document) : '');
      add(`${role}${name ? `, ${name}` : ''}`, 'landmark', el);
    } else if (role === 'img') {
      flush();
      if (el.getAttribute('alt') === '' && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) return;
      add(`Image, ${accessibleName(el, document) || 'no accessible name'}`, 'image', el); return;
    } else if (['link', 'button', 'textbox', 'combobox', 'checkbox', 'radio', 'slider', 'spinbutton', 'switch', 'tab'].includes(role)) {
      flush();
      const name = accessibleName(el, document) || 'no accessible name';
      const states = [];
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') states.push('disabled');
      if (el.required || el.getAttribute('aria-required') === 'true') states.push('required');
      if (['checkbox', 'radio', 'switch'].includes(role)) states.push(el.getAttribute('aria-checked') === 'mixed' ? 'mixed' : (el.checked || el.getAttribute('aria-checked') === 'true' ? 'checked' : 'not checked'));
      if (el.hasAttribute('aria-expanded')) states.push(el.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed');
      add([name, role, ...states].join(', '), role === 'link' ? 'link' : 'control', el); return;
    }
    const block = blocks.has(el.tagName);
    if (block) flush();
    for (const child of el.childNodes) visit(child);
    if (block) flush();
  };
  if (document.body) visit(document.body);
  flush();
  return { items, truncated, language: document.documentElement?.lang || '' };
}

export function readSnippet(html = '') {
  const document = new DOMParser().parseFromString(String(html).slice(0, 100000), 'text/html');
  const result = collectReadingItems(document);
  result.truncated ||= String(html).length > 100000;
  if (document.title) result.items.unshift({ text: `Document title, ${document.title}`, kind: 'text' });
  if (document.documentElement.lang) result.items.unshift({ text: `Document language, ${document.documentElement.lang}`, kind: 'text' });
  return result;
}
