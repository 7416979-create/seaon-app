// Checks the monthly summary rules in src/lib/summary.ts (6차 M4).
// Run: npm run check:summary   (no new packages: uses the esbuild already installed with Vite)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'node_modules', '.check-summary');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const esbuild = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
execFileSync(process.execPath, [esbuild, 'src/lib/summary.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${path.join(outDir, 'summary.mjs')}`], { cwd: root, stdio: 'pipe' });
const { monthlySummary, workingDays } = await import(pathToFileURL(path.join(outDir, 'summary.mjs')).href);

const emp = (id, joinDate = '2025-01-01', active = true) => ({ id, empNo: id, name: id, email: '', dept: '', position: '', joinDate, active, annualLeave: 15, linkToken: '', phone: '' });
const rec = (empId, date, checkIn, checkOut) => ({ empId, date, checkIn, checkOut });
const leave = (empId, type, date, endDate) => ({ id: `${empId}-${date}`, empId, empName: empId, type, date, endDate, reason: '', status: '승인', createdAt: '' });
const run = (o) => monthlySummary({ workStart: '09:00', today: new Date(2026, 9, 9), holidays: [], employees: [emp('a')], empId: '', rows: [], approved: [], ...o });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['✅', name]); } catch (e) { results.push(['❌', `${name}: ${e.message}`]); } };

check('1. 2026-10-01~10-09, no holidays → 근무일수 7', () => {
  assert.equal(run({ from: '2026-10-01', to: '2026-10-09' }).get('a').workDays, 7);
});
check('2. same, holiday 2026-10-05 → 6', () => {
  assert.equal(run({ from: '2026-10-01', to: '2026-10-09', holidays: [{ date: '2026-10-05', name: 'x' }] }).get('a').workDays, 6);
});
check('3. 2026-09-01~09-30 → 22', () => {
  assert.equal(run({ from: '2026-09-01', to: '2026-09-30', today: new Date(2026, 9, 9) }).get('a').workDays, 22);
});
check('4. joined 2026-10-06, 10-01~10-09 → 4', () => {
  const m = run({ from: '2026-10-01', to: '2026-10-09', employees: [emp('a', '2026-10-06')] });
  assert.equal(m.get('a').workDays, 4);
});
check('5. approved 연차 10-02 → 휴가 1; approved 오전반차 10-07 → 휴가 +0.5', () => {
  const m = run({ from: '2026-10-01', to: '2026-10-09', approved: [leave('a', '연차', '2026-10-02'), leave('a', '오전반차', '2026-10-07')] });
  assert.equal(m.get('a').leave, 1.5);
});
check('6. Saturday record is not counted in 출근일수 or 지각', () => {
  const m = run({ from: '2026-10-01', to: '2026-10-09', rows: [rec('a', '2026-10-03', '2026-10-03T08:00:00', '2026-10-03T18:00:00'), rec('a', '2026-10-06', '2026-10-06T10:00:00', '2026-10-06T18:00:00')] });
  assert.equal(m.get('a').days, 1);
  assert.equal(m.get('a').late, 1);
});
check('7. employee with no records is in the result', () => {
  const m = run({ from: '2026-10-01', to: '2026-10-09', employees: [emp('a'), emp('b')] });
  assert.ok(m.has('b'));
  assert.equal(m.get('b').absent, 7);
});
check('extra: future days are not counted (to = 2026-10-31, today 10-09 → 7)', () => {
  assert.equal(run({ from: '2026-10-01', to: '2026-10-31' }).get('a').workDays, 7);
});
check('extra: inactive employee is skipped when no rows', () => {
  assert.equal(run({ from: '2026-10-01', to: '2026-10-09', employees: [emp('a', '2025-01-01', false)] }).size, 0);
});

for (const [mark, text] of results) console.log(mark, text);
const failed = results.filter(([m]) => m !== '✅').length;
console.log(failed ? `FAILED ${failed}` : `ALL ${results.length} PASSED`);
process.exitCode = failed ? 1 : 0;
