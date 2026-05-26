import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers globales (se asume que ya están registrados)
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

function calcLines5(text: string, maxCPL = 55): number {
  if (!text) return 1;
  const plain = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
  const lines = plain.split(/\r?\n/);
  let total = 0;
  for (const line of lines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / maxCPL);
  }
  return Math.max(total, 1);
}

function splitInTwo5(text: string, maxLines: number, cpl: number): [string, string] {
  if (!text) return ['', ''];
  const words = text.split(' ');
  let first = '';
  let cutIdx = words.length;
  for (let i = 0; i < words.length; i++) {
    const test = first ? `${first} ${words[i]}` : words[i];
    if (calcLines5(test, cpl) > maxLines && first.length > 0) {
      cutIdx = i;
      break;
    }
    first = test;
    cutIdx = i + 1;
  }
  const rest = words.slice(cutIdx).join(' ');
  return [first.trim(), rest.trim()];
}

function reCalcChunkProd5(chunk: any[]): any[] {
  const cnt = new Map<number, number>();
  for (const r of chunk) cnt.set(r.concepto, (cnt.get(r.concepto) || 0) + 1);
  const seen = new Set<number>();
  return chunk.map((r: any) => {
    const isFirst = !seen.has(r.concepto);
    if (isFirst) seen.add(r.concepto);
    return { ...r, isFirstInConcepto: isFirst, rowspan: cnt.get(r.concepto) || 1 };
  });
}

function reCalcChunkSvc5(chunk: any[]): any[] {
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
// EMPRESA 5 — padding-top: 35mm, padding-bottom: 30mm
// ─────────────────────────────────────────────────────────────────

// PRODUCTOS (sin cambios)
const P5_MAX_FIRST = 16;
const P5_MAX_OTHER = 22;
const P5_FOOTER    = 8;

hbs.registerHelper('licitSmartChunk5', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];
  const chunks: any[][] = [];
  let cur: any[] = [], curLines = 0;
  for (const row of rows) {
    const lines   = Math.max(1, Math.ceil((row.descripcion?.length ?? 0) / 50));
    const isFirst = chunks.length === 0;
    const max     = isFirst ? P5_MAX_FIRST : P5_MAX_OTHER;
    if (curLines + lines > max && cur.length > 0) { chunks.push([...cur]); cur = []; curLines = 0; }
    cur.push(row); curLines += lines;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.map(reCalcChunkProd5);
});

hbs.registerHelper('licitNeedsSeparatePage5', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;
  const chunks = (hbs.helpers as any).licitSmartChunk5(rows);
  if (!chunks.length) return true;
  const last = chunks[chunks.length - 1];
  const lastLines = last.reduce(
    (s: number, r: any) => s + Math.max(1, Math.ceil((r.descripcion?.length ?? 0) / 50)), 0
  );
  const max = chunks.length === 1 ? P5_MAX_FIRST : P5_MAX_OTHER;
  return (lastLines + P5_FOOTER) > max;
});

// ================= SERVICIOS CON ALGORITMO OPTIMIZADO (APROVECHA ESPACIO RESIDUAL) =================
const S5_ROW_BASE   = 1;
const S5_MAX_FIRST  = 22;      // primera página (encabezado grande)
const S5_MAX_OTHER  = 36;      // páginas siguientes
const S5_FOOTER     = 8;
const S5_CPL        = 55;

hbs.registerHelper('licitSmartChunkServicios5', function (rows: any[]) {
  if (!rows || rows.length === 0) return [];

  // Cola de filas pendientes (incluye partes divididas)
  const pendingRows = [...rows];
  const chunks: any[][] = [];
  let curChunk: any[] = [];
  let curLines = 0;
  let globalCounter = 1;

  const maxForPage = (idx: number) => (idx === 0 ? S5_MAX_FIRST : S5_MAX_OTHER);
  
  const flush = () => {
    if (curChunk.length) {
      chunks.push([...curChunk]);
      curChunk = [];
      curLines = 0;
    }
  };

  // Intenta colocar una fila (o parte) en la página actual.
  // Retorna true si colocó algo (completo o parcial), false si no cupo nada.
  const tryPlace = (row: any, isContinuation: boolean): boolean => {
    const text = row.descripcion || '';
    const descLines = calcLines5(text, S5_CPL);
    const totalLines = S5_ROW_BASE + descLines;
    const pageIdx = chunks.length;
    const limit = maxForPage(pageIdx);
    const available = limit - curLines;

    // Si cabe completo, lo colocamos
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

    // Si no cabe completo pero hay al menos 1 línea disponible, intentamos dividir
    if (available >= S5_ROW_BASE + 1) {
      const maxDesc = available - S5_ROW_BASE;
      const [partA, partB] = splitInTwo5(text, maxDesc, S5_CPL);
      if (partA) {
        // Colocamos la primera parte
        curChunk.push({
          ...row,
          descripcion: partA,
          isContinuation,
          globalIndex: isContinuation ? '' : globalCounter++
        });
        curLines += S5_ROW_BASE + calcLines5(partA, S5_CPL);
        // Si sobra texto, lo insertamos al inicio de la cola (para que se procese inmediatamente)
        if (partB) {
          pendingRows.unshift({ ...row, descripcion: partB, isContinuation: true });
        }
        return true;
      }
    }

    // No cabe ni una línea → no se puede colocar nada
    return false;
  };

  // Procesamiento principal: NO cerramos la página hasta que no quepa absolutamente nada.
  while (pendingRows.length > 0) {
    const row = pendingRows.shift()!;
    const isCont = row.isContinuation || false;

    // Intentamos colocar en la página actual
    if (tryPlace(row, isCont)) {
      // Se colocó (completo o parcial). Continuamos con la siguiente fila (la página sigue abierta).
      continue;
    }

    // No cupo nada → cerramos la página actual y creamos una nueva
    flush();
    // Ahora reintentamos con la misma fila en la página nueva (debe caber al menos una parte)
    if (!tryPlace(row, isCont)) {
      // Fallback extremo: forzar un fragmento mínimo
      const forced = (row.descripcion || '').substring(0, 50) + '…';
      curChunk.push({
        ...row,
        descripcion: forced,
        isContinuation: isCont,
        globalIndex: isCont ? '' : globalCounter++
      });
      curLines = S5_ROW_BASE + calcLines5(forced, S5_CPL);
    }
  }

  // Al final, si queda contenido, cerrar la última página
  flush();

  return chunks.map(chunk => reCalcChunkSvc5(chunk));
});

hbs.registerHelper('licitNeedsSeparatePageServicios5', function (rows: any[]) {
  if (!rows || rows.length === 0) return false;

  const TOTAL_PAGE_LINES = 54;       // capacidad total por hoja (Century Gothic, 12pt)
  const HEADER_FIRST = 14;           // encabezado primera página
  const HEADER_OTHER = 2;            // encabezado siguientes
  const FOOTER = S5_FOOTER;

  const chunks = (hbs.helpers as any).licitSmartChunkServicios5(rows);
  if (!chunks.length) return true;

  const isFirst = chunks.length === 1;
  const header = isFirst ? HEADER_FIRST : HEADER_OTHER;

  const lastChunk = chunks[chunks.length - 1];
  let lastTableLines = 0;
  for (const row of lastChunk) {
    lastTableLines += S5_ROW_BASE + calcLines5(row.descripcion || '', S5_CPL);
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
export class HtmlLicitacionService5 implements OnModuleInit, OnModuleDestroy {
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