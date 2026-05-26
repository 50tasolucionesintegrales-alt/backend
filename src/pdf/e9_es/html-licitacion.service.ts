import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// licit_money, licit_eq, licit_gt, licit_and, licit_roman ya registrados globalmente

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

function calcLines9(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

function splitInTwo9(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = words.length;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines9(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
  }
  return [first.trim(), words.slice(cutIdx).join(' ').trim()];
}

function reCalcChunkProd9(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc9(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) {
    if (!r.isContinuation) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  }
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    if (r.isContinuation) return { ...r, isFirstInConcepto: false, rowspan: 1 };
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

// ─────────────────────────────────────────────────────────────────
// EMPRESA 9 — padding-top: 45mm, padding-bottom: 25mm
// Disponible: 279.4 - 45 - 25 = 209.4mm
// ─────────────────────────────────────────────────────────────────

// PRODUCTOS
const P9_MAX_FIRST = 14;
const P9_MAX_OTHER = 20;
const P9_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk9', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P9_MAX_FIRST : P9_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
    cur.push(row); curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd9);
});

hbs.registerHelper('licitNeedsSeparatePage9', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk9(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P9_MAX_FIRST : P9_MAX_OTHER;
  return (lastLines + P9_FOOTER) > max;
});

// SERVICIOS
const S9_MAX_FIRST  = 14;
const S9_MAX_OTHER  = 20;
const S9_FOOTER     = 7;
const S9_ROW_BASE   = 1;
const S9_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios9', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const chunks: any[][] = [];
  let cur: any[]  = [];
  let curLines    = 0;

  const getMax   = () => (chunks.length === 0 ? S9_MAX_FIRST : S9_MAX_OTHER);
  const getAvail = () => getMax() - curLines;

  const flush = () => {
    if (cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
  };

  function addDesc(originalRow: any, desc: string, isCont: boolean): void {
    if (!desc) return;
    const dLines   = calcLines9(desc, S9_CPL);
    const rowLines = S9_ROW_BASE + dLines;
    const avail    = getAvail();

    // ① Cabe completo
    if (rowLines <= avail) {
      cur.push({ ...originalRow, descripcion: desc, isContinuation: isCont });
      curLines += rowLines;
      return;
    }

    // ② Llenar página actual si hay espacio útil
    const maxDescLines = avail - S9_ROW_BASE;
    if (maxDescLines >= 2) {
      const [partA, partB] = splitInTwo9(desc, maxDescLines, S9_CPL);
      if (partA && partB) {
        cur.push({ ...originalRow, descripcion: partA, isContinuation: isCont });
        flush();
        addDesc(originalRow, partB, true);
        return;
      }
    }

    // ③ Sin espacio → flush y reintentar
    flush();
    const freshDLines = calcLines9(desc, S9_CPL);
    const freshMax    = getMax() - S9_ROW_BASE;

    if (freshDLines <= freshMax) {
      cur.push({ ...originalRow, descripcion: desc, isContinuation: isCont });
      curLines += S9_ROW_BASE + freshDLines;
    } else {
      const [partA, partB] = splitInTwo9(desc, freshMax, S9_CPL);
      cur.push({ ...originalRow, descripcion: partA || desc, isContinuation: isCont });
      curLines += S9_ROW_BASE + calcLines9(partA || desc, S9_CPL);
      if (partB) { flush(); addDesc(originalRow, partB, true); }
    }
  }

  for (const row of rows) addDesc(row, row.descripcion ?? '', false);
  flush();
  return chunks.map(reCalcChunkSvc9);
});

hbs.registerHelper('licitNeedsSeparatePageServicios9', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunkServicios9(rows);
  if (!chunks.length) return true;
  const last      = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + S9_ROW_BASE + calcLines9(r.descripcion ?? '', S9_CPL), 0
  );
  const max = chunks.length === 1 ? S9_MAX_FIRST : S9_MAX_OTHER;
  return (lastLines + S9_FOOTER) > max;
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
export class HtmlLicitacionService9 implements OnModuleInit, OnModuleDestroy {
  private templates = new Map<string, hbs.TemplateDelegate>();
  private browser!: Browser;
  private baseDir = resolveBaseDir();

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
    const html    = this.getTemplate(templateName)(data);
    const tmpFile = path.join(this.baseDir, `__tmp_${templateName}_${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');

    const ctx  = await this.browser.newContext();
    const page = await ctx.newPage();
    await page.goto('file://' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'load' });

    const pdf = await page.pdf({ format: 'Letter', printBackground: true });

    await ctx.close();
    try { fs.unlinkSync(tmpFile); } catch {}
    return pdf;
  }
}