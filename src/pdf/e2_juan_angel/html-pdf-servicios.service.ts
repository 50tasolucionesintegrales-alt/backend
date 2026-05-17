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

// Cálculo preciso de líneas
function calculateTextLines(text: string, maxCharsPerLine: number = 58): number {
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

// CONSTANTES CON VALIDACIONES
const MAX_FIRST_PAGE_LINES = 24;
const MAX_OTHER_PAGES_LINES = 32;
const ROW_BASE_LINES = 1;
const FOOTER_LINES = 24;
const MAX_PAGE_CAPACITY = 52;
const MIN_LINES_TO_DIVIDE = 3; 

// VALIDACIÓN: Verificar si hay espacio seguro para footer
function canFitWithFooter(pageIdx: number, currentLines: number, additionalLines: number): boolean {
    const headerLines = pageIdx === 0 ? 12 : 3;
    const totalNeeded = headerLines + currentLines + additionalLines + FOOTER_LINES;
    return totalNeeded <= MAX_PAGE_CAPACITY;
}

// Verificar límites de página
function isWithinPageLimits(pageIdx: number, lines: number): boolean {
    const maxAllowed = pageIdx === 0 ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
    return lines <= maxAllowed;
}

hbs.registerHelper('smartChunkServicios2', function(items: any[]) {
    if (!items || items.length === 0) return [];

    const pending = [...items];
    const chunks: any[][] = [];
    let curChunk: any[] = [];
    let curLines = 0;
    let globalCounter = 1;

    const maxForPage = (pageIdx: number) => 
        pageIdx === 0 ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;

    const tryPlace = (item: any, isContinuation: boolean): { 
        result: 'complete' | 'partial' | 'none'; 
        leftover?: any 
    } => {
        const text = item.nombre;
        const itemLines = ROW_BASE_LINES + calculateTextLines(text, 58);
        const pageIdx = chunks.length;
        const avail = maxForPage(pageIdx) - curLines;
        const isLastItem = pending.length === 1 && !item.isContinuation;


        // Verificar que no exceda límites absolutos
        if (!isWithinPageLimits(pageIdx, curLines + itemLines)) {
            // No cabe completo, intentar dividir
            if (avail >= MIN_LINES_TO_DIVIDE) {
                // Hay espacio para dividir
            } else {
                // No hay espacio suficiente, nueva página
                return { result: 'none' };
            }
        }

        // Colocar completo si cabe
        if (itemLines <= avail) {
            if (isLastItem) {
                if (!canFitWithFooter(pageIdx, curLines, itemLines)) {
                    return { result: 'none' }; 
                }
            }

            // Verificar que no exceda capacidad total
            const headerLines = pageIdx === 0 ? 12 : 3;
            if (headerLines + curLines + itemLines > MAX_PAGE_CAPACITY) {
                return { result: 'none' };
            }

            curChunk.push({
                ...item,
                nombre: text,
                isContinuation,
                globalIndex: isContinuation ? '' : globalCounter++
            });
            curLines += itemLines;
            return { result: 'complete' };
        }

        // Dividir el item
        if (avail >= MIN_LINES_TO_DIVIDE) {
            const maxDesc = avail - ROW_BASE_LINES;
            
            // Verificar que maxDesc sea razonable
            if (maxDesc < 1) {
                return { result: 'none' };
            }

            const words = text.split(' ');
            let partA = '';
            let cut = 0;

            for (let i = 0; i < words.length; i++) {
                const test = partA ? `${partA} ${words[i]}` : words[i];
                const testLines = calculateTextLines(test, 58);
                
                if (testLines > maxDesc && partA.length > 0) {
                    cut = i;
                    break;
                }
                partA = test;
                cut = i + 1;
            }

            const partB = words.slice(cut).join(' ');

            if (partA) {
                const isLastFragment = pending.length === 1 && !partB;
                const partALines = ROW_BASE_LINES + calculateTextLines(partA, 58);

                // Si parte A es el último fragmento, verificar con footer
                if (isLastFragment) {
                    if (!canFitWithFooter(pageIdx, curLines, partALines)) {
                        return { result: 'none' };
                    }
                }

                // Verificar que partA no exceda límites
                if (curLines + partALines > maxForPage(pageIdx)) {
                    return { result: 'none' };
                }

                curChunk.push({
                    ...item,
                    nombre: partA,
                    isContinuation,
                    globalIndex: isContinuation ? '' : globalCounter++
                });
                curLines += partALines;

                if (partB) {
                    return { 
                        result: 'partial', 
                        leftover: { ...item, nombre: partB, isContinuation: true } 
                    };
                }
                return { result: 'complete' };
            }
        }

        return { result: 'none' };
    };

    // Bucle principal con validaciones
    while (pending.length > 0) {
        const item = pending.shift()!;
        const isCont = item.isContinuation || false;

        let result = tryPlace(item, isCont);

        if (result.result === 'none') {
            // Nueva página
            if (curChunk.length > 0) {
                // Verificar que el chunk no esté vacío
                chunks.push([...curChunk]);
                curChunk = [];
                curLines = 0;
            }

            // Reintentar en página limpia
            result = tryPlace(item, isCont);

            if (result.result === 'none') {
                
                // Calcular cuánto texto cabe en una página completa
                const maxLinesAvailable = MAX_OTHER_PAGES_LINES - ROW_BASE_LINES;
                const maxChars = maxLinesAvailable * 58;
                const forced = (item.nombre || '').substring(0, maxChars) + '…';
                
                curChunk.push({
                    ...item,
                    nombre: forced,
                    isContinuation: isCont,
                    globalIndex: isCont ? '' : globalCounter++
                });
                curLines = ROW_BASE_LINES + calculateTextLines(forced, 58);
                continue;
            }
        }

        if (result.result === 'partial' && result.leftover) {
            pending.unshift(result.leftover);
        }
    }

    // Asegurar que el último chunk tenga contenido
    if (curChunk.length > 0) {
        chunks.push(curChunk);
    }

    return chunks;
});

hbs.registerHelper('needsSeparatePageServicios2', function(items: any[]) {
    if (!items || items.length === 0) return false;

    const chunks = hbs.helpers.smartChunkServicios2(items);
    if (chunks.length === 0) return true;

    const lastChunk = chunks[chunks.length - 1];
    let lastTableLines = 0;
    
    for (const item of lastChunk) {
        lastTableLines += ROW_BASE_LINES + calculateTextLines(item.nombre, 58);
    }

    const isFirstPage = chunks.length === 1;
    const headerLines = isFirstPage ? 12 : 3;
    const totalNeeded = headerLines + lastTableLines + FOOTER_LINES;

    // Verificar espacio con margen de seguridad (2 líneas)
    return totalNeeded > (MAX_PAGE_CAPACITY - 2);
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
export class HtmlPdfServiciosService2 implements OnModuleInit, OnModuleDestroy {
    private templates = new Map<string, hbs.TemplateDelegate>();
    private browser!: Browser;
    private baseDir = resolveBaseDir();

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
        const tpl = this.getTemplate(templateName);
        const html = tpl(data);
        const tmpDir = this.baseDir;
        const tmpFile = path.join(tmpDir, `__tmp_${templateName}_${Date.now()}.html`);
        fs.writeFileSync(tmpFile, html, 'utf8');
        const ctx = await this.browser.newContext();
        const page = await ctx.newPage();
        const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'load' });
        const pdf = await page.pdf({ format: 'Letter', printBackground: true });
        await ctx.close();
        try { fs.unlinkSync(tmpFile); } catch {}
        return pdf;
    }
}