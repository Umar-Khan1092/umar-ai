const fs = require('fs');
const path = require('path');

const issues = [];

function checkFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch(e) {
    return;
  }
  const rel = filePath.replace(/\\/g, '/');

  // Check page.tsx files for default export
  if (filePath.endsWith('page.tsx')) {
    if (!content.includes('export default')) {
      issues.push('MISSING DEFAULT EXPORT: ' + rel);
    }
  }

  // Check CSS imports exist
  const lines = content.split('\n');
  lines.forEach(line => {
    const m = line.match(/import\s+['"]([^'"]+\.css)['"]/);
    if (m) {
      const cssPath = m[1];
      let resolved;
      if (cssPath.startsWith('@/')) {
        resolved = path.join('src', cssPath.slice(2));
      } else {
        resolved = path.join(path.dirname(filePath), cssPath);
      }
      if (!fs.existsSync(resolved)) {
        issues.push('MISSING CSS: ' + resolved + ' (from ' + rel + ')');
      }
    }
  });

  // Check named TS/TSX imports exist (only for local ./ imports)
  lines.forEach(line => {
    const m = line.match(/from\s+['"](\.[^'"]+)['"]/);
    if (m) {
      const imp = m[1];
      const dir = path.dirname(filePath);
      const candidates = [
        path.join(dir, imp),
        path.join(dir, imp + '.ts'),
        path.join(dir, imp + '.tsx'),
        path.join(dir, imp + '.js'),
        path.join(dir, imp, 'index.ts'),
        path.join(dir, imp, 'index.tsx'),
      ];
      const exists = candidates.some(c => fs.existsSync(c));
      if (!exists && !imp.endsWith('.css')) {
        issues.push('MISSING IMPORT: ' + imp + ' (from ' + rel + ')');
      }
    }
  });
}

function scanDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch(e) {
    return;
  }
  entries.forEach(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.next') {
      scanDir(full);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      checkFile(full);
    }
  });
}

scanDir('src');

if (issues.length === 0) {
  console.log('No issues found!');
} else {
  console.log('Issues found (' + issues.length + '):');
  issues.forEach(i => console.log('  ' + i));
}
