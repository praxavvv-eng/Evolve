/* Minimal DOM patcher. Re-rendering a screen after a small state change updates only what changed, so images do not
 * reload, scroll positions and focus survive, and progress bars animate between old and new values.
 * Elements are matched by tag and position, or by data-id / href when present (lists, shelves). */
const keyOf = el => (el.nodeType === 1 ? el.getAttribute('data-id') || el.getAttribute('href') || el.id || '' : '');

function syncAttrs(a, b) {
  [...a.attributes].forEach(at => { if (!b.hasAttribute(at.name)) a.removeAttribute(at.name); });
  [...b.attributes].forEach(at => { if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); });
}

function patchNode(a, b) {
  if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  syncAttrs(a, b);
  if (a.tagName === 'INPUT') {
    if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
    else if (document.activeElement !== a) a.value = b.getAttribute('value') ?? '';
    return;
  }
  if (a.tagName === 'TEXTAREA') { if (document.activeElement !== a) a.value = b.textContent; return; }
  patchChildren(a, b);
  if (a.tagName === 'SELECT') { const sel = [...a.options].find(o => o.hasAttribute('selected')); if (sel) a.value = sel.value; }
}

function patchChildren(a, b) {
  const old = [...a.childNodes], next = [...b.childNodes];
  const pool = new Map();
  old.forEach(n => { const k = keyOf(n); if (k) (pool.get(k) || pool.set(k, []).get(k)).push(n); });
  const used = new Set(), result = [];
  next.forEach((nb, i) => {
    const k = keyOf(nb);
    let match = null;
    if (k && pool.get(k)?.length) match = pool.get(k).shift();
    else if (!k && old[i] && !used.has(old[i]) && !keyOf(old[i])) match = old[i];
    if (match && match.nodeType === nb.nodeType && match.nodeName === nb.nodeName) { used.add(match); patchNode(match, nb); result.push(match); }
    else result.push(document.importNode(nb, true));
  });
  old.forEach(n => { if (!used.has(n)) n.remove(); });
  result.forEach((n, i) => { if (a.childNodes[i] !== n) a.insertBefore(n, a.childNodes[i] || null); });
}

export function morph(root, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  patchChildren(root, tpl.content);
}
