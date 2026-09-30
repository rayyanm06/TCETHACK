import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: '',
  MONGODB_DB: 'civicclean_browser_test',
  ALLOW_MEMORY_DB: 'true',
  DEMO_MODE: 'false',
  STORAGE_DRIVER: 'local',
  VISION_PROVIDER: 'none',
  CORS_ORIGINS: 'http://127.0.0.1:4173',
  PUBLIC_API_ORIGIN: 'http://127.0.0.1:4000',
});
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
let server, browser, vite, citizenPage, ops;
await mkdir('test-results', { recursive: true });
try {
  await connectDB();
  await User.create({
    name: 'Browser Test Operator',
    email: 'browser-op@example.test',
    passwordHash: await bcrypt.hash('browser-test-password', 10),
    role: 'OPERATOR',
  });
  server = app.listen(4000, '127.0.0.1');
  vite = spawn(
    process.execPath,
    [
      '../frontend/node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
      '--strictPort',
    ],
    {
      cwd: '../frontend',
      env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:4000/api' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Vite startup timeout')), 20000);
    vite.stdout.on('data', (d) => {
      if (d.toString().includes('4173')) {
        clearTimeout(timer);
        resolve();
      }
    });
    vite.on('exit', (c) => {
      clearTimeout(timer);
      reject(new Error(`Vite exited ${c}`));
    });
  });
  browser = await chromium.launch({ headless: true });
  const citizen = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 19.2075, longitude: 72.8765 },
    permissions: ['geolocation'],
  });
  const operator = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  citizenPage = await citizen.newPage();
  ops = await operator.newPage();
  const exceptions = [];
  for (const p of [citizenPage, ops]) p.on('pageerror', (e) => exceptions.push(e.message));
  await citizenPage.goto('http://127.0.0.1:4173/login');
  await citizenPage.getByRole('button', { name: 'New citizen? Create an account' }).click();
  await citizenPage.getByLabel('Full Name').fill('Browser Citizen');
  await citizenPage.getByLabel('Email Address').fill('browser-citizen@example.test');
  await citizenPage.getByLabel('Password').fill('browser-citizen-password');
  await citizenPage.getByRole('button', { name: 'Create Account', exact: true }).click();
  await citizenPage.getByText('Hello, Browser').waitFor();
  assert.equal(await citizenPage.getByText('One-Click Demo Profiles').count(), 0);
  await citizenPage.getByRole('button', { name: 'Something to dispose of at home?' }).click();
  const photo = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#449988' },
  })
    .jpeg()
    .toBuffer();
  await citizenPage
    .locator('input[type=file]')
    .last()
    .setInputFiles({ name: 'browser-test.jpg', mimeType: 'image/jpeg', buffer: photo });
  await citizenPage.getByRole('button', { name: 'E-waste', exact: false }).click();
  await citizenPage.getByLabel('Items', { exact: true }).fill('Test keyboard');
  await citizenPage.getByLabel('Number of items').fill('1');
  await citizenPage.getByRole('button', { name: 'Set location' }).click();
  await citizenPage.getByRole('button', { name: 'Use my location' }).click();
  await citizenPage.getByText('Inside pilot area', { exact: false }).waitFor();
  assert.equal(await citizenPage.locator('.leaflet-container').count(), 1);
  await citizenPage.screenshot({ path: 'test-results/citizen-location.png', fullPage: true });
  await citizenPage.getByRole('button', { name: 'Confirm location', exact: true }).click();
  await citizenPage.getByRole('button', { name: 'Submit request', exact: true }).click();
  await citizenPage.getByText('Request received', { exact: true }).waitFor();
  await citizenPage.getByRole('button', { name: 'Track this request' }).click();
  await citizenPage.getByText('Operational Progress Timeline').waitFor();
  await citizenPage.screenshot({ path: 'test-results/citizen-report.png', fullPage: true });
  const reportUrl = citizenPage.url();
  await ops.goto('http://127.0.0.1:4173/login');
  await ops.getByLabel('Email Address').fill('browser-op@example.test');
  await ops.getByLabel('Password').fill('browser-test-password');
  await ops.getByRole('button', { name: 'Sign In', exact: true }).click();
  await ops.getByRole('button', { name: 'Review', exact: true }).first().click();
  await ops.getByText('Private request · 1 × Test keyboard').waitFor();
  await ops.getByRole('button', { name: 'Verify Event & Evidence' }).click();
  await ops.getByRole('button', { name: 'Review', exact: true }).first().click();
  await ops.getByText('Record completion evidence').waitFor();
  const receipt = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#778899' },
  })
    .jpeg()
    .toBuffer();
  await ops
    .getByLabel('Completion photograph (required)')
    .setInputFiles({ name: 'test-receipt.jpg', mimeType: 'image/jpeg', buffer: receipt });
  await ops.getByLabel('Receiving facility / service').fill('Test-only receiving service');
  await ops.getByLabel('Receipt or acceptance reference').fill('BROWSER-TEST-001');
  await ops.getByLabel('Verified service source URL').fill('https://example.test/receipt');
  await ops
    .getByPlaceholder('Operator clearance note...')
    .fill('Test receiving service acceptance checked.');
  await ops.getByAltText('Uploaded completion evidence').waitFor();
  await ops.screenshot({ path: 'test-results/operator-handoff.png', fullPage: true });
  await ops.getByRole('button', { name: 'Confirm Resolution' }).click();
  await citizenPage.goto(reportUrl);
  await citizenPage.getByText('Operator-recorded completion', { exact: true }).waitFor();
  await citizenPage.screenshot({ path: 'test-results/citizen-completion.png', fullPage: true });
  citizenPage.once('dialog', (d) =>
    d.accept('The reported issue is still present. Please inspect again.'),
  );
  await citizenPage.getByRole('button', { name: 'Still unresolved? Reopen for review' }).click();
  await citizenPage.getByText('Current status: Received for review').waitFor();
  assert.deepEqual(exceptions, []);
  console.log(
    'PASS: mobile registration → GPS household report → operator verification → evidence-backed handoff → citizen tracking → reopen.',
  );
} catch (e) {
  for (const [name, p] of [
    ['citizen', citizenPage],
    ['operator', ops],
  ])
    if (p)
      await p
        .screenshot({ path: `test-results/failure-${name}.png`, fullPage: true })
        .catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (vite) vite.kill();
  if (server) await new Promise((r) => server.close(r));
  await disconnectDB();
}
