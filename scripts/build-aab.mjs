import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const androidDir = resolve(root, 'android');
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const unsigned = process.argv.includes('--unsigned');

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(androidDir)) {
  console.error('Android project not found. Run this from the Kickoff Star project root.');
  process.exit(1);
}

const signingReady = ['KEYSTORE_PATH', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']
  .every((name) => Boolean(process.env[name]));

if (!unsigned && !signingReady) {
  console.warn('\nNo release keystore environment variables detected.');
  console.warn('Building an unsigned AAB. This is fine for testing, but Google Play requires a signed release bundle.');
  console.warn('For a Play-ready build, set KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS and KEY_PASSWORD, then rerun npm run build:aab.\n');
}

run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android']);
run(gradle, ['bundleRelease'], androidDir);

const output = resolve(androidDir, 'app/build/outputs/bundle/release/app-release.aab');
console.log(`\n✓ AAB build complete: ${output}`);
if (!signingReady || unsigned) {
  console.log('  Status: unsigned release AAB (testing only).');
} else {
  console.log('  Status: signed release AAB.');
}
