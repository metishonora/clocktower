import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const ts = createRequire(resolve(repositoryRoot, 'web/package.json'))('typescript');
const normalize = value => value.split(sep).join('/');
export function filesIn(directory, extension) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path, extension) : extension.test(path) ? [path] : [];
  });
}
function realm(path) {
  if (/^crates\/custom-(?:domain|wasm)\//.test(path) || /^web\/(?:src|test)\/custom\//.test(path)) return 'custom';
  if (/^crates\/(?:domain|wasm)\//.test(path) || /^web\/src\/core\//.test(path) || /^web\/src\/(?:gameStorage|webSessionStorage)\./.test(path)) return 'official';
  return undefined;
}
export function inspectTypeScript(root, roots, options = {}) {
  root = realpathSync(root);
  const failures = [], seen = new Set();
  const compilerOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true, ...options };
  function visit(file, owner, chain) {
    file = resolve(file);
    const key = `${owner}:${file}`;
    if (seen.has(key) || !existsSync(file)) return;
    seen.add(key);
    const logical = normalize(relative(root, realpathSync(file)));
    const actual = normalize(relative(root, realpathSync(file)));
    const targetRealm = realm(actual);
    if (targetRealm && targetRealm !== owner) {
      failures.push(`${owner} import crosses boundary: ${[...chain, logical].join(' -> ')}`);
      return;
    }
    if (actual.includes('/node_modules/') || actual.startsWith('node_modules/')) return;
    const customAsset = /^web\/(?:src\/generated\/clocktower_custom_wasm|\.codex-tmp\/custom-fixture-wasm)\//.test(actual);
    const officialAsset = /^web\/src\/generated\/clocktower_wasm\//.test(actual);
    if ((owner === 'custom' && officialAsset) || (owner === 'official' && customAsset)) {
      failures.push(`${owner} imported the other WASM artifact: ${logical}`); return;
    }
    if (customAsset || officialAsset) return;
    if (/\.(?:json|svg|png|webp|jpg|woff2?|css)$/.test(actual)) return;
    if (owner === 'custom' && !/^web\/(?:src|test)\/custom\//.test(actual)) {
      failures.push(`custom source has unowned code dependency: ${[...chain, logical].join(' -> ')}`);
    }
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = [];
    function walk(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
        else failures.push(`nonliteral runtime import cannot establish ownership: ${logical}`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
    for (const specifier of new Set(imports)) {
      if (specifier.startsWith('node:')) continue;
      const target = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule;
      if (!target) {
        if (specifier.startsWith('.') && !/\.(?:css|svg|png|webp|jpg|woff2?)$/.test(specifier)) failures.push(`unresolved import: ${logical} -> ${specifier}`);
        continue;
      }
      visit(target.resolvedFileName, owner, [...chain, logical]);
    }
  }
  for (const entry of roots) visit(entry.file, entry.owner, []);
  return [...new Set(failures)];
}
export function inspectCargo(packages) {
  const failures = [], byName = new Map(packages.map(p => [p.name, p]));
  for (const start of packages) {
    const owner = start.name.startsWith('clocktower-custom-') ? 'custom' : ['clocktower-domain', 'clocktower-wasm'].includes(start.name) ? 'official' : undefined;
    if (!owner) continue;
    const seen = new Set();
    const visit = (name, chain) => {
      if (seen.has(name)) return;
      seen.add(name);
      const opposite = owner === 'custom' ? ['clocktower-domain', 'clocktower-wasm'].includes(name) : name.startsWith('clocktower-custom-');
      if (opposite) failures.push(`Cargo cross-boundary dependency: ${[...chain, name].join(' -> ')}`);
      for (const dependency of byName.get(name)?.dependencies ?? []) visit(dependency.name, [...chain, name]);
    };
    visit(start.name, []);
  }
  return failures;
}
export function inspectRust(root, files) {
  root = realpathSync(root);
  const failures = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8'), from = normalize(relative(root, realpathSync(file))), owner = realm(from);
    for (const match of source.matchAll(/(?:include(?:_str|_bytes)?!\s*\(\s*|#\[path\s*=\s*)"([^"]+)"/g)) {
      const target = resolve(dirname(file), match[1]);
      if (!existsSync(target)) { failures.push(`missing Rust include: ${from} -> ${match[1]}`); continue; }
      const to = normalize(relative(root, realpathSync(target))), other = realm(to);
      if (owner && other && owner !== other) failures.push(`Rust source include crosses boundary: ${from} -> ${to}`);
      if (owner === 'custom' && to.endsWith('.rs') && !to.startsWith('crates/custom-')) failures.push(`custom Rust includes unowned source: ${from} -> ${to}`);
    }
    if (/include!\s*\(\s*(?!")\S/.test(source)) failures.push(`nonliteral Rust include cannot establish ownership: ${from}`);
  }
  return failures;
}
export function checkBoundaries(root = repositoryRoot) {
  const sourceRoots = [
    ...filesIn(resolve(root, 'web/src/custom'), /\.tsx?$/).map(file => ({ file, owner: 'custom' })),
    ...filesIn(resolve(root, 'web/test/custom'), /\.tsx?$/).map(file => ({ file, owner: 'custom' })),
    ...filesIn(resolve(root, 'web/src/core'), /\.tsx?$/).map(file => ({ file, owner: 'official' })),
    ...['gameStorage.ts', 'webSessionStorage.ts'].filter(name => existsSync(resolve(root, 'web/src', name))).map(name => ({ file: resolve(root, 'web/src', name), owner: 'official' })),
  ];
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--no-deps'], { cwd: root, encoding: 'utf8' }));
  const typeScriptFailures = ['custom', 'official'].flatMap(owner => {
    const configPath = resolve(root, 'web', owner === 'custom' ? 'tsconfig.custom.json' : 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) return [`Cannot read ${configPath}`];
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
    return inspectTypeScript(root, sourceRoots.filter(entry => entry.owner === owner), parsed.options);
  });
  return [...typeScriptFailures, ...inspectCargo(metadata.packages), ...inspectRust(root, filesIn(resolve(root, 'crates'), /\.rs$/))];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkBoundaries();
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Custom/official Rust and TypeScript boundaries are independent.');
}
