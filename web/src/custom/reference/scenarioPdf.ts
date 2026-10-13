import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  defaultReferenceFontSize, isReferenceFontSize, referenceFirstNightNote,
  referenceGroupLabels, referenceSetupCounts,
  type ReferenceFontSize,
} from './referenceLayout.js';

export type PdfCharacter = { id: string; kind: string; label: string; ability: string; png: Uint8Array };
export type PdfJinx = { ids: string[]; text: string };
export type ReferencePdfInput = {
  name: string; characters: PdfCharacter[]; jinxes: PdfJinx[];
  regular: Uint8Array; bold: Uint8Array; fontSize?: ReferenceFontSize;
};
const width = 595.28, height = 841.89, margin = 36, contentWidth = width - margin * 2;
const gutter = 20, columnWidth = (contentWidth - gutter) / 2, iconSize = 26, textInset = 34;
const groups = ['Townsfolk', 'Outsider', 'Minion', 'Demon', 'Traveller', 'jinxes'] as const;
const ink = rgb(.17, .16, .19), muted = rgb(.34, .31, .33), accent = rgb(.30, .14, .20);
const good = rgb(.19, .30, .44), rule = rgb(.77, .79, .81);
const groupColor = (group: string) => ['Minion', 'Demon', 'jinxes'].includes(group) ? accent : good;

function wrap(value: string, font: PDFFont, size: number, maxWidth: number, firstWidth = maxWidth): string[] {
  const result: string[] = [];
  let limit = firstWidth;
  if (limit <= 0) { result.push(''); limit = maxWidth; }
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > limit) {
        const space = line.lastIndexOf(' ');
        if (space > line.length / 2) { result.push(line.slice(0, space).trimEnd()); line = line.slice(space + 1); }
        else { result.push(line.trimEnd()); line = ''; }
        limit = maxWidth;
      }
      line += character;
    }
    result.push(line.trimEnd()); limit = maxWidth;
  }
  return result;
}

type PairToken = { id: string; x: number; top: number; separator: boolean };
type Item = { group: string; lines: string[]; character?: PdfCharacter; pair?: PairToken[]; pairHeight?: number; setupAfter?: boolean };
type Spacing = { gap: number; heading: number; rule: number; line: number; bottom: number; tableGap: number };

/** Preview, print and download all use these exact A4 PDF bytes. */
export async function buildReferencePdf(input: ReferencePdfInput): Promise<Uint8Array> {
  const fontSize = input.fontSize ?? defaultReferenceFontSize;
  if (!isReferenceFontSize(fontSize)) throw Error('글자 크기를 8~12pt 중에서 선택해 주세요.');
  const nameSize = fontSize + 1;
  const measure = (name: string, start: number) => performance.measure('reference-pdf:' + name, { start, end: performance.now() });
  let stage = performance.now();
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  pdf.setTitle(input.name); pdf.setCreator('Clocktower');
  const regular = await pdf.embedFont(input.regular, { subset: false });
  const bold = await pdf.embedFont(input.bold, { subset: false });
  measure('fonts', stage); stage = performance.now();
  const icons = new Map(await Promise.all(input.characters.map(async c => [c.id, await pdf.embedPng(c.png)] as const)));
  const byId = new Map(input.characters.map(c => [c.id, c]));
  measure('embed-icons', stage); stage = performance.now();

  const meta = '직업 일람 · ' + input.characters.length + '개 캐릭터';
  const metaWidth = regular.widthOfTextAtSize(meta, 8);
  const title = wrap(input.name, bold, 18, contentWidth - metaWidth - 20);
  const bodyTop = 86 + (title.length - 1) * 23;
  const tableSize = fontSize - 1, tableRow = tableSize + 2.5, tableHeight = tableRow * 5;

  const items = groups.flatMap<Item>(group => {
    if (group === 'jinxes') return input.jinxes.map(jinx => {
      let x = 0, top = 0;
      const pair = jinx.ids.map((id, index) => {
        const role = byId.get(id);
        if (!role) throw Error('징크스의 직업 정보를 찾지 못했습니다.');
        const tokenWidth = 29 + bold.widthOfTextAtSize(role.label, nameSize);
        const separator = index > 0;
        if (x && x + (separator ? 18 : 0) + tokenWidth > columnWidth) { x = 0; top += 28; }
        const token = { id, x, top, separator };
        x += (separator ? 18 : 0) + tokenWidth + 14;
        return token;
      });
      return { group, pair, pairHeight: top + 23, lines: wrap(jinx.text, regular, fontSize + .5, columnWidth) };
    });
    return input.characters.filter(c => c.kind === group).map(character => ({
      group, character,
      lines: wrap(character.ability, regular, fontSize, columnWidth - textInset,
        columnWidth - textInset - bold.widthOfTextAtSize(character.label, nameSize) - 6),
    }));
  });
  // Keep the chart with the final character, before any Jinx entries.
  const lastCharacter = [...items].reverse().find(item => item.character);
  if (lastCharacter) lastCharacter.setupAfter = true;
  const spacingAt = (t: number): Spacing => ({
    gap: 10 - 5 * t, heading: 28 + (fontSize - 9) * 1.5 - 6 * t,
    rule: fontSize + 8 - 2 * t, line: fontSize + 4 - t,
    bottom: 66 - 10 * t, tableGap: 8 - 2 * t,
  });
  const contentHeight = (item: Item, s: Spacing) => item.character
    ? Math.max(iconSize, 1 + item.lines.length * s.line)
    : item.pairHeight! + 5 + item.lines.length * (s.line + 1);
  const itemHeight = (item: Item, s: Spacing) => contentHeight(item, s) + s.gap
    + (item.setupAfter ? s.tableGap + tableHeight : 0);
  function paginate(s: Spacing, keepGroups: boolean): Item[][][] | undefined {
    const columns: Item[][] = [];
    let entries: Item[] = [], used = 0, previous = '';
    const available = height - s.bottom - bodyTop;
    const nextColumn = () => { if (entries.length) columns.push(entries); entries = []; used = 0; previous = ''; };
    for (const group of groups) {
      const block = items.filter(item => item.group === group);
      const wholeHeight = s.heading + block.reduce((sum, item) => sum + itemHeight(item, s), 0);
      if (keepGroups && entries.length && wholeHeight <= available && used + wholeHeight > available) nextColumn();
      for (const item of block) {
        let required = itemHeight(item, s) + (previous === group ? 0 : s.heading);
        if (entries.length && used + required > available) { nextColumn(); required = itemHeight(item, s) + s.heading; }
        if (used + required > available) return undefined;
        entries.push(item); used += required; previous = group;
      }
    }
    nextColumn();
    const pages: Item[][][] = [];
    for (let i = 0; i < columns.length; i += 2) pages.push(columns.slice(i, i + 2));
    return pages.length ? pages : [[]];
  }
  function layout(s: Spacing) {
    const basic = paginate(s, false), kept = paginate(s, true);
    return kept && (!basic || kept.length <= basic.length) ? kept : basic;
  }
  const compact = layout(spacingAt(1));
  if (!compact) throw Error('문구가 한 단에 들어가지 않습니다. 글자 크기나 시나리오 이름을 줄여 주세요.');
  let spacing = spacingAt(0), pages = layout(spacing);
  if (!pages || pages.length > compact.length) {
    spacing = spacingAt(1); pages = compact;
    let low = 0, high = 1;
    for (let step = 0; step < 12; step++) {
      const t = (low + high) / 2, candidate = layout(spacingAt(t));
      if (candidate && candidate.length === compact.length) { high = t; spacing = spacingAt(t); pages = candidate; }
      else low = t;
    }
  }
  measure('layout', stage); stage = performance.now();
  function text(page: PDFPage, value: string, x: number, top: number, size: number = fontSize, font = regular, color = ink) {
    page.drawText(value, { x, y: height - top - size, size, font, color });
  }
  function compositionTable(page: PDFPage, left: number, tableTop: number) {
    const labelWidth = bold.widthOfTextAtSize(referenceGroupLabels[0], tableSize) + 8;
    const cellWidth = (columnWidth - labelWidth) / referenceSetupCounts.length;
    page.drawRectangle({ x: left, y: height - tableTop - tableRow, width: columnWidth, height: tableRow, color: rgb(.95, .94, .93) });
    const rows = ['인원', ...referenceGroupLabels.slice(0, 4)];
    for (const [row, label] of rows.entries()) {
      const top = tableTop + row * tableRow;
      text(page, label, left + 3, top + .25, tableSize, bold, row > 2 ? accent : row ? good : muted);
      referenceSetupCounts.forEach((counts, column) => {
        const value = String(counts[row]), font = row === 0 ? bold : regular;
        const cellLeft = left + labelWidth + column * cellWidth;
        text(page, value, cellLeft + (cellWidth - font.widthOfTextAtSize(value, tableSize)) / 2, top + .25, tableSize, font, muted);
      });
      page.drawLine({ start: { x: left, y: height - top - tableRow }, end: { x: left + columnWidth, y: height - top - tableRow }, thickness: row === 4 ? .6 : .3, color: rule });
    }
  }
  for (const [index, columns] of pages.entries()) {
    const page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    text(page, 'BLOOD ON THE CLOCKTOWER', margin, 30, 6.75, bold, muted);
    title.forEach((line, i) => text(page, line, margin, 42 + i * 23, 18, bold, accent));
    text(page, meta, width - margin - metaWidth, 50, 8, regular, muted);
    page.drawLine({ start: { x: margin, y: height - bodyTop + 16 }, end: { x: width - margin, y: height - bodyTop + 16 }, thickness: 1.3, color: accent });
    for (const [column, entries] of columns.entries()) {
      const left = margin + column * (columnWidth + gutter);
      let y = bodyTop, previous = '';
      for (const item of entries) {
        if (previous !== item.group) {
          text(page, referenceGroupLabels[groups.indexOf(item.group as typeof groups[number])], left, y, fontSize, bold, groupColor(item.group));
          page.drawLine({ start: { x: left, y: height - y - spacing.rule }, end: { x: left + columnWidth, y: height - y - spacing.rule }, thickness: .5, color: rule });
          y += spacing.heading; previous = item.group;
        }
        if (item.character) {
          const c = item.character;
          page.drawImage(icons.get(c.id)!, { x: left, y: height - y - iconSize, width: iconSize, height: iconSize });
          text(page, c.label, left + textInset, y + 1, nameSize, bold);
          const nameEnd = left + textInset + bold.widthOfTextAtSize(c.label, nameSize) + 6;
          item.lines.forEach((line, i) => text(page, line, i ? left + textInset : nameEnd, y + 2 + i * spacing.line, fontSize, regular, muted));
          if (item.setupAfter) compositionTable(page, left, y + contentHeight(item, spacing) + spacing.tableGap);
        } else {
          for (const token of item.pair!) {
            let x = left + token.x;
            if (token.separator) { text(page, '×', x, y + token.top + 6, fontSize, regular, muted); x += 18; }
            page.drawImage(icons.get(token.id)!, { x, y: height - y - token.top - 23, width: 23, height: 23 });
            text(page, byId.get(token.id)!.label, x + 29, y + token.top + 5, nameSize, bold);
          }
          item.lines.forEach((line, i) => text(page, line, left, y + item.pairHeight! + 5 + i * (spacing.line + 1), fontSize + .5, regular, muted));
        }
        y += itemHeight(item, spacing);
      }
    }
    if (!lastCharacter && index === 0) compositionTable(page, margin, bodyTop);
    page.drawLine({ start: { x: margin, y: 45 }, end: { x: width - margin, y: 45 }, thickness: .5, color: rgb(.82, .81, .80) });
    const footerSize = fontSize - 1.5;
    if (columns.flat().some(item => item.character)) text(page, referenceFirstNightNote, margin, height - 34, footerSize, regular, muted);
    const number = (index + 1) + ' / ' + pages.length;
    text(page, number, width - margin - regular.widthOfTextAtSize(number, footerSize), height - 34, footerSize, regular, muted);
  }
  measure('draw', stage); stage = performance.now();
  const result = await pdf.save(); measure('save', stage);
  return result;
}
