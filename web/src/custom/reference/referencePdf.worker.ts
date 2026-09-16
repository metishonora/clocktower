const regularUrl = new URL('./fonts/ClocktowerReferenceSans-Regular.ttf', import.meta.url).href;
const boldUrl = new URL('./fonts/ClocktowerReferenceSans-Bold.ttf', import.meta.url).href;
const fullRegularUrl = new URL('./fonts/NanumGothic-Regular.ttf', import.meta.url).href;
const fullBoldUrl = new URL('./fonts/NanumGothic-Bold.ttf', import.meta.url).href;
import coverage from './fonts/coverage.json' with { type: 'json' };
import { buildReferencePdf, type PdfCharacter, type PdfJinx } from './scenarioPdf.js';

type Request = { id: number; name: string; characters: PdfCharacter[]; jinxes: PdfJinx[] };
const fonts = new Map<string, Promise<Uint8Array>>();
const supported = new Set(coverage);
function fontUrl(text: string, compact: string, full: string) {
  return Array.from(text).every(character => supported.has(character) || /\s/.test(character)) ? compact : full;
}
function loadFont(url: string) {
  let result = fonts.get(url);
  if (!result) {
    result = fetch(url).then(async response => {
      if (!response.ok) throw Error('문서 글꼴을 불러오지 못했습니다.');
      return new Uint8Array(await response.arrayBuffer());
    }).catch(error => { fonts.delete(url); throw error; });
    fonts.set(url, result);
  }
  return result;
}
// One queue keeps rapid open/close requests from running several expensive encoders at once.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(async () => {
    const { id, ...input } = event.data;
    try {
      performance.clearMeasures();
      const body = input.characters.map(c => c.ability).join('') + input.jinxes.map(j => j.text).join('');
      const titles = input.name + input.characters.map(c => c.label).join('');
      const [regular, bold] = await Promise.all([
        loadFont(fontUrl(body, regularUrl, fullRegularUrl)),
        loadFont(fontUrl(titles, boldUrl, fullBoldUrl)),
      ]);
      const bytes = await buildReferencePdf({ ...input, regular, bold });
      const timings = performance.getEntriesByType('measure').map(entry => ({ name: entry.name, duration: entry.duration }));
      self.postMessage({ id, bytes, timings }, { transfer: [bytes.buffer] });
    } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : '문서를 만들지 못했습니다.' }); }
  });
};
