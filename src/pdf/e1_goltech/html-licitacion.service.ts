import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

hbs.registerHelper('licit_money', (n: any) => {
  const num = Number(n ?? 0);
  return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});
hbs.registerHelper('licit_eq',  (a: any, b: any) => a === b);
hbs.registerHelper('licit_gt',  (a: any, b: any) => Number(a) > Number(b));
hbs.registerHelper('licit_and', (a: any, b: any) => !!(a && b));

hbs.registerHelper('licit_roman', (index: number) => {
  const n = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
             'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
  return n[Number(index)] ?? String(Number(index) + 1);
});

// ─────────────────────────────────────────────────────────────────
// PRODUCTOS — código intacto, exactamente igual que antes
// ─────────────────────────────────────────────────────────────────

function estimarLineasProducto(descLength: number): number {
  return Math.max(1, Math.ceil(descLength / 50));
}

function recalcularChunkProducto(chunk: any[]): any[] {
  const conceptoCount = new Map<number, number>();
  for (const row of chunk) {
    conceptoCount.set(row.concepto, (conceptoCount.get(row.concepto) || 0) + 1);
  }
  const seen = new Set<number>();
  return chunk.map((row: any) => {
    const isFirst = !seen.has(row.concepto);
    if (isFirst) seen.add(row.concepto);
    return {
      ...row,
      isFirstInConcepto: isFirst,
      rowspan: conceptoCount.get(row.concepto) || 1,
    };
  });
}

const P_MAX_FIRST = 20;
const P_MAX_OTHER = 25;
const P_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = estimarLineasProducto(row.descripcion?.length ?? 0);
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P_MAX_FIRST : P_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) {
      chunks.push([...cur]); cur = []; curLines = 0;
    }
    cur.push(row); curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(recalcularChunkProducto);
});

hbs.registerHelper('licitNeedsSeparatePage', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + estimarLineasProducto(r.descripcion?.length ?? 0), 0
  );
  const max = chunks.length === 1 ? P_MAX_FIRST : P_MAX_OTHER;
  return (lastLines + P_FOOTER) > max;
});

// ─────────────────────────────────────────────────────────────────
// SERVICIOS — helpers corregidos (sin afectar productos)
// ─────────────────────────────────────────────────────────────────

function calculateTextLines(text: string, maxCharsPerLine = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCharsPerLine);
  }
  return Math.max(total, 1);
}

function splitDescriptionByLines(text: string, maxLines: number, charsPerLine: number): string[] {
  if (!text) return [];
  const totalLines = calculateTextLines(text, charsPerLine);
  if (totalLines <= maxLines) return [text];

  const words = text.split(' ');
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (calculateTextLines(test, charsPerLine) > maxLines && current.length > 0) {
      parts.push(current.trim());
      current = word;
    } else {
      current = test;
    }
  }
  if (current) parts.push(current.trim());

  return parts.map(p => {
    if (calculateTextLines(p, charsPerLine) > maxLines) {
      const limitChars = maxLines * charsPerLine;
      return p.substring(0, limitChars) + '…';
    }
    return p;
  });
}

function recalcularChunkServicios(chunk: any[]): any[] {
  const conceptoCount = new Map<number, number>();
  for (const row of chunk) {
    if (!row.isContinuation) {
      conceptoCount.set(row.concepto, (conceptoCount.get(row.concepto) || 0) + 1);
    }
  }
  const seen = new Set<number>();
  return chunk.map((row: any) => {
    if (row.isContinuation) return { ...row, isFirstInConcepto: false, rowspan: 1 };
    const isFirst = !seen.has(row.concepto);
    if (isFirst) seen.add(row.concepto);
    return {
      ...row,
      isFirstInConcepto: isFirst,
      rowspan: conceptoCount.get(row.concepto) || 1,
    };
  });
}

// Constantes ajustadas para servicios
const S_MAX_FIRST  = 30;      // Primera página conservadora
const S_MAX_OTHER  = 50;      // Páginas intermedias: más espacio (antes 40)
const S_FOOTER     = 8;       // Líneas fijas de condiciones + firma
const S_ROW_BASE   = 1;       // Línea base por fila
const S_CHARS_LINE = 55;

hbs.registerHelper('licitSmartChunkServicios', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;

  function maxLines()  { return chunks.length === 0 ? S_MAX_FIRST : S_MAX_OTHER; }
  function available() { return maxLines() - curLines; }

  function flushCur() {
    if (cur.length) {
      chunks.push([...cur]);
      cur = [];
      curLines = 0;
    }
  }

  for (const row of rows) {
    const desc   = row.descripcion ?? '';
    const rawLines = calculateTextLines(desc, S_CHARS_LINE);
    const totalRowLines = S_ROW_BASE + rawLines;

    const avail = available();

    if (totalRowLines <= avail) {
      cur.push({ ...row, isContinuation: false });
      curLines += totalRowLines;
      continue;
    }

    if (avail >= S_ROW_BASE + 1 && cur.length > 0) {
      const maxForFirstPart = avail - S_ROW_BASE;
      const parts = splitDescriptionByLines(desc, maxForFirstPart, S_CHARS_LINE);
      if (parts.length >= 2) {
        // Primera parte
        cur.push({ ...row, descripcion: parts[0], isContinuation: false });
        curLines += S_ROW_BASE + calculateTextLines(parts[0], S_CHARS_LINE);
        flushCur();

        for (let i = 1; i < parts.length; i++) {
          const partLines = S_ROW_BASE + calculateTextLines(parts[i], S_CHARS_LINE);
          if (partLines > maxLines() && cur.length === 0) {
            const subParts = splitDescriptionByLines(parts[i], maxLines() - S_ROW_BASE, S_CHARS_LINE);
            for (const sub of subParts) {
              cur.push({ ...row, descripcion: sub, isContinuation: true });
              curLines += S_ROW_BASE + calculateTextLines(sub, S_CHARS_LINE);
              flushCur();
            }
          } else {
            if (partLines > available() && cur.length > 0) flushCur();
            cur.push({ ...row, descripcion: parts[i], isContinuation: true });
            curLines += partLines;
          }
        }
        continue;
      }
    }

    flushCur();
    if (totalRowLines <= maxLines()) {
      cur.push({ ...row, isContinuation: false });
      curLines += totalRowLines;
    } else {
      const forcedParts = splitDescriptionByLines(desc, maxLines() - S_ROW_BASE, S_CHARS_LINE);
      for (let i = 0; i < forcedParts.length; i++) {
        if (i > 0 && cur.length > 0) flushCur();
        cur.push({ ...row, descripcion: forcedParts[i], isContinuation: i > 0 });
        curLines += S_ROW_BASE + calculateTextLines(forcedParts[i], S_CHARS_LINE);
      }
    }
  }

  flushCur();
  return chunks.map(recalcularChunkServicios);
});

hbs.registerHelper('licitNeedsSeparatePageServicios', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;

  const TOTAL_PAGE_LINES = 55;
  const HEADER_FIRST = 14;
  const HEADER_OTHER = 2;

  const chunks = (hbs.helpers as any).licitSmartChunkServicios(rows);
  if (!chunks.length) return true;

  const isFirst = chunks.length === 1;
  const headerLines = isFirst ? HEADER_FIRST : HEADER_OTHER;

  const lastChunk = chunks[chunks.length - 1];
  let lastTableLines = 0;
  for (const row of lastChunk) {
    const descLines = calculateTextLines(row.descripcion ?? '', S_CHARS_LINE);
    lastTableLines += S_ROW_BASE + descLines;
  }

  const totalNeeded = headerLines + lastTableLines + S_FOOTER;
  return totalNeeded > TOTAL_PAGE_LINES;
});

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

function resolveBaseDir() {
  const d = path.join(__dirname);
  if (fs.existsSync(path.join(d, '..', 'templates'))) return path.join(d, '..');
  const s = path.join(process.cwd(), 'src', 'pdf');
  if (fs.existsSync(path.join(s, 'templates'))) return s;
  return path.join(d, '..');
}

@Injectable()
export class HtmlLicitacionService1 implements OnModuleInit, OnModuleDestroy {
  private templates = new Map<string, hbs.TemplateDelegate>();
  private browser!: Browser;
  private baseDir = resolveBaseDir();

  private toBase64(fp: string): string {
    const abs  = path.isAbsolute(fp) ? fp : path.join(this.baseDir, fp);
    const ext  = path.extname(abs).replace('.', '');
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
  }

  async onModuleInit() {
    this.browser = await chromium.launch({ args: ['--no-sandbox'] });
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close();
  }

  private getTemplate(name: string) {
    if (!this.templates.has(name)) {
      const file = path.join(this.baseDir, 'templates', `${name}.hbs`);
      this.templates.set(name, hbs.compile(fs.readFileSync(file, 'utf8'), { noEscape: true }));
    }
    return this.templates.get(name)!;
  }

  async renderToPdf(templateName: string, data: any): Promise<Buffer> {
    data.assets = { bg: this.toBase64('assets/emp1.png') };
    const html    = this.getTemplate(templateName)(data);
    const tmpFile = path.join(this.baseDir, `__tmp_${templateName}_${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');
    const ctx  = await this.browser.newContext();
    const page = await ctx.newPage();
    await page.goto('file://' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'load' });
    const pdf  = await page.pdf({
      format: 'Letter', printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      preferCSSPageSize: true,
    });
    await ctx.close();
    try { fs.unlinkSync(tmpFile); } catch {}
    return pdf;
  }
}
