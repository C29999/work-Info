const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
for (const name of [
  'build_pin100.cjs',
  'build_p4module.cjs',
  'build_f4_schematic.cjs',
  'build_full_schematic.cjs',
  'simplify_main.cjs',
]) {
  console.log(`Building ${name}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, name)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
