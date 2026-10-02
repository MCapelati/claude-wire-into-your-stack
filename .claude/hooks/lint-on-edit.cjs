// PostToolUse hook (Edit|Write): runs ESLint --fix on the edited .js file.
// Exit 0 = clean. Exit 2 = problems remain; Claude Code feeds stderr back to Claude.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let filePath;
  try {
    filePath = JSON.parse(input).tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!filePath || !filePath.endsWith('.js')) process.exit(0);

  const relative = path.relative(projectDir, path.resolve(filePath));
  if (relative.startsWith('..') || relative.split(path.sep).includes('node_modules')) process.exit(0);

  const eslintBin = path.join(projectDir, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!fs.existsSync(eslintBin)) {
    console.error('lint-on-edit: ESLint não instalado (rode npm ci); lint ignorado.');
    process.exit(0);
  }

  const result = spawnSync(
    process.execPath,
    [eslintBin, '--fix', '--max-warnings', '0', relative],
    { cwd: projectDir, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    console.error(`ESLint encontrou problemas em ${relative} que o --fix não corrigiu:\n${result.stdout}${result.stderr}`);
    process.exit(2);
  }
});
