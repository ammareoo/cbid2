// Run from a trusted build checkout with the two lockfiles installed. No local secrets are inputs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stage = await mkdtemp(path.join(os.tmpdir(), 'cbid-package-'));
const output = path.join(root, 'deployment/dist');
async function put(source, destination) {
  const target = path.join(stage, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, source), target);
}
async function* files(directory, prefix = '') {
  for (const entry of await readdir(path.join(root, directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) yield* files(directory, relative);
    else if (entry.isFile()) yield relative;
    else throw new Error('Unexpected non-file: ' + relative);
  }
}
try {
  const windows = process.platform === 'win32';
  execFileSync(windows ? 'cmd.exe' : 'npm', windows ? ['/d', '/c', 'npm run build'] : ['run', 'build'],
    { cwd: root, stdio: 'inherit' });
  const manifest = JSON.parse(await readFile(path.join(root, 'backend/package.json'), 'utf8'));
  delete manifest.devDependencies;
  manifest.scripts = {
    start: 'node app.cjs', worker: 'node dist/worker.js --once',
    migrate: 'node dist/scripts/migrate.js', 'create-admin': 'node dist/scripts/create-admin.js',
  };
  const lock = JSON.parse(await readFile(path.join(root, 'backend/package-lock.json'), 'utf8'));
  delete lock.packages[''].devDependencies;
  for (const [name, metadata] of Object.entries(lock.packages)) {
    if (metadata.dev === true) delete lock.packages[name];
  }
  await mkdir(path.join(stage, 'backend'), { recursive: true });
  await writeFile(path.join(stage, 'backend/package.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(stage, 'backend/package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  const runtimeRoot = path.join(stage, 'backend');
  const install = ['ci', '--omit=dev', '--no-audit', '--no-fund'];
  execFileSync(windows ? 'cmd.exe' : 'npm', windows ? ['/d', '/c', 'npm ' + install.join(' ')] : install,
    { cwd: runtimeRoot, stdio: 'inherit' });
  execFileSync(process.execPath, ['-e', "const a=require('@node-rs/argon2');a.hash('release-package-smoke-test').then(h=>a.verify(h,'release-package-smoke-test')).then(ok=>{if(!ok)process.exit(1)})"],
    { cwd: runtimeRoot, stdio: 'inherit' });
  // Validate installation locally, but install native dependencies again on the target Linux host.
  await rm(path.join(runtimeRoot, 'node_modules'), { recursive: true, force: true });
  await put('deployment/production.env.example', 'backend/.env.example');
  await put('deployment/app.cjs', 'backend/app.cjs');
  await put('database/bootstrap.sql', 'database/bootstrap.sql');
  for await (const file of files('database/migrations')) {
    if (/^\d{4}_[a-z0-9_]+\.sql$/.test(file)) await put('database/migrations/' + file, 'database/migrations/' + file);
  }
  for await (const file of files('backend/src')) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts') || ['scripts/seed.ts', 'db/seed-data.ts'].includes(file)) continue;
    const built = 'backend/dist/' + file.replace(/\.ts$/, '.js');
    await put(built, built);
  }
  for await (const file of files('frontend/dist')) {
    if (!['index.html', 'favicon.svg', 'BGImage.jpeg', 'CBID Institute Logo Emblem.png'].includes(file)
      && !/^assets\/[\w.-]+\.(js|css|png|webp|jpe?g|woff2?|svg)$/i.test(file)) {
      throw new Error('Review unexpected public asset before packaging: ' + file);
    }
    await put('frontend/dist/' + file, 'web/' + file);
  }
  for (const name of ['VERPEX_CPANEL_DEPLOYMENT.md', 'DEPLOYMENT_REQUIREMENTS.md', 'PRODUCTION_CHECKLIST.md', 'BACKUP_AND_RECOVERY.md']) {
    await put(name, name);
  }
  await mkdir(output, { recursive: true });
  const archive = path.join(stage, 'release.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', stage, 'backend', 'web', 'database',
    'VERPEX_CPANEL_DEPLOYMENT.md', 'DEPLOYMENT_REQUIREMENTS.md', 'PRODUCTION_CHECKLIST.md', 'BACKUP_AND_RECOVERY.md'], { stdio: 'inherit' });
  const hash = createHash('sha256').update(await readFile(archive)).digest('hex');
  const filename = 'cbid-lms-' + hash.slice(0, 16) + '.tar.gz';
  await copyFile(archive, path.join(output, filename));
  await writeFile(path.join(output, filename + '.sha256'), hash + '  ' + filename + '\n');
  console.log(path.join(output, filename));
} finally {
  await rm(stage, { recursive: true, force: true });
}
