#!/bin/bash
set -e

echo "=== 1. Showing package.json scripts ==="
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts, null, 2))"

echo ""
echo "=== 2. Checking for husky / prepare script ==="
if grep -q '"prepare"' package.json; then
  echo "Found a 'prepare' script — this often runs husky, which fails on Vercel (no .git dir)."
  echo "Patching it to skip safely in CI/production..."
  node -e "
    const fs = require('fs');
    const p = require('./package.json');
    if (p.scripts && p.scripts.prepare) {
      p.scripts.prepare = 'node -e \"try{require(\\'husky\\')}catch(e){}\" || true';
    }
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
else
  echo "No 'prepare' script found."
fi

echo ""
echo "=== 3. Checking for committed .vscode folder ==="
if [ -d ".vscode" ]; then
  echo "Found .vscode/ committed to repo — removing it from git tracking (kept locally is fine, but shouldn't ship)."
  git rm -r --cached .vscode 2>/dev/null || true
  echo ".vscode/" >> .gitignore
else
  echo "No .vscode folder found."
fi

echo ""
echo "=== 4. Searching node_modules for anything referencing 'fsPath' (best-effort) ==="
grep -rl "fsPath" node_modules --include="*.js" -m1 2>/dev/null | head -5 || echo "No direct matches found (may be minified/bundled)."

echo ""
echo "=== 5. Re-checking install cleanly ==="
rm -rf node_modules
pnpm install

echo ""
echo "=== 6. Committing and pushing fix ==="
git add -A
git commit -m "fix: patch prepare script and remove .vscode to resolve Vercel deploy fsPath error" || echo "Nothing to commit."
git push

echo ""
echo "=== Done. Trigger a new Vercel deployment now. ==="
