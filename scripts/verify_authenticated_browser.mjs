// CI only: ephemeral synthetic identities and data in the isolated LOCAL stack.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TANAW_PLAYWRIGHT_MODULE || 'playwright');
const statusProcess = spawnSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8' });
assert.equal(statusProcess.status, 0, 'Local status must be available');
const config = JSON.parse(statusProcess.stdout);
const url = config.API_URL ?? config.api_url;
assert.equal(url, 'http://127.0.0.1:55321', 'Synthetic setup must target the isolated local stack only');
const publicKey = config.PUBLISHABLE_KEY ?? config.ANON_KEY ?? config.anon_key;
const privateKey = config.SECRET_KEY ?? config.SERVICE_ROLE_KEY ?? config.service_role_key;
assert.ok(publicKey && privateKey, 'Local-only keys must be available');
const admin = createClient(url, privateKey, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID();
const users = {};
for (const role of ['teacher', 'subjectCoordinator', 'smeaCoordinator', 'schoolHead', 'districtCoordinator']) {
  const password = randomUUID() + randomUUID();
  const email = `${role.toLowerCase()}-${run}@fixture.invalid`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(result.error, null, 'Synthetic local account must be created');
  users[role] = { id: result.data.user.id, email, password };
}
const school = randomUUID(), block = randomUUID(), cycle = randomUUID(), definition = randomUUID();
const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
let sql = `insert into public.tanaw_schools(id,name) values(${q(school)},'Synthetic browser school');\n`;
for (const [role, user] of Object.entries(users)) sql += `insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values(${q(school)},${q(user.id)},array[${q(role)}],array['math']);\n`;
sql += `insert into public.tanaw_instructional_blocks(id,school_year,label,end_date,source_order,source_url,verified_at) values(${q(block)},'Fixture','Synthetic block',current_date-1,'SYNTHETIC','https://fixture.invalid/calendar',now());\n`;
sql += `insert into public.tanaw_reporting_cycles(id,school_id,instructional_block_id,deadline_at,created_by) values(${q(cycle)},${q(school)},${q(block)},now()+interval '1 day',${q(users.smeaCoordinator.id)});\n`;
sql += `insert into public.smea_indicator_definitions(id,school_id,indicator_code,label,unit,school_year,reporting_period,definition_status,source_id,source_title,source_locator,formula_expression,numerator_definition,denominator_definition,rounding_rule) values(${q(definition)},${q(school)},'FIXTURE','Synthetic manual indicator','count','Fixture','Synthetic block','verified','fixture','Synthetic source','https://fixture.invalid/indicator','fixture expression','fixture numerator','fixture denominator','fixture rounding');\n`;
sql += `begin; set local role authenticated; select set_config('request.jwt.claim.sub',${q(users.smeaCoordinator.id)},true); select public.tanaw_assign_submission(${q(cycle)},${q(users.teacher.id)},'math','Synthetic class A','Synthetic browser assignment'); select public.tanaw_set_slot_requirements((select id from public.tanaw_submissions where slot_id in (select id from public.tanaw_submission_slots where cycle_id=${q(cycle)})),0,array[${q(definition)}::uuid],'Synthetic browser requirements'); commit;`;
const seed = spawnSync('docker', ['exec', '-i', 'supabase_db_project-tanaw', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
assert.equal(seed.status, 0, 'Synthetic local workflow setup must succeed');
const build = spawnSync('npm', ['run', 'build'], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey }, stdio: 'inherit' });
assert.equal(build.status, 0, 'Configured local preview must build');
const python = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], { encoding: 'utf8' });
assert.equal(python.status, 0, 'Isolated preview worker needs an installed Python');
const server = spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], { detached: true, stdio: 'ignore', env: { ...process.env, TANAW_APP_ORIGIN: 'http://127.0.0.1:3000', TANAW_ECR_PREVIEW_ENABLED: '1', TANAW_ECR_PYTHON: python.stdout.trim() } });
const origin = 'http://127.0.0.1:3000';
let browser;
const pages = [];
const output = 'artifacts/authenticated-ui';
await mkdir(output, { recursive: true });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 200)); }
  assert.ok(ready, 'Production server must start');
  browser = await chromium.launch();
  async function login(role) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => { const target = new URL(route.request().url()); return [origin, url].includes(target.origin) || target.protocol === 'data:' ? route.continue() : route.abort(); });
    await page.goto(origin + '/login');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to main content', 'Keyboard entry starts at skip link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content', 'Skip link focuses main content');
    await page.getByLabel('Email address').fill(users[role].email);
    await page.getByLabel('Password', { exact: true }).fill(users[role].password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/workspace');
    const ui = page.getByRole('region', { name: 'Submissions and packet review' });
    await ui.getByText(role === 'districtCoordinator' ? 'Locked packet status loaded. Learner records are restricted to the school.' : 'School workflow loaded.', { exact: true }).waitFor();
    pages.push({ page, context, errors, role });
    return { page, ui };
  }
  const handoverCoordinator = await login('smeaCoordinator');
  for (const target of [users.smeaCoordinator.id, users.teacher.id]) {
    await handoverCoordinator.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
    if (!await handoverCoordinator.ui.getByLabel('New assigned account').isVisible()) await handoverCoordinator.ui.getByText('Hand over an unsubmitted assignment', { exact: true }).click();
    await handoverCoordinator.ui.getByLabel('New assigned account').selectOption(target);
    await handoverCoordinator.ui.getByLabel('Handover reason').fill('Synthetic browser recorded handover');
    await handoverCoordinator.ui.getByRole('button', { name: 'Record assignment handover' }).click();
    await handoverCoordinator.ui.getByText('Action recorded with its history.', { exact: true }).waitFor();
  }
  const teacher = await login('teacher');
  await teacher.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  const uploadSlot = await admin.from('tanaw_submission_slots').select('id').eq('cycle_id', cycle).eq('author_id', users.teacher.id).single();
  assert.equal(uploadSlot.error, null);
  const uploadSubmission = await admin.from('tanaw_submissions').select('id,current_version').eq('slot_id', uploadSlot.data.id).single();
  assert.equal(uploadSubmission.error, null);
  const uploadUrl = origin + '/api/ecr/preview?submission=' + uploadSubmission.data.id + '&term=TERM%201';
  const uploadOptions = { headers: { origin, 'content-type': 'application/octet-stream' }, data: 'PRIVATE_SYNTHETIC_UNREGISTERED_WORKBOOK' };
  const anonymousUpload = await fetch(uploadUrl, { method: 'POST', headers: uploadOptions.headers, body: uploadOptions.data });
  assert.equal(anonymousUpload.status, 401);
  const ownUpload = await teacher.page.context().request.post(uploadUrl, uploadOptions);
  assert.equal(ownUpload.status(), 422, 'Authorized file reaches actual registered-source Python gate');
  assert.equal(ownUpload.headers()['cache-control'], 'no-store, private');
  const ownSummary = await ownUpload.json();
  assert.equal(ownSummary.code, 'workbook-rejected'); assert.equal(ownSummary.canImport, false);
  assert.doesNotMatch(JSON.stringify(ownSummary), /PRIVATE_SYNTHETIC/);
  const foreignUpload = await teacher.page.context().request.post(origin + '/api/ecr/preview?submission=' + randomUUID() + '&term=TERM%201', uploadOptions);
  assert.equal(foreignUpload.status(), 403);
  const coordinatorUpload = await handoverCoordinator.page.context().request.post(uploadUrl, uploadOptions);
  assert.equal(coordinatorUpload.status(), 403, 'School-wide read permission does not bypass upload ownership');
  const unchangedUpload = await admin.from('tanaw_submissions').select('current_version').eq('id', uploadSubmission.data.id).single();
  assert.equal(unchangedUpload.error, null);
  assert.equal(unchangedUpload.data.current_version, uploadSubmission.data.current_version, 'File checks never create a submission version');
  assert.deepEqual(await (await teacher.page.context().request.get(origin + '/api/ecr/preview')).json(), { available: true });
  await teacher.ui.getByText('Check a class-record file', { exact: true }).click();
  let fileForm = teacher.ui.getByRole('form', { name: 'Class-record file check' });
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click();
  await fileForm.getByText('Choose a workbook to check.', { exact: true }).waitFor();
  assert.equal(await fileForm.getByLabel('Class-record workbook').getAttribute('aria-invalid'), 'true');
  assert.equal(await fileForm.getByLabel('Class-record workbook').evaluate(element => element === document.activeElement), true);
  const workbookFixture = { name: 'synthetic-unregistered.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PRIVATE_SYNTHETIC_WORKBOOK_PAYLOAD') };
  await fileForm.getByLabel('Class-record workbook').setInputFiles(workbookFixture);
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click();
  await fileForm.getByText('Choose the term shown in this workbook.', { exact: true }).waitFor();
  await fileForm.getByLabel('Workbook term').selectOption('TERM 1');
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click();
  await fileForm.getByText('This workbook could not pass the file check. Verify its approved template and try again.', { exact: true }).waitFor();
  assert.equal(await fileForm.getByLabel('Class-record workbook').evaluate(element => element.files[0].name), workbookFixture.name);
  assert.doesNotMatch(await fileForm.innerText(), /PRIVATE_SYNTHETIC_WORKBOOK_PAYLOAD/);

  // Explicit UI response fixtures only: these do not verify a registered original.
  let responseMode = 'recognized', posts = 0, releaseHeld, signalHeld;
  const recognizedFixture = { code: 'recognized-diagnostic-only', canImport: false, runtimeImportEnabled: false,
    computationComparison: 'not-performed', term: 'TERM 1', sourceHash: 'a'.repeat(64), rowSlots: 100, occupiedRows: 1, excludedBlankRows: 99 };
  await teacher.page.route('**/api/ecr/preview?*', async route => {
    posts++;
    if (responseMode === 'hold') { signalHeld(); await new Promise(resolve => { releaseHeld = resolve; }); }
    const body = responseMode === 'malformed' ? { ...recognizedFixture, canImport: true, private: 'PRIVATE_RESPONSE_MARKER' } : recognizedFixture;
    try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); } catch { /* canceled test request */ }
  });
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click();
  await fileForm.getByRole('region', { name: 'File-check result' }).getByText('Format recognized · TERM 1', { exact: true }).waitFor();
  await fileForm.getByText('Grades were not calculated or submitted.', { exact: false }).waitFor();
  await fileForm.getByText('File reference', { exact: true }).click();
  for (const colorScheme of ['light', 'dark']) {
    await teacher.page.emulateMedia({ colorScheme });
    for (const width of [320, 390, 1440]) {
      await teacher.page.setViewportSize({ width, height: 1000 });
      assert.equal(await teacher.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'File-check result must fit narrow themes');
    }
  }
  const beforeOffline = posts;
  await teacher.page.context().setOffline(true);
  await fileForm.getByText('You are offline. File checks need a connection.', { exact: true }).waitFor();
  assert.equal(await fileForm.getByRole('button', { name: 'Check file format', exact: true }).isDisabled(), true);
  assert.equal(await fileForm.getByLabel('Class-record workbook').evaluate(element => element.files.length), 1);
  await teacher.page.context().setOffline(false);
  await teacher.page.waitForFunction(() => !document.querySelector('form[aria-label="Class-record file check"] fieldset').disabled);
  await fileForm.getByText('Connection restored. Review the selection before checking.', { exact: true }).waitFor();
  assert.equal(posts, beforeOffline, 'Reconnect never sends a workbook automatically');
  const heldStarted = new Promise(resolve => { signalHeld = resolve; }); responseMode = 'hold';
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click(); await heldStarted;
  await fileForm.getByRole('button', { name: 'Cancel file check', exact: true }).click();
  releaseHeld();
  await fileForm.getByText('File check canceled. Your file remains selected; no records were submitted.', { exact: true }).waitFor();
  await teacher.page.waitForFunction(() => document.activeElement?.textContent === 'Check file format');
  assert.equal(await fileForm.getByRole('region', { name: 'File-check result' }).count(), 0, 'Canceled stale response stays hidden');
  responseMode = 'malformed';
  await fileForm.getByRole('button', { name: 'Check file format', exact: true }).click();
  await fileForm.getByText('The file check could not finish. Keep your file selected and try again. No records were submitted.', { exact: true }).waitFor();
  assert.doesNotMatch(await fileForm.innerText(), /PRIVATE_RESPONSE_MARKER/);
  await teacher.page.unroute('**/api/ecr/preview?*');
  await fileForm.getByRole('button', { name: 'Clear selected file', exact: true }).focus();
  await teacher.page.keyboard.press('Enter');
  assert.equal(await fileForm.getByLabel('Class-record workbook').evaluate(element => element.files.length), 0);
  assert.equal(await fileForm.getByLabel('Workbook term').inputValue(), '');
  await teacher.page.waitForFunction(() => document.activeElement?.getAttribute('type') === 'file');
  await teacher.page.route('**/api/ecr/preview', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) }));
  await teacher.ui.getByLabel('Assigned submission').selectOption(''); await teacher.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  await teacher.ui.getByText('Check a class-record file', { exact: true }).click();
  fileForm = teacher.ui.getByRole('form', { name: 'Class-record file check' });
  await fileForm.getByText('File checks are not enabled on this server. Manual evidence entry remains available.', { exact: true }).waitFor();
  assert.equal(await fileForm.getByLabel('Class-record workbook').isDisabled(), true);
  await teacher.page.unroute('**/api/ecr/preview');
  await fileForm.getByRole('button', { name: 'Retry file-check availability', exact: true }).click();
  await teacher.page.waitForFunction(() => !document.querySelector('form[aria-label="Class-record file check"] fieldset').disabled);
  await fileForm.getByLabel('Class-record workbook').setInputFiles(workbookFixture);
  await teacher.ui.getByLabel('Assigned submission').selectOption(''); await teacher.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  await teacher.ui.getByText('Check a class-record file', { exact: true }).click();
  fileForm = teacher.ui.getByRole('form', { name: 'Class-record file check' });
  assert.equal(await fileForm.getByLabel('Class-record workbook').evaluate(element => element.files.length), 0, 'File selection never restores into another mounted assignment');
  assert.equal(await fileForm.getByRole('region', { name: 'File-check result' }).count(), 0);
  const unchangedAfterFileUi = await admin.from('tanaw_submissions').select('current_version').eq('id', uploadSubmission.data.id).single();
  assert.equal(unchangedAfterFileUi.error, null);
  assert.equal(unchangedAfterFileUi.data.current_version, uploadSubmission.data.current_version, 'File-check UI never submits evidence');
  await teacher.ui.getByLabel('Verified indicator').selectOption(definition);
  await teacher.ui.getByLabel('Recorded value').fill('0');
  await teacher.ui.getByLabel('Evidence title').fill('Synthetic recorded zero');
  await teacher.ui.getByLabel('Evidence location or reference').fill('https://fixture.invalid/evidence');
  await teacher.ui.getByLabel('Reason for submission or correction').fill('Synthetic browser acceptance test');
  // Whitespace input gets a field-linked error without losing numeric zero.
  await teacher.ui.getByLabel('Evidence title').fill(' ');
  await teacher.ui.getByRole('button', { name: 'Submit a new evidence version' }).click();
  await teacher.ui.locator('#manual-sourceTitle-error').waitFor();
  assert.equal(await teacher.ui.getByLabel('Recorded value').inputValue(), '0');
  await teacher.ui.getByLabel('Evidence title').fill('Synthetic recorded zero');
  await teacher.page.context().setOffline(true);
  await teacher.ui.getByLabel('Evidence title').fill('Synthetic offline recorded zero');
  await teacher.ui.getByRole('button', { name: 'Submit a new evidence version' }).click();
  await teacher.ui.getByText('Offline draft saved. Submit after reconnecting and refreshing access.', { exact: true }).waitFor();
  await teacher.ui.getByRole('button', { name: 'Refresh workflow' }).click();
  await teacher.ui.getByText('Workflow refresh failed. Previously loaded information may be out of date; actions are paused. Retry refresh.', { exact: true }).waitFor();
  assert.equal(await teacher.ui.getByLabel('Recorded value').isEnabled(), true, 'Offline refresh must retain local editing');
  await teacher.ui.getByLabel('Evidence title').fill('Synthetic offline recorded zero');
  assert.equal(await teacher.ui.getByRole('button', { name: 'Submit a new evidence version' }).isDisabled(), true);
  const deviceDraft = await teacher.page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tanaw:manual-draft:')).map((key) => JSON.parse(localStorage.getItem(key))));
  assert.equal(deviceDraft.length, 1); assert.equal(deviceDraft[0].fields.value, '0');
  assert.equal(deviceDraft[0].scope.actorId, users.teacher.id); assert.equal(deviceDraft[0].sourceVersion, 0);
  await teacher.page.context().setOffline(false);
  await teacher.page.reload();
  await teacher.ui.getByText('School workflow loaded.', { exact: true }).waitFor();
  await teacher.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  await teacher.ui.getByText('Device draft restored. Review it before submitting.', { exact: true }).waitFor();
  assert.equal(await teacher.ui.getByLabel('Recorded value').inputValue(), '0');
  // Commit the real RPC; sustain the refresh fault through SDK GET retries.
  let failRefresh = false;
  await teacher.page.route('**/rest/v1/rpc/tanaw_submit_evidence', async (route) => {
    const response = await route.fetch();
    assert.equal(response.ok(), true);
    failRefresh = true;
    await route.fulfill({ response });
  });
  await teacher.page.route('**/rest/v1/tanaw_reporting_cycles?*', (route) => {
    if (failRefresh) return route.abort('failed');
    return route.continue();
  });
  await teacher.ui.getByRole('button', { name: 'Submit a new evidence version' }).click();
  await teacher.ui.getByText('Action recorded, but the view could not be refreshed. Retry refresh before taking another action.', { exact: true }).waitFor();
  assert.equal(await teacher.page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tanaw:manual-draft:')).length), 0, 'Accepted write clears working draft even if presentation refresh fails');
  await teacher.page.unroute('**/rest/v1/rpc/tanaw_submit_evidence');
  await teacher.page.unroute('**/rest/v1/tanaw_reporting_cycles?*');
  await teacher.ui.getByRole('button', { name: 'Refresh workflow' }).click();
  await teacher.ui.getByText('Current recorded evidence', { exact: true }).waitFor();
  await teacher.ui.getByText('Synthetic manual indicator: 0', { exact: false }).first().waitFor();
  assert.equal(await teacher.page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tanaw:manual-draft:')).length), 0, 'Only a successful submission clears the device draft');
  await teacher.page.getByRole('complementary', { name: 'Deadline reminders' }).getByText('0 missing submission(s)', { exact: false }).waitFor();
  await teacher.page.screenshot({ path: output + '/teacher-submitted.png', fullPage: true });
  const subject = await login('subjectCoordinator');
  await subject.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  await subject.ui.getByRole('button', { name: 'Record subject review of this version' }).waitFor({ state: 'visible' });
  await subject.ui.getByRole('button', { name: 'Record subject review of this version' }).click();
  await subject.ui.getByText('Action recorded with its history.', { exact: true }).waitFor();
  const coordinator = await login('smeaCoordinator');
  await coordinator.ui.getByLabel('Assigned submission').selectOption({ index: 1 });
  await coordinator.ui.getByText('Record a pending roster source', { exact: true }).click();
  const roster = coordinator.ui.getByRole('form', { name: 'Pending roster-source declaration' });
  await coordinator.ui.getByText('Pending source history loaded. Declarations are not approved rosters or active mappings.', { exact: true }).waitFor();
  assert.equal(await teacher.ui.getByRole('form', { name: 'Pending roster-source declaration' }).count(), 0, 'Teacher has no coordinator declaration control');
  const historyRequests = [];
  coordinator.page.on('request', (request) => { if (request.url().includes('/rest/v1/tanaw_roster_declarations?')) historyRequests.push(new URL(request.url()).searchParams.get('select')); });
  async function fillRoster(revision) {
    await roster.getByLabel('Roster source title', { exact: true }).fill('Synthetic pending roster');
    await roster.getByLabel('Roster source location or reference').fill('fixture:pending-roster');
    await roster.getByLabel('Roster source revision', { exact: true }).fill(revision);
    await roster.getByLabel('Explicit class reference').fill('Synthetic class A');
    assert.equal(await roster.getByLabel('Assigned reporting year').inputValue(), 'Fixture');
    await roster.getByLabel('Roster source term').selectOption('TERM 1');
    await roster.getByLabel('Roster source file (local reference only)').setInputFiles({ name: 'synthetic-roster.csv', mimeType: 'text/csv', buffer: Buffer.from('PRIVATE_SOURCE_FILE_BYTES') });
    await coordinator.ui.getByText('Source-file reference calculated locally. Its provenance and learner keys still require verification.', { exact: true }).waitFor();
    await roster.getByLabel('Explicit learner keys').fill('synthetic-roster-key-a\nsynthetic-roster-key-b');
  }
  await fillRoster('r1');
  for (const width of [320, 390, 1440]) {
    await coordinator.page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ['light', 'dark']) {
      await coordinator.page.emulateMedia({ colorScheme });
      assert.ok(await coordinator.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Roster form fits narrow and wide viewports');
    }
  }
  const pendingRequests = [];
  await coordinator.page.route('**/rest/v1/rpc/tanaw_declare_roster_source', async (route) => {
    const body = route.request().postDataJSON(); pendingRequests.push(body);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_SOURCE_FILE_BYTES|synthetic-roster.csv/);
    const response = await route.fetch(); assert.equal(response.ok(), true);
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ code: 'SYNTHETIC_LOST_RECEIPT', message: 'Synthetic unavailable receipt' }) });
  });
  await roster.getByRole('button', { name: 'Record pending source declaration', exact: true }).click();
  await coordinator.ui.getByText('The outcome is unconfirmed. Keep this page open and retry the same pending declaration. No new request will be created.', { exact: true }).waitFor();
  assert.equal(await roster.getByLabel('Explicit learner keys').isDisabled(), true, 'Unconfirmed request snapshot cannot be changed');
  await coordinator.page.unroute('**/rest/v1/rpc/tanaw_declare_roster_source');
  await coordinator.page.route('**/rest/v1/rpc/tanaw_declare_roster_source', async (route) => {
    assert.deepEqual(route.request().postDataJSON(), pendingRequests[0], 'Retry retains request ID, source and expected revision');
    await route.continue();
  });
  await roster.getByRole('button', { name: 'Retry the same pending declaration', exact: true }).click();
  await coordinator.ui.getByText('Pending source declaration recorded. It is not an approved roster. Learner-key fields were cleared from this form.', { exact: true }).waitFor();
  await coordinator.page.unroute('**/rest/v1/rpc/tanaw_declare_roster_source');
  const recorded = await admin.from('tanaw_roster_declarations').select('revision,state').eq('slot_id', uploadSlot.data.id);
  assert.equal(recorded.error, null); assert.deepEqual(recorded.data, [{ revision: 1, state: 'pending' }], 'Lost receipt plus retry records exactly one pending revision');
  assert.equal(await roster.getByLabel('Explicit learner keys').inputValue(), '');
  assert.ok(await coordinator.page.evaluate(() => document.activeElement?.getAttribute('role') === 'status'), 'Receipt receives keyboard focus');
  await fillRoster('r2');
  const otherCoordinator = createClient(url, publicKey, { auth: { persistSession: false } });
  assert.equal((await otherCoordinator.auth.signInWithPassword(users.smeaCoordinator)).error, null);
  const concurrent = await otherCoordinator.rpc('tanaw_declare_roster_source', { target_submission: uploadSubmission.data.id, expected_revision: 1, request_id: randomUUID(), source: { ...pendingRequests[0].source, sourceRevision: 'concurrent-r2' } });
  assert.equal(concurrent.error, null);
  await roster.getByRole('button', { name: 'Record pending source declaration', exact: true }).click();
  await coordinator.ui.getByText('The roster source revision changed. Refresh history and review it before recording a new declaration.', { exact: true }).waitFor();
  assert.equal(await roster.getByLabel('Roster source revision', { exact: true }).inputValue(), 'r2', 'Conflict retains private draft');
  await coordinator.ui.getByRole('button', { name: 'Refresh roster-source history', exact: true }).click();
  await coordinator.ui.getByText('Latest loaded revision: 2. 2 revision(s) loaded. All are pending.', { exact: true }).waitFor();
  let failRosterHistory = false;
  await coordinator.page.route('**/rest/v1/tanaw_roster_declarations?*', (route) => failRosterHistory ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"SYNTHETIC_READ_FAILURE","message":"Synthetic unavailable history"}' }) : route.continue());
  await coordinator.page.route('**/rest/v1/rpc/tanaw_declare_roster_source', async (route) => {
    const response = await route.fetch(); assert.equal(response.ok(), true); failRosterHistory = true; await route.fulfill({ response });
  });
  await roster.getByRole('button', { name: 'Record pending source declaration', exact: true }).click();
  await coordinator.ui.getByText('Pending source declaration recorded, but history refresh failed. Refresh history before recording another declaration. Learner-key fields were cleared from this form.', { exact: true }).waitFor();
  assert.equal(await roster.getByLabel('Explicit learner keys').inputValue(), '', 'Confirmed write clears private fields even when history fails');
  assert.equal(await roster.getByRole('button', { name: 'Record pending source declaration', exact: true }).isDisabled(), true);
  await coordinator.page.unroute('**/rest/v1/tanaw_roster_declarations?*');
  await coordinator.page.unroute('**/rest/v1/rpc/tanaw_declare_roster_source');
  await coordinator.ui.getByRole('button', { name: 'Refresh roster-source history', exact: true }).click();
  await coordinator.ui.getByText('Latest loaded revision: 3. 3 revision(s) loaded. All are pending.', { exact: true }).waitFor();
  assert.ok(historyRequests.length >= 3); assert.ok(historyRequests.every((selection) => selection === 'id,revision,state,created_at,created_by'), 'History never fetches learner-key payloads');
  assert.doesNotMatch(await coordinator.ui.innerText(), /synthetic-roster-key-a/);
  const unchangedEvidence = await admin.from('tanaw_submissions').select('current_version').eq('id', uploadSubmission.data.id).single();
  assert.equal(unchangedEvidence.data.current_version, 1, 'Roster declarations do not create evidence versions');

  await coordinator.ui.getByRole('button', { name: 'Prepare a new school packet version' }).click();
  await coordinator.ui.getByText('Latest school packet · Version 1', { exact: true }).waitFor();
  await coordinator.ui.getByRole('button', { name: 'Record school review', exact: true }).click();
  await coordinator.ui.getByText('Action recorded with its history.', { exact: true }).waitFor();
  const head = await login('schoolHead');
  await head.ui.getByRole('button', { name: 'Record School Head review' }).click();
  await head.ui.getByText('Action recorded with its history.', { exact: true }).waitFor();
  await head.ui.getByText('School packet history', { exact: true }).click();
  await head.ui.getByRole('button', { name: 'Load packet history', exact: true }).click();
  await head.ui.getByLabel('Historical packet', { exact: false }).selectOption({ index: 1 });
  await head.ui.getByText('Exact historical evidence loaded. Inspection does not change or approve this packet.', { exact: true }).waitFor();
  await coordinator.ui.getByRole('button', { name: 'Refresh workflow' }).click();
  await coordinator.ui.getByRole('button', { name: 'Lock this school packet' }).click();
  await coordinator.ui.getByText('Locked · complete', { exact: true }).waitFor();
  await coordinator.page.screenshot({ path: output + '/coordinator-locked.png', fullPage: true });
  const district = await login('districtCoordinator');
  assert.equal((await district.page.context().request.post(uploadUrl, uploadOptions)).status(), 403, 'District cannot use school raw-file checks');
  await district.ui.getByLabel('Decision', { exact: true }).selectOption('return');
  await district.ui.getByLabel('Review comments').fill('Synthetic governed result projection pending');
  await district.ui.getByRole('button', { name: 'Record district decision' }).click();
  await district.ui.getByText('Action recorded with its history.', { exact: true }).waitFor();
  await district.page.screenshot({ path: output + '/district-aggregate.png', fullPage: true });
  const districtClient = createClient(url, publicKey, { auth: { persistSession: false } });
  assert.equal((await districtClient.auth.signInWithPassword(users.districtCoordinator)).error, null);
  const raw = await districtClient.from('tanaw_submission_versions').select('submission_id');
  assert.equal(raw.error, null); assert.deepEqual(raw.data, [], 'District must have no learner/source version access');
  await coordinator.page.getByRole('navigation', { name: 'Workspace tasks' }).getByRole('button', { name: 'School access', exact: true }).click();
  const access = coordinator.page.getByRole('region', { name: 'Manage school access' });
  await access.getByLabel('Assigned account').selectOption(users.teacher.id);
  await access.getByLabel('Access enabled').uncheck();
  await access.getByLabel('Reason for access change').fill('Synthetic browser account disable');
  await coordinator.page.getByRole('navigation', { name: 'Workspace tasks' }).getByRole('button', { name: 'Submissions and review', exact: true }).click();
  await coordinator.page.getByRole('navigation', { name: 'Workspace tasks' }).getByRole('button', { name: 'School access', exact: true }).click();
  assert.equal(await access.getByLabel('Reason for access change').inputValue(), 'Synthetic browser account disable');
  await access.getByRole('button', { name: 'Save account access' }).click();
  await access.getByText('Access updated. Authorship and submitted records remain preserved.', { exact: true }).waitFor();
  await teacher.page.getByRole('button', { name: 'Refresh access', exact: true }).click();
  await teacher.page.getByText('Your account has no active school assignment. Contact the SMEA Coordinator.', { exact: true }).waitFor();
  assert.equal((await teacher.page.context().request.post(uploadUrl, uploadOptions)).status(), 403, 'Disabled membership cannot run a file check');
  const denied = createClient(url, publicKey, { auth: { persistSession: false } });
  assert.equal((await denied.auth.signInWithPassword(users.teacher)).error, null);
  const disabledRecords = await denied.from('tanaw_submission_versions').select('submission_id');
  assert.equal(disabledRecords.error, null); assert.deepEqual(disabledRecords.data, [], 'Disabled account must lose source access');
  await coordinator.page.screenshot({ path: output + '/coordinator-access-managed.png', fullPage: true });
  // Local Mailpit captures the recovery email; no actual recipient is contacted.
  const recoveryContext = await browser.newContext();
  const recoveryPage = await recoveryContext.newPage();
  await recoveryPage.route('**/*', (route) => { const target = new URL(route.request().url()); return [origin, url].includes(target.origin) || target.protocol === 'data:' ? route.continue() : route.abort(); });
  await recoveryPage.goto(origin + '/forgot-password');
  await recoveryPage.getByLabel('Account email').fill(users.teacher.email);
  await recoveryPage.getByRole('button', { name: 'Send recovery link' }).click();
  await recoveryPage.getByText('If this address has an account, a recovery link will arrive. Open it in this browser to continue.', { exact: true }).waitFor();
  let captured;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch('http://127.0.0.1:55324/api/v1/messages');
    assert.equal(response.ok, true, 'Isolated Mailpit must be reachable');
    const mailbox = await response.json();
    captured = mailbox.messages?.find((message) => message.To?.some((address) => address.Address === users.teacher.email));
    if (captured) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(captured, 'Synthetic recovery email must be captured locally');
  const mailResponse = await fetch('http://127.0.0.1:55324/api/v1/message/' + encodeURIComponent(captured.ID));
  assert.equal(mailResponse.ok, true, 'Synthetic recovery message must be readable');
  const mail = await mailResponse.json();
  const links = [...String(mail.HTML ?? '').matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1].replaceAll('&amp;', '&'));
  const recoveryLink = links.find((link) => { try { const target = new URL(link); return target.origin === url && target.pathname === '/auth/v1/verify' && target.searchParams.get('type') === 'recovery'; } catch { return false; } });
  assert.ok(recoveryLink, 'Recovery email must contain only the expected local Auth verification link');
  try { await recoveryPage.goto(recoveryLink); await recoveryPage.waitForURL('**/reset-password'); } catch { throw new Error('Synthetic PKCE recovery link did not reach the password page'); }
  await recoveryPage.getByText('Recovery session verified. Choose your new password.', { exact: true }).waitFor();
  const changedPassword = randomUUID() + randomUUID();
  await recoveryPage.getByLabel('New password', { exact: true }).fill(changedPassword);
  await recoveryPage.getByLabel('Confirm new password').fill(changedPassword);
  await recoveryPage.getByRole('button', { name: 'Save new password' }).click();
  await recoveryPage.getByText('Password changed. Your school access and assignments are unchanged.', { exact: true }).waitFor();
  users.teacher.password = changedPassword;
  const recovered = createClient(url, publicKey, { auth: { persistSession: false } });
  assert.equal((await recovered.auth.signInWithPassword(users.teacher)).error, null, 'Recovered password must authenticate');
  assert.deepEqual((await recovered.from('tanaw_memberships').select('school_id')).data, [], 'Recovery must not restore disabled school access');
  await recoveryPage.screenshot({ path: output + '/password-recovered.png', fullPage: true });
  await recoveryContext.close();
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(origin + '/reset-password');
  await anonymousPage.getByText('Open a valid recovery link from your email to continue.', { exact: true }).waitFor();
  assert.equal(await anonymousPage.getByLabel('New password', { exact: true }).isDisabled(), true);
  await anonymousContext.close();
  // All role surfaces must fit narrow Android widths and both supported themes.
  for (const entry of pages) {
    for (const colorScheme of ['light', 'dark']) {
      await entry.page.emulateMedia({ colorScheme });
      for (const width of [320, 390, 1440]) {
        await entry.page.setViewportSize({ width, height: 900 });
        assert.equal(await entry.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, entry.role + ' layout overflow at ' + width);
      }
    }
  }
  for (const entry of pages) { assert.deepEqual(entry.errors, [], entry.role + ' must have no uncaught browser errors'); assert.equal(await entry.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); await entry.context.close(); }
  console.log('Authenticated synthetic browser acceptance passed: teacher zero submission, subject review, school review, independent Head review, explicit Lock, district return/reconciliation and raw-data denial; offline refresh retention, field validation and narrow light/dark layouts.');
} catch (error) {
  for (const entry of pages) { try { await entry.page.screenshot({ path: output + '/failure-' + entry.role + '.png', fullPage: true }); } catch {} }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
}
