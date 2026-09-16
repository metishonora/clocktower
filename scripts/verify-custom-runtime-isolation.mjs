import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repository = fileURLToPath(new URL('../', import.meta.url));
const isolated = mkdtempSync(resolve(tmpdir(), 'clocktower-custom-isolation-'));
const copy = relative => { const destination = resolve(isolated, relative); mkdirSync(dirname(destination), { recursive: true }); cpSync(resolve(repository, relative), destination, { recursive: true }); };
const run = (command, args, cwd = isolated) => {
  console.log(`Isolation: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, CARGO_TARGET_DIR: resolve(isolated, 'target'), pnpm_config_verify_deps_before_run: 'false' }, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) { process.stderr.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); throw result.error ?? new Error(`Isolation command exited ${result.status}`); }
};
try {
  if (process.argv.includes('--official')) {
    verifyOfficialOnly();
  } else {
  for (const path of ['crates/custom-domain', 'crates/custom-wasm', 'Cargo.lock', 'web/src/custom', 'web/test/custom', 'web/src/vite-env.d.ts', 'web/tsconfig.custom.json', 'web/tsconfig.custom-test.json', 'web/vitest.custom.config.ts', 'web/vitest.custom-fixtures.config.ts', 'fixtures/acceptance/custom-first-night']) copy(path);
  copy('web/src/assets/prototypes/issue-200/continuous-manuscript-dolly-master-v6.png');
  copy('web/src/assets/fonts/NanumPenScript-Regular.ttf');
  writeFileSync(resolve(isolated, 'Cargo.toml'), '[workspace]\nmembers = ["crates/custom-domain", "crates/custom-wasm"]\nresolver = "2"\n');
  writeFileSync(resolve(isolated, 'package.json'), '{"private":true,"type":"module"}\n');
  writeFileSync(resolve(isolated, 'web/package.json'), '{"private":true,"type":"module"}\n');
  symlinkSync(realpathSync(resolve(repository, 'web/node_modules')), resolve(isolated, 'web/node_modules'));
  for (const forbidden of ['crates/domain', 'crates/wasm', 'web/src/core', 'web/src/generated/clocktower_wasm']) assert.equal(existsSync(resolve(isolated, forbidden)), false, forbidden);
  run('cargo', ['test', '--offline', '-p', 'clocktower-custom-domain', '-p', 'clocktower-custom-wasm']);
  run('cargo', ['test', '--offline', '-p', 'clocktower-custom-domain', '--features', 'custom-runtime-fixtures']);
  run('wasm-pack', ['build', 'crates/custom-wasm', '--target', 'web', '--out-dir', '../../web/src/generated/clocktower_custom_wasm']);
  run('wasm-pack', ['build', 'crates/custom-wasm', '--target', 'web', '--out-dir', '../../web/.codex-tmp/custom-fixture-wasm', '--', '--features', 'custom-runtime-fixtures']);
  const web = resolve(isolated, 'web');
  run(process.execPath, [resolve(web, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.custom-test.json'], web);
  run(process.execPath, [resolve(web, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.custom.config.ts'], web);
  run(process.execPath, [resolve(web, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.custom-fixtures.config.ts'], web);
  console.log('Custom Rust, WASM, catalog, Setup, first night, replay, and IndexedDB/session tests passed with all official source and artifacts absent.');
  }
} finally {
  // Only this invocation's freshly allocated workspace is removed, never repository sources.
  rmSync(isolated, { recursive: true, force: true });
}


function verifyOfficialOnly() {
  const ts = createRequire(resolve(repository, 'web/package.json'))('typescript');
  const sourceEntry = resolve(repository, 'web/.codex-tmp/official-isolation-entry.ts');
  const entry = `
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {IDBFactory} from "fake-indexeddb";
import * as wasm from "../src/generated/clocktower_wasm/clocktower_wasm.js";
import {wasmCoreAdapter} from "../src/core/wasmClient.js";
import {IndexedDbGameStorageDriver,parseGameFileJson} from "../src/gameStorage.js";
import {IndexedDbWebSessionStorageDriver} from "../src/webSessionStorage.js";
import {officialGameFileScriptId,gameFileScriptReference,type ScriptId} from "../src/core/scripts.js";
import type {GameFileV4} from "../src/core/types.js";
wasm.initSync({module:readFileSync(fileURLToPath(new URL("../src/generated/clocktower_wasm/clocktower_wasm_bg.wasm",import.meta.url)))});
assert.equal("custom_script_catalog" in wasm,false);
const rosters:Record<ScriptId,string[]>={troubleBrewing:["washerwoman","librarian","investigator","chef","empath","poisoner","imp"],sectsAndViolets:["clockmaker","dreamer","snakeCharmer","mathematician","flowergirl","witch","noDashii"],badMoonRising:["grandmother","sailor","chambermaid","exorcist","innkeeper","assassin","pukka"]};
const idb=new IDBFactory();
for(const scriptId of Object.keys(rosters) as ScriptId[]){
 const game:GameFileV4={schemaVersion:4,game:{script:{type:"official",scriptId},id:scriptId,name:scriptId,createdAt:"2026-09-08T00:00:00.000Z",updatedAt:"2026-09-08T00:00:00.000Z",events:[]}};
 const proposed=await wasmCoreAdapter.propose(game,{type:"createGame",payload:{players:rosters[scriptId].map((actualCharacter,index)=>({id:"p"+(index+1),seat:index+1,name:"Player "+(index+1),actualCharacter}))}});
 assert.equal(proposed.ok,true,JSON.stringify(proposed));if(!proposed.ok)throw Error(JSON.stringify(proposed));game.game.events.push(proposed.value.event);
 const before=await wasmCoreAdapter.replay(game);assert.equal(before.ok,true,JSON.stringify(before));
 const driver=new IndexedDbGameStorageDriver(scriptId,idb);await driver.saveLatestGame(game);const restored=await driver.loadLatestGame();assert.deepEqual(restored,game);assert.deepEqual(await wasmCoreAdapter.replay(restored!),before);
 const session={version:1 as const,scriptId,savedAt:game.game.updatedAt,canonical:game,setupDraft:{players:rosters[scriptId]},presentation:{activeTab:"play"}};
 const storage=new IndexedDbWebSessionStorageDriver(scriptId,idb);await storage.saveSession(session);const resumed=await storage.loadSession();assert.deepEqual(resumed,session);assert.deepEqual(await wasmCoreAdapter.replay(resumed!.canonical),before);
 assert.equal(officialGameFileScriptId(game),scriptId);assert.deepEqual(gameFileScriptReference(game),{type:"official",scriptId});
 const {script,...legacyGame}=game.game;const v3=parseGameFileJson(JSON.stringify({schemaVersion:3,game:{...legacyGame,scriptId}}));assert.deepEqual(await wasmCoreAdapter.replay(v3),before);
 if(scriptId==="troubleBrewing"){const v2=parseGameFileJson(JSON.stringify({schemaVersion:2,game:legacyGame}));assert.deepEqual(await wasmCoreAdapter.replay(v2),before);}
}
console.log("Official TB/SnV/BMR create, storage save/load/resume, legacy parsing and runtime selection passed without custom source or WASM.");
`;
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, skipLibCheck: true, resolveJsonModule: true, types: ['node'], noEmit: true };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => file === sourceEntry ? ts.createSourceFile(file, entry, languageVersion, true) : originalGetSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([sourceEntry], options, host);
  const rootWeb = resolve(repository, 'web');
  for (const source of program.getSourceFiles()) {
    if (source.fileName === sourceEntry || source.fileName.includes('/node_modules/')) continue;
    if (!source.fileName.startsWith(rootWeb + '/')) throw new Error('Unexpected official source: ' + source.fileName);
    assert.equal(source.fileName.includes('/src/custom/'), false, source.fileName);
    copy(source.fileName.slice(repository.length));
  }
  const isolatedEntry = resolve(isolated, 'web/.codex-tmp/official-isolation-entry.ts');
  mkdirSync(dirname(isolatedEntry), { recursive: true }); writeFileSync(isolatedEntry, entry);
  copy('web/src/generated/clocktower_wasm');
  writeFileSync(resolve(isolated, 'package.json'), '{"type":"module"}');
  writeFileSync(resolve(isolated, 'web/package.json'), '{"type":"module"}');
  symlinkSync(realpathSync(resolve(repository, 'web/node_modules')), resolve(isolated, 'web/node_modules'));
  assert.equal(existsSync(resolve(isolated, 'web/src/custom')), false);
  assert.equal(existsSync(resolve(isolated, 'web/src/generated/clocktower_custom_wasm')), false);
  const web = resolve(isolated, 'web');
  run(process.execPath, [resolve(web, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', '--strict', '--resolveJsonModule', '--rootDir', '.', '--outDir', 'out', '.codex-tmp/official-isolation-entry.ts'], web);
  cpSync(resolve(web, 'src/generated/clocktower_wasm'), resolve(web, 'out/src/generated/clocktower_wasm'), { recursive: true });
  run(process.execPath, [resolve(web, 'out/.codex-tmp/official-isolation-entry.js')], web);
  console.log('Official-only loading and storage isolation passed for TB, SnV and BMR.');
}
