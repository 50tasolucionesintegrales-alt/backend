import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers básicos 
hbs.registerHelper('inc', (v: any) => Number(v) + 1);
hbs.registerHelper('money', (n: any) => {
    const num = Number(n ?? 0);
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});
hbs.registerHelper('eq', (a: any, b: any) => a === b);
hbs.registerHelper('or', (a: any, b: any) => !!(a || b));
hbs.registerHelper('gt', (a: any, b: any) => Number(a) > Number(b));
hbs.registerHelper('lt', (a: any, b: any) => Number(a) < Number(b));
hbs.registerHelper('add', (a: any, b: any) => Number(a) + Number(b));
hbs.registerHelper('sub', (a: any, b: any) => Number(a) - Number(b));
hbs.registerHelper('lte', (a: any, b: any) => Number(a) <= Number(b));
hbs.registerHelper('gte', (a: any, b: any) => Number(a) >= Number(b));
hbs.registerHelper('multiply', (a: any, b: any) => Number(a) * Number(b));
hbs.registerHelper('not', (a: any) => !a);
hbs.registerHelper('and', (a: any, b: any) => !!(a && b));

function calculateTextLines(text: string, maxCharsPerLine: number = 55): number {
    if (!text) return 0;
    const plainText = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
    const lines = plainText.split(/\r?\n/);
    let totalLines = 0;
    for (const line of lines) {
        if (line.length === 0) {
            totalLines += 1;
        } else if (line.length > maxCharsPerLine) {
            totalLines += Math.ceil(line.length / maxCharsPerLine);
        } else {
            totalLines += 1;
        }
    }
    return Math.max(totalLines, 1);
}

// CONSTANTES 
const MAX_FIRST_PAGE_LINES = 27;
const MAX_OTHER_PAGES_LINES = 34;
const ROW_BASE_LINES = 1;
const FOOTER_LINES = 30;                // espacio estimado para el bloque de totales/firma
const MAX_PAGE_CAPACITY = 52;           // líneas totales por página (fuente Inter 12pt)

hbs.registerHelper('smartChunkServicios', function(items: any[]) {
    if (!items || items.length === 0) return [];

    // Cola de elementos pendientes
    const pending = [...items];
    const chunks: any[][] = [];
    let curChunk: any[] = [];
    let curLines = 0;
    let globalCounter = 1;

    const maxForPage = (pageIdx: number) => (pageIdx === 0 ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES);

    // Intenta colocar un ítem (o parte) en la página actual.
    const tryPlace = (item: any, isContinuation: boolean): { result: 'complete' | 'partial' | 'none'; leftover?: any } => {
        const text = item.nombre;
        const itemLines = ROW_BASE_LINES + calculateTextLines(text, 55);
        const avail = maxForPage(chunks.length) - curLines;

        // Si cabe completo, lo colocamos
        if (itemLines <= avail) {
            curChunk.push({
                ...item,
                nombre: text,
                isContinuation,
                globalIndex: isContinuation ? '' : globalCounter++
            });
            curLines += itemLines;
            return { result: 'complete' };
        }

        // No cabe completo. ¿Hay al menos 1 línea disponible para dividir?
        if (avail >= ROW_BASE_LINES + 1) {
            const maxDesc = avail - ROW_BASE_LINES; 
            const words = text.split(' ');
            let partA = '';
            let partB = '';
            let cut = 0;
            for (let i = 0; i < words.length; i++) {
                const test = partA ? `${partA} ${words[i]}` : words[i];
                if (calculateTextLines(test, 55) > maxDesc && partA.length > 0) {
                    cut = i;
                    break;
                }
                partA = test;
                cut = i + 1;
            }
            partB = words.slice(cut).join(' ');
            if (partA) {
                // Colocar la primera parte
                curChunk.push({
                    ...item,
                    nombre: partA,
                    isContinuation,
                    globalIndex: isContinuation ? '' : globalCounter++
                });
                curLines += ROW_BASE_LINES + calculateTextLines(partA, 55);
                // Si sobra texto, devolver la segunda parte como leftover
                if (partB) {
                    return { result: 'partial', leftover: { ...item, nombre: partB, isContinuation: true } };
                }
                return { result: 'complete' };
            }
        }
        // No se puede colocar nada
        return { result: 'none' };
    };

    while (pending.length > 0) {
        const item = pending.shift()!;
        const isCont = item.isContinuation || false;

        // Intentar colocar en la página actual
        let result = tryPlace(item, isCont);
        if (result.result === 'none') {
            if (curChunk.length > 0) {
                chunks.push([...curChunk]);
                curChunk = [];
                curLines = 0;
            }
            // Reintentar en página limpia
            result = tryPlace(item, isCont);
            if (result.result === 'none') {
                const forced = (item.nombre || '').substring(0, 100) + '…';
                curChunk.push({
                    ...item,
                    nombre: forced,
                    isContinuation: isCont,
                    globalIndex: isCont ? '' : globalCounter++
                });
                curLines = ROW_BASE_LINES + calculateTextLines(forced, 55);
                continue;
            }
        }

        if (result.result === 'partial' && result.leftover) {
            pending.unshift(result.leftover);
        }
    }

    if (curChunk.length > 0) chunks.push(curChunk);
    return chunks;
});

// HELPER PARA EL FOOTER 
hbs.registerHelper('needsSeparatePageServicios', function(items: any[]) {
    if (!items || items.length === 0) return false;

    const chunks = hbs.helpers.smartChunkServicios(items);
    if (chunks.length === 0) return true;

    const lastChunk = chunks[chunks.length - 1];
    let lastTableLines = 0;
    for (const item of lastChunk) {
        lastTableLines += ROW_BASE_LINES + calculateTextLines(item.nombre, 55);
    }

    const isFirst = chunks.length === 1;
    const headerLines = isFirst ? 14 : 2;
    const totalNeeded = headerLines + lastTableLines + FOOTER_LINES;
    return totalNeeded > MAX_PAGE_CAPACITY;
});

function resolveBaseDir() {
    const distDir = path.join(__dirname);
    const distTpl = path.join(distDir, 'templates');
    if (fs.existsSync(distTpl)) return distDir;
    const srcDir = path.join(process.cwd(), 'src', 'pdf');
    const srcTpl = path.join(srcDir, 'templates');
    if (fs.existsSync(srcTpl)) return srcDir;
    return distDir;
}

@Injectable()
export class HtmlPdfServiciosService1 implements OnModuleInit, OnModuleDestroy {
    private templates = new Map<string, hbs.TemplateDelegate>();
    private browser!: Browser;
    private baseDir = resolveBaseDir();

    private toBase64(filePath: string): string {
        const abs = path.isAbsolute(filePath) ? filePath : path.join(this.baseDir, filePath);
        const ext = path.extname(abs).replace('.', '');
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const file = fs.readFileSync(abs);
        return `data:${mime};base64,${file.toString('base64')}`;
    }

    async onModuleInit() {
        const partialsDir = path.join(this.baseDir, 'templates', 'partials');
        if (fs.existsSync(partialsDir)) {
            for (const f of fs.readdirSync(partialsDir)) {
                if (f.endsWith('.hbs')) {
                    const name = path.basename(f, '.hbs');
                    const str = fs.readFileSync(path.join(partialsDir, f), 'utf8');
                    hbs.registerPartial(name, str);
                }
            }
        }
        this.browser = await chromium.launch({ args: ['--no-sandbox'] });
    }

    async onModuleDestroy() {
        if (this.browser) await this.browser.close();
    }

    private getTemplate(name: string) {
        if (!this.templates.has(name)) {
            const file = path.join(this.baseDir, 'templates', `${name}.hbs`);
            const str = fs.readFileSync(file, 'utf8');
            const tpl = hbs.compile(str, { noEscape: true });
            this.templates.set(name, tpl);
        }
        return this.templates.get(name)!;
    }

    async renderToPdf(templateName: string, data: any): Promise<Buffer> {
        data.assets = {
            bg: this.toBase64('assets/emp1.png'),
            firma: data.firmaUrl ? this.toBase64(data.firmaUrl) : ''
        };
        const tpl = this.getTemplate(templateName);
        const html = tpl(data);
        const tmpDir = this.baseDir;
        const tmpFile = path.join(tmpDir, `__tmp_${templateName}_${Date.now()}.html`);
        fs.writeFileSync(tmpFile, html, 'utf8');
        const ctx = await this.browser.newContext();
        const page = await ctx.newPage();
        const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'load' });
        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true,
        });
        await ctx.close();
        try { fs.unlinkSync(tmpFile); } catch {}
        return pdf;
    }
}