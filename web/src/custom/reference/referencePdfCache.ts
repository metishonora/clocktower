import type { PdfCharacter, PdfJinx } from './scenarioPdf.js';
import { characterPresentation } from '../authoring/characterPresentation.js';
import type { ScenarioJinx } from '../core/scenarioJinxes.js';

type Pending = { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void };
let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, Pending>();
const documents = new Map<string, Promise<Uint8Array>>();
const icons = new Map<string, Promise<Uint8Array>>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./referencePdf.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<{ id: number; bytes?: Uint8Array; error?: string; timings?: { name: string; duration: number }[] }>) => {
    const task = pending.get(event.data.id);
    if (!task) return;
    pending.delete(event.data.id);
    for (const timing of event.data.timings ?? []) performance.measure(timing.name, { start: performance.now() - timing.duration, duration: timing.duration });
    if (event.data.bytes) task.resolve(event.data.bytes);
    else task.reject(Error(event.data.error ?? '문서를 만들지 못했습니다.'));
  };
  worker.onerror = () => {
    worker?.terminate(); worker = undefined;
    for (const task of pending.values()) task.reject(Error('문서 생성기를 실행하지 못했습니다. 다시 시도해 주세요.'));
    pending.clear();
  };
  return worker;
}
function generate(input: { name: string; characters: PdfCharacter[]; jinxes: PdfJinx[] }) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const instance = getWorker(), id = ++requestId;
    pending.set(id, { resolve, reject });
    try { instance.postMessage({ id, ...input }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}
async function convertIcon(url: string): Promise<Uint8Array> {
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const scale = Math.min(128 / image.width, 128 / image.height);
  canvas.getContext('2d')!.drawImage(image, (128 - image.width * scale) / 2, (128 - image.height * scale) / 2, image.width * scale, image.height * scale);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('직업 아이콘을 준비하지 못했습니다.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
function iconPng(url: string) {
  let result = icons.get(url);
  if (!result) {
    result = convertIcon(url).catch(error => { icons.delete(url); throw error; });
    icons.set(url, result);
  }
  return result;
}
export function referencePdfInput(name: string, ids: string[], jinxes: ScenarioJinx[]) {
  const input = { name, characters: ids.map(id => { const role = characterPresentation(id); if (!role) throw Error('직업 정보를 찾지 못했습니다.'); return { id: role.id, label: role.label, kind: role.kind, ability: role.ability, image: role.image }; }), jinxes: jinxes.map(j => ({ ids: j.characterIds, text: j.reasonKo })) };
  return { input, key: JSON.stringify(input) };
}
export function preparedPdf({ input, key }: ReturnType<typeof referencePdfInput>) {
  const cached = documents.get(key);
  if (cached) { documents.delete(key); documents.set(key, cached); return cached; }
  const started = performance.now();
  const job = Promise.all(input.characters.map(async character => ({ ...character, png: await iconPng(character.image) })))
    .then(characters => {
      performance.measure('reference-pdf:assets', { start: started, end: performance.now() });
      return generate({ ...input, characters });
    }).catch(error => { if (documents.get(key) === job) documents.delete(key); throw error; });
  documents.set(key, job);
  // Bound memory on mobile: two PDF buffers, plus one rendered document in DocumentPreview.
  while (documents.size > 2) documents.delete(documents.keys().next().value!);
  return job;
}
