import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type PdfCharacter = { id: string; kind: string; label: string; ability: string; png: Uint8Array };
export type PdfJinx = { ids: string[]; text: string };
export type ReferencePdfInput = { name: string; characters: PdfCharacter[]; jinxes: PdfJinx[]; regular: Uint8Array; bold: Uint8Array };
const width = 595.28, height = 841.89, margin = 36, contentWidth = width - margin * 2;
const groups = [['Townsfolk','마을 주민'],['Outsider','이방인'],['Minion','하수인'],['Demon','악마'],['Traveller','여행자'],['jinxes','징크스']] as const;
const ink = rgb(.17,.16,.19), muted = rgb(.34,.31,.33), accent = rgb(.30,.14,.20);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
        const space = line.lastIndexOf(' ');
        if (space > line.length / 2) { result.push(line.slice(0, space)); line = line.slice(space + 1); }
        else { result.push(line); line = ''; }
      }
      line += character;
    }
    result.push(line.trimEnd());
  }
  return result;
}

/** The PDF owns pagination, typography and paper color; the preview renders these exact bytes. */
export async function buildReferencePdf(input: ReferencePdfInput): Promise<Uint8Array> {
  const measure = (name: string, start: number) => performance.measure(`reference-pdf:${name}`, { start, end: performance.now() });
  let stage = performance.now();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(input.name); pdf.setCreator('Clocktower');
  const regular = await pdf.embedFont(input.regular, { subset: false });
  const bold = await pdf.embedFont(input.bold, { subset: false });
  measure('fonts', stage); stage = performance.now();
  const icons = new Map(await Promise.all(input.characters.map(async c => [c.id, await pdf.embedPng(c.png)] as const)));
  measure('embed-icons', stage); stage = performance.now();
  const byId = new Map(input.characters.map(c => [c.id, c]));
  const title = wrap(input.name, bold, 22.5, contentWidth);
  const bodyTop = 96 + title.length * 28;
  const bodyBottom = height - 66;
  type Item = { group: string; lines: string[]; character?: PdfCharacter; jinx?: PdfJinx; height: number };
  const items: Item[] = groups.flatMap<Item>(([group]) => {
    if (group === 'jinxes') return input.jinxes.map(jinx => {
      const lines = wrap(jinx.text, regular, 9.5, contentWidth);
      return { group, jinx, lines, height: 28 + lines.length * 14 + 10 };
    });
    return input.characters.filter(c => c.kind === group).map(character => {
      const lines = wrap(character.ability, regular, 9, contentWidth - 34);
      return { group, character, lines, height: Math.max(26, 14 + lines.length * 13) + 10 };
    });
  });
  const pages: Item[][] = [];
  let entries: Item[] = [], used = 0, group = '';
  for (const item of items) {
    const required = item.height + (group === item.group ? 0 : 28);
    if (entries.length && used + required > bodyBottom - bodyTop) { pages.push(entries); entries = []; used = 0; group = ''; }
    if (used + item.height + (group === item.group ? 0 : 28) > bodyBottom - bodyTop) throw Error('문구가 한 페이지에 들어가지 않습니다. 시나리오 이름을 줄여 주세요.');
    used += item.height + (group === item.group ? 0 : 28);
    group = item.group; entries.push(item);
  }
  if (entries.length) pages.push(entries);
  measure('layout', stage); stage = performance.now();
  function text(page: PDFPage, value: string, x: number, top: number, size = 9, font = regular, color = ink) {
    page.drawText(value, { x, y: height - top - size, size, font, color });
  }
  for (const [index, pageItems] of pages.entries()) {
    const page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1,1,1) });
    text(page, 'BLOOD ON THE CLOCKTOWER', margin, 36, 6.75, bold, muted);
    title.forEach((line, i) => text(page, line, margin, 53 + i * 28, 22.5, bold, accent));
    text(page, '직업 일람', margin, bodyTop - 35, 8, bold, accent);
    const count = `${input.characters.length}개 캐릭터`;
    text(page, count, width - margin - regular.widthOfTextAtSize(count, 8), bodyTop - 35, 8, regular, muted);
    page.drawLine({ start: { x: margin, y: height - bodyTop + 19 }, end: { x: width - margin, y: height - bodyTop + 19 }, thickness: 1.3, color: accent });
    let y = bodyTop, previousGroup = '';
    for (const item of pageItems) {
      if (previousGroup !== item.group) {
        const color = ['Minion','Demon','jinxes'].includes(item.group) ? accent : rgb(.19,.30,.44);
        text(page, groups.find(([id]) => id === item.group)![1], margin, y, 9, bold, color);
        page.drawLine({ start: { x: margin, y: height - y - 17 }, end: { x: width - margin, y: height - y - 17 }, thickness: .5, color: rgb(.77,.79,.81) });
        y += 28; previousGroup = item.group;
      }
      if (item.character) {
        const c = item.character;
        page.drawImage(icons.get(c.id)!, { x: margin, y: height - y - 26, width: 26, height: 26 });
        text(page, c.label, margin + 34, y, 10, bold);
        item.lines.forEach((line, i) => text(page, line, margin + 34, y + 14 + i * 13, 9, regular, muted));
      } else if (item.jinx) {
        let x = margin;
        for (const [i, id] of item.jinx.ids.entries()) {
          if (i) { text(page, '×', x, y + 6, 9, regular, muted); x += 18; }
          page.drawImage(icons.get(id)!, { x, y: height - y - 23, width: 23, height: 23 });
          const label = byId.get(id)!.label;
          text(page, label, x + 29, y + 5, 10, bold);
          x += 29 + bold.widthOfTextAtSize(label, 10) + 14;
        }
        item.lines.forEach((line, i) => text(page, line, margin, y + 28 + i * 14, 9.5, regular, muted));
      }
      y += item.height;
    }
    page.drawLine({ start: { x: margin, y: 45 }, end: { x: width - margin, y: 45 }, thickness: .5, color: rgb(.82,.81,.80) });
    if (pageItems.some(item => item.character)) text(page, '* 첫날 밤에는 행동하지 않습니다.', margin, height - 34, 7.5, regular, muted);
    const number = `${index + 1} / ${pages.length}`;
    text(page, number, width - margin - regular.widthOfTextAtSize(number, 7.5), height - 34, 7.5, regular, muted);
  }
  measure('draw', stage); stage = performance.now();
  const result = await pdf.save();
  measure('save', stage);
  return result;
}
