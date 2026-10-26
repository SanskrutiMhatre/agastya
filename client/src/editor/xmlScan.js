// Lightweight scanning of XML text for the XML panel (no parse): which elements are open at a
// position, and the element children each has so far. Used by schema-aware completion.

// The element stack open at `offset`, with each open element's closed child names so far.
export function openStack(text) {
  const stack = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^[>]|\[[\s\S]*?\])*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const closed = stack.pop();
      if (closed && stack.length) stack[stack.length - 1].children.push(closed.name);
    } else if (m[2]) {
      if (m[4] === '/') { if (stack.length) stack[stack.length - 1].children.push(m[2]); }
      else stack.push({ name: m[2], children: [] });
    }
  }
  return stack;
}

