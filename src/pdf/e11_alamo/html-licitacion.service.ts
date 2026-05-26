import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// licit_money, licit_eq, licit_gt, licit_and, licit_roman ya registrados globalmente

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

function calcLines11(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

function splitInTwo11(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = words.length;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines11(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
  }
  return [first.trim(), words.slice(cutIdx).join(' ').trim()];
}

function reCalcChunkProd11(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc11(chunk: any[]): any[] {
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
// EMPRESA 11 — padding-top: 20mm, padding-bottom: 40mm
// @page margin: 0 7mm 0 (lateral 7mm del @page)
// Disponible vertical: 279.4 - 20 - 40 = 219.4mm
// ─────────────────────────────────────────────────────────────────

// PRODUCTOS
const P11_MAX_FIRST = 26;
const P11_MAX_OTHER = 32;
const P11_FOOTER    = 7;

hbs.registerHelper('licitSmartChunk11', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P11_MAX_FIRST : P11_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
    cur.push(row); curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd11);
});

hbs.registerHelper('licitNeedsSeparatePage11', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk11(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P11_MAX_FIRST : P11_MAX_OTHER;
  return (lastLines + P11_FOOTER) > max;
});

// SERVICIOS
const S11_MAX_FIRST  = 26;
const S11_MAX_OTHER  = 32;
const S11_FOOTER     = 7;
const S11_ROW_BASE   = 1;
const S11_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios11', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const chunks: any[][] = [];
  let cur: any[]  = [];
  let curLines    = 0;

  const getMax   = () => (chunks.length === 0 ? S11_MAX_FIRST : S11_MAX_OTHER);
  const getAvail = () => getMax() - curLines;

  const flush = () => {
    if (cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
  };

  function addDesc(originalRow: any, desc: string, isCont: boolean): void {
    if (!desc) return;
    const dLines   = calcLines11(desc, S11_CPL);
    const rowLines = S11_ROW_BASE + dLines;
    const avail    = getAvail();

    // ① Cabe completo
    if (rowLines <= avail) {
      cur.push({ ...originalRow, descripcion: desc, isContinuation: isCont });
      curLines += rowLines;
      return;
    }

    // ② Llenar página actual si hay espacio útil
    const maxDescLines = avail - S11_ROW_BASE;
    if (maxDescLines >= 2) {
      const [partA, partB] = splitInTwo11(desc, maxDescLines, S11_CPL);
      if (partA && partB) {
        cur.push({ ...originalRow, descripcion: partA, isContinuation: isCont });
        flush();
        addDesc(originalRow, partB, true);
        return;
      }
    }

    // ③ Sin espacio → flush y reintentar
    flush();
    const freshDLines = calcLines11(desc, S11_CPL);
    const freshMax    = getMax() - S11_ROW_BASE;

    if (freshDLines <= freshMax) {
      cur.push({ ...originalRow, descripcion: desc, isContinuation: isCont });
      curLines += S11_ROW_BASE + freshDLines;
    } else {
      const [partA, partB] = splitInTwo11(desc, freshMax, S11_CPL);
      cur.push({ ...originalRow, descripcion: partA || desc, isContinuation: isCont });
      curLines += S11_ROW_BASE + calcLines11(partA || desc, S11_CPL);
      if (partB) { flush(); addDesc(originalRow, partB, true); }
    }
  }

  for (const row of rows) addDesc(row, row.descripcion ?? '', false);
  flush();
  return chunks.map(reCalcChunkSvc11);
});

hbs.registerHelper('licitNeedsSeparatePageServicios11', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunkServicios11(rows);
  if (!chunks.length) return true;
  const last      = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + S11_ROW_BASE + calcLines11(r.descripcion ?? '', S11_CPL), 0
  );
  const max = chunks.length === 1 ? S11_MAX_FIRST : S11_MAX_OTHER;
  return (lastLines + S11_FOOTER) > max;
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
export class HtmlLicitacionService11 implements OnModuleInit, OnModuleDestroy {
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