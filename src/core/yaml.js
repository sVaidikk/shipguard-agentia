// Tiny YAML subset parser: top-level keys, one level of nesting, scalar values.
// Zero dependencies on purpose so the tool installs anywhere.
function scalar(v) {
  const s = v.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s.replace(/^['"]|['"]$/g, '');
}

export function parseYaml(text) {
  const root = {};
  let current = root;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '');
    if (!line.trim()) continue;
    const indent = line.match(/^ */)[0].length;
    const m = line.trim().match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (indent === 0) {
      if (value === '') {
        root[key] = {};
        current = root[key];
      } else {
        root[key] = scalar(value);
        current = root;
      }
    } else {
      current[key] = scalar(value);
    }
  }
  return root;
}
