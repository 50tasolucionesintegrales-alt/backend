import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers globales
if (!hbs.helpers['licit_money']) {
  hbs.registerHelper('licit_money', (n: any) => {
    const num = Number(n ?? 0);
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  });
  hbs.registerHelper('licit_eq', (a: any, b: any) => a === b);
  hbs.registerHelper('licit_gt', (a: any, b: any) => Number(a) > Number(b));
  hbs.registerHelper('licit_and', (a: any, b: any) => !!(a && b));
  hbs.registerHelper('licit_roman', (index: number) => {
    const n = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
               'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return n[Number(index)] ?? String(Number(index) + 1);
  });
}

// ─────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────

function calcLines6(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

function splitInTwo6(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = words.length;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines6(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
    cutIdx = i + 1;
  }
  const rest = words.slice(cutIdx).join(' ');
  return [first.trim(), rest.trim()];
}

function reCalcChunkProd6(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc6(chunk: any[]): any[] {
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
// EMPRESA 6
// ─────────────────────────────────────────────────────────────────

// PRODUCTOS (solo se aumentan los límites)
const P6_MAX_FIRST = 26;
const P6_MAX_OTHER = 32;
const P6_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk6', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P6_MAX_FIRST : P6_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
    cur.push(row); curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd6);
});

hbs.registerHelper('licitNeedsSeparatePage6', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk6(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P6_MAX_FIRST : P6_MAX_OTHER;
  return (lastLines + P6_FOOTER) > max;
});

// ================= SERVICIOS (ALGORITMO CORREGIDO - APROVECHA ESPACIO Y SIN DIVISIONES MÚLTIPLES) =================
const S6_ROW_BASE   = 1;
const S6_MAX_FIRST  = 28;
const S6_MAX_OTHER  = 44;
const S6_FOOTER     = 8;
const S6_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios6', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  const pendingRows = [...rows];
  const chunks: any[][] = [];
  let curChunk: any[] = [];
  let curLines = 0;
  let globalCounter = 1;

  const maxForPage = (idx: number) => (idx === 0 ? S6_MAX_FIRST : S6_MAX_OTHER);
  const flush = () => {
    if (curChunk.length) {
      chunks.push([...curChunk]);
      curChunk = [];
      curLines = 0;
    }
  };

  const tryPlace = (row: any, isContinuation: boolean): boolean => {
    const text = row.descripcion || '';
    const descLines = calcLines6(text, S6_CPL);
    const totalLines = S6_ROW_BASE + descLines;
    const pageIdx = chunks.length;
    const limit = maxForPage(pageIdx);
    const available = limit - curLines;

    // Caso 1: cabe completo
    if (totalLines <= available) {
      curChunk.push({
        ...row,
        descripcion: text,
        isContinuation,
        globalIndex: isContinuation ? '' : globalCounter++
      });
      curLines += totalLines;
      return true;
    }

    // Caso 2: no cabe completo, pero hay espacio para al menos 1 línea → dividir
    if (available >= S6_ROW_BASE + 1) {
      const maxDesc = available - S6_ROW_BASE;
      const [partA, partB] = splitInTwo6(text, maxDesc, S6_CPL);
      if (partA) {
        // Colocar primera parte
        curChunk.push({
          ...row,
          descripcion: partA,
          isContinuation,
          globalIndex: isContinuation ? '' : globalCounter++
        });
        curLines += S6_ROW_BASE + calcLines6(partA, S6_CPL);
        // Si sobra texto, encolar la segunda parte (sin cerrar página)
        if (partB) {
          pendingRows.unshift({ ...row, descripcion: partB, isContinuation: true });
        }
        return true;
      }
    }

    // No cabe ni siquiera una línea → no se puede colocar aquí
    return false;
  };

  while (pendingRows.length > 0) {
    const row = pendingRows.shift();
    if (!row) continue;

    // Intentar colocar en la página actual
    if (tryPlace(row, row.isContinuation || false)) {
      continue; // se colocó (completo o parcial), seguimos
    }

    // No cupo nada → cerrar página y reintentar
    flush();
    // Ahora página limpia, debe caber al menos la primera parte de una división
    if (!tryPlace(row, row.isContinuation || false)) {
      // Fallback extremo (no debería ocurrir)
      const forced = (row.descripcion || '').substring(0, 100) + '…';
      curChunk.push({
        ...row,
        descripcion: forced,
        isContinuation: row.isContinuation || false,
        globalIndex: row.isContinuation ? '' : globalCounter++
      });
      curLines = S6_ROW_BASE + calcLines6(forced, S6_CPL);
    }
  }
  flush();

  return chunks.map(chunk => reCalcChunkSvc6(chunk));
});

hbs.registerHelper('licitNeedsSeparatePageServicios6', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;

  const TOTAL_PAGE_LINES = 58;
  const HEADER_FIRST = 12;
  const HEADER_OTHER = 2;
  const FOOTER = S6_FOOTER;

  const chunks = (hbs.helpers as any).licitSmartChunkServicios6(rows);
  if (!chunks.length) return true;

  const isFirst = chunks.length === 1;
  const header = isFirst ? HEADER_FIRST : HEADER_OTHER;

  const lastChunk = chunks[chunks.length - 1];
  let lastTableLines = 0;
  for (const row of lastChunk) {
    lastTableLines += S6_ROW_BASE + calcLines6(row.descripcion || '', S6_CPL);
  }

  const needed = header + lastTableLines + FOOTER;
  return needed > TOTAL_PAGE_LINES;
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
export class HtmlLicitacionService6 implements OnModuleInit, OnModuleDestroy {
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