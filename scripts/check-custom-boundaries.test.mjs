import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { inspectTypeScript, inspectCargo, inspectRust } from './check-custom-boundaries.mjs';
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'clocktower-boundary-test-'));
  const file = (name, text) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); return path; };
  try { run(root, file); } finally { rmSync(root, { recursive: true, force: true }); }
}
for (const [name, statement] of [
  ['direct', 'import {value} from "../../core/official.js"; export {value};'],
  ['type-only', 'import type {Value} from "../../core/official.js"; export type Alias = Value;'],
  ['dynamic', 'export const load = () => import("../../core/official.js");'],
  ['re-export', 'export * from "../../core/official.js";'],
  ['import-type', 'export type Alias = import("../../core/official.js").Value;'],
]) test(`rejects ${name} custom-to-official dependency`, () => fixture((root, file) => {
  file('web/src/core/official.ts', 'export const value = 1; export type Value = number;');
  const entry = file('web/src/custom/core/entry.ts', statement);
  assert.ok(inspectTypeScript(root, [{ file: entry, owner: 'custom' }]).some(error => error.includes('crosses boundary')));
}));
test('follows a transitive helper and rejects the reverse official import', () => fixture((root, file) => {
  file('web/src/core/official.ts', 'export const value = 1;');
  file('web/src/custom/core/helper.ts', 'export * from "../../core/official.js";');
  const entry = file('web/src/custom/core/entry.ts', 'export * from "./helper.js";');
  assert.ok(inspectTypeScript(root, [{ file: entry, owner: 'custom' }])[0].includes('helper.ts'));
  const reverse = file('web/src/core/reverse.ts', 'export * from "../custom/core/entry.js";');
  assert.ok(inspectTypeScript(root, [{ file: reverse, owner: 'official' }])[0].includes('crosses boundary'));
}));
test('resolves compiler path mappings and symlinked sources', () => fixture((root, file) => {
  const official = file('web/src/core/official.ts', 'export type Value = number;');
  const entry = file('web/src/custom/core/entry.ts', 'import type {Value} from "owned-alias"; export type Alias = Value;');
  assert.ok(inspectTypeScript(root, [{ file: entry, owner: 'custom' }], { baseUrl: root, paths: { 'owned-alias': ['web/src/core/official.ts'] } }).some(error => error.includes('crosses boundary')));
  const link = join(root, 'web/src/custom/core/linked.ts'); symlinkSync(official, link);
  const linkedEntry = file('web/src/custom/core/linked-entry.ts', 'export * from "./linked.js";');
  assert.ok(inspectTypeScript(root, [{ file: linkedEntry, owner: 'custom' }]).some(error => error.includes('crosses boundary')));
}));
test('permits independently owned modules and detects opaque dynamic imports', () => fixture((root, file) => {
  file('web/src/custom/core/helper.ts', 'export const value = 1;');
  const entry = file('web/src/custom/core/entry.ts', 'export * from "./helper.js";');
  assert.deepEqual(inspectTypeScript(root, [{ file: entry, owner: 'custom' }]), []);
  const opaque = file('web/src/custom/core/opaque.ts', 'export const load = (path:string) => import(path);');
  assert.ok(inspectTypeScript(root, [{ file: opaque, owner: 'custom' }])[0].includes('nonliteral'));
}));
test('rejects direct, transitive, dev, and reverse Cargo dependencies', () => {
  const packages = [
    {name:'clocktower-custom-domain',dependencies:[{name:'helper',kind:'dev'}]},
    {name:'helper',dependencies:[{name:'clocktower-domain'}]},
    {name:'clocktower-domain',dependencies:[]},
  ];
  assert.ok(inspectCargo(packages)[0].includes('helper -> clocktower-domain'));
  assert.ok(inspectCargo([{name:'clocktower-domain',dependencies:[{name:'clocktower-custom-domain'}]}]).length);
  assert.deepEqual(inspectCargo([{name:'clocktower-custom-wasm',dependencies:[{name:'clocktower-custom-domain'}]},{name:'clocktower-custom-domain',dependencies:[]}]),[]);
});
test('rejects Rust include and path-module bypasses without changing real sources', () => fixture((root, file) => {
  file('crates/domain/src/lib.rs', 'pub fn official() {}');
  for (const text of ['include!("../../domain/src/lib.rs");', '#[path = "../../domain/src/lib.rs"] mod hidden;']) {
    const entry = file('crates/custom-domain/src/lib.rs', text);
    assert.ok(inspectRust(root,[entry]).some(error=>error.includes('crosses boundary')));
  }
  const opaque = file('crates/custom-domain/src/lib.rs','include!(concat!(env!("SOURCE"), "/lib.rs"));');
  assert.ok(inspectRust(root,[opaque])[0].includes('nonliteral'));
}));
