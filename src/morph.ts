/**
 * Tiny DOM morph: patches `target`'s children to match `html` while keeping existing nodes,
 * so CSS transitions, focus and <img> elements survive re-renders.
 * Nodes marked with `data-transient` (e.g. ripple waves) are left untouched.
 */
export function morph(target: Element, html: string) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  patchChildren(target, tpl.content);
}

const keyOf = (n: Node) => (n instanceof Element ? n.getAttribute('data-key') : null);
const isTransient = (n: Node) => n instanceof Element && n.hasAttribute('data-transient');

function same(a: Node, b: Node) {
  if (a.nodeType !== b.nodeType) return false;
  if (a instanceof Element && b instanceof Element) return a.tagName === b.tagName && keyOf(a) === keyOf(b);
  return true;
}

function patchChildren(from: Node, to: Node) {
  const fromKids = Array.from(from.childNodes).filter((n) => !isTransient(n));
  const toKids = Array.from(to.childNodes);
  // Keyed lookup so reordered/inserted keyed items reuse their nodes.
  const keyed = new Map<string, Node>();
  for (const n of fromKids) {
    const k = keyOf(n);
    if (k) keyed.set(k, n);
  }
  let cursor = 0;
  const used = new Set<Node>();
  for (const t of toKids) {
    const k = keyOf(t);
    let match: Node | undefined;
    if (k && keyed.has(k) && !used.has(keyed.get(k)!)) match = keyed.get(k);
    else {
      while (cursor < fromKids.length && used.has(fromKids[cursor])) cursor++;
      const cand = fromKids[cursor];
      if (cand && !keyOf(cand) && same(cand, t)) match = cand;
    }
    const ref = nextRealSibling(from, used);
    if (match) {
      used.add(match);
      if (match !== ref) from.insertBefore(match, ref);
      patchNode(match, t);
    } else {
      from.insertBefore(t, ref);
      used.add(t);
    }
  }
  for (const n of fromKids) if (!used.has(n)) from.removeChild(n);
}

/** First child of `parent` that hasn't been placed yet (transients skipped). */
function nextRealSibling(parent: Node, used: Set<Node>): Node | null {
  for (let n = parent.firstChild; n; n = n.nextSibling) {
    if (!used.has(n) && !isTransient(n)) return n;
  }
  return null;
}

function patchNode(from: Node, to: Node) {
  if (from.nodeType === Node.TEXT_NODE || from.nodeType === Node.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  if (!(from instanceof Element) || !(to instanceof Element)) return;
  for (const { name } of Array.from(from.attributes)) {
    if (!to.hasAttribute(name)) from.removeAttribute(name);
  }
  for (const { name, value } of Array.from(to.attributes)) {
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
  if (from instanceof HTMLInputElement && to instanceof HTMLInputElement) {
    if (from.checked !== to.hasAttribute('checked')) from.checked = to.hasAttribute('checked');
    return;
  }
  patchChildren(from, to);
}
