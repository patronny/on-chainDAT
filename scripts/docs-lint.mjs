#!/usr/bin/env node
// docs-lint.mjs - mechanical freshness checks for the canon docs.
//
// Checks (mechanical only; SEMANTIC drift is covered by the governance rule
// in CLAUDE.md and review):
//   1. PATHS   every backtick-quoted repo path mentioned in a canon doc
//              exists on disk (gitignored/runtime paths are skipped)
//   2. MARKERS every non-external invariant in docs/INVARIANTS.md has >=1
//              INV:<name> marker in tracked source files, and every marker
//              in source maps back to a registered invariant (no orphans)
//   3. XREFS   every [inv: <name>] reference in canon docs resolves
//   4. DASHES  no em dash (U+2014) or en dash (U+2013) in canon docs
//              INV:no-em-dash - hyphen only, see docs/INVARIANTS.md
//   5. CYRIL   no Cyrillic in canon docs (repo is strictly English)
//              INV:repo-english-only - see docs/INVARIANTS.md
//
// Exit 1 on any failure. Run: node scripts/docs-lint.mjs
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: 'utf8' });

// canon doc set - lint only what exists so early phases stay runnable
const canon = ['CLAUDE.md', 'docs/ARCHITECTURE.md', 'docs/INVARIANTS.md', 'docs/MODULE-PLAYBOOK.md'];
try { sh('ls docs/subsystems/*.md 2>/dev/null').trim().split('\n').filter(Boolean).forEach(f => canon.push(f)); } catch {}
const docs = canon.filter(f => existsSync(join(REPO, f)));

const fail = [];

// -- 1. PATHS: backtick-quoted repo-path-looking tokens must exist.
// A token with a '/' is a strict repo-relative path (must exist); a bare
// token is silently skipped (prose like `buyTokens()` or `fly.toml`).
// Gitignored or runtime-created paths may be absent on a fresh checkout.
const SKIP = ['obsidian/', '.env', 'node_modules/', 'automation/indexer/.ponder/', 'automation/indexer/generated/', 'frontend/.next/', 'contracts/out/', 'contracts/cache/', 'brand/'];
const PATH_RE = /`([A-Za-z0-9_.][A-Za-z0-9_./[\]-]*\.(?:sol|ts|tsx|js|mjs|py|yml|yaml|json|md|html|css|sh|toml|txt)|[A-Za-z0-9_.][A-Za-z0-9_./[\]-]*\/)`/g;
for (const doc of docs) {
  const text = readFileSync(join(REPO, doc), 'utf8');
  for (const m of text.matchAll(PATH_RE)) {
    const p = m[1];
    if (p.includes('*') || p.includes('<') || p.startsWith('http')) continue;
    if (SKIP.some(g => p === g || p.startsWith(g))) continue;
    if (existsSync(join(REPO, p))) continue;
    if (p.includes('/')) fail.push(`${doc}: missing path \`${p}\``);
  }
}

// -- 2. MARKERS: bidirectional register <-> code match.
// Register rows: | # | name | Rule | Enforced by | Severity |
// Rows whose "Enforced by" cell contains "(external)" live outside this
// repo (keeper repo, Fly) and need no in-repo marker.
const regPath = join(REPO, 'docs/INVARIANTS.md');
const reg = existsSync(regPath) ? readFileSync(regPath, 'utf8') : '';
const rows = [...reg.matchAll(/^\|\s*\d+\s*\|\s*([a-z0-9][a-z0-9-]*)\s*\|(.*)$/gm)]
  .map(m => ({ name: m[1], rest: m[2] }));
const wanted = rows.filter(r => !/\(external\)/i.test(r.rest)).map(r => r.name);
const allNames = new Set(rows.map(r => r.name));
let found = [];
try {
  // tracked source files only; .md excluded (docs cite marker names in prose)
  found = [...sh(`git grep -hE "INV:[a-z0-9-]+" -- '*.sol' '*.ts' '*.tsx' '*.js' '*.mjs' '*.py' '*.yml' '*.css' '*.sh' '*.toml' ':!frontend/src/lib/abis' ':!automation/indexer/abis'`)
    .matchAll(/INV:([a-z0-9-]+)/g)].map(m => m[1]);
} catch (e) { if (e.status !== 1) throw e; /* exit 1 = no matches */ }
const foundSet = new Set(found);
for (const w of wanted) if (!foundSet.has(w)) fail.push(`INVARIANTS.md: no INV:${w} marker in source`);
for (const f of foundSet) if (!allNames.has(f)) fail.push(`orphan marker INV:${f} not in docs/INVARIANTS.md`);

// -- 3. XREFS: [inv: name] references in canon docs must resolve
for (const doc of docs) {
  const text = readFileSync(join(REPO, doc), 'utf8');
  for (const m of text.matchAll(/\[inv:\s*([a-z0-9-]+)\]/g))
    if (!allNames.has(m[1])) fail.push(`${doc}: unknown invariant ref [inv: ${m[1]}]`);
}

// -- 4 + 5. DASHES / CYRIL: byte-level scans of canon docs
for (const doc of docs) {
  const text = readFileSync(join(REPO, doc), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/[\u2013\u2014]/.test(line)) fail.push(`${doc}:${i + 1}: em/en dash (hyphen only)`);
    if (/[\u0400-\u04FF]/.test(line)) fail.push(`${doc}:${i + 1}: Cyrillic text (repo is English-only)`);
  });
}

if (fail.length) {
  console.error(`docs-lint: ${fail.length} problem(s)`);
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log(`docs-lint: OK (${docs.length} docs, ${wanted.length} in-repo invariants, ${foundSet.size} markers)`);
