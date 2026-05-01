import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers básicos (compartidos globalmente)
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

function calculateTextLines(text: string, maxCharsPerLine: number = 50): number {
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

function splitItemByLines(item: any, maxLines: number): any[] {
    const text = item.nombre;
    const words = text.split(' ');
    
    const parts: any[] = [];
    let current = '';
    
    for (const w of words) {
        const test = current + (current ? ' ' : '') + w;
        const lines = calculateTextLines(test, 50);
        
        if (lines > maxLines && current.length > 0) {
            parts.push(current.trim());
            current = w;
        } else {
            current = test;
        }
    }
    
    if (current) {
        parts.push(current.trim());
    }
    
    return parts;
}

hbs.registerHelper('smartChunkServicios9', function(items: any[]) {
    if (!items || items.length === 0) return [];
    
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;
    
    // Valores ajustados para evitar desbordes
    const MAX_FIRST_PAGE_LINES = 12;    // Reducido (antes 8)
    const MAX_OTHER_PAGES_LINES = 22;
    const FOOTER_LINES = 24;            // Aumentado para forzar salto
    const ROW_BASE_LINES = 1;
    const MAX_CHARS = 50;
    
    const flush = () => {
        if (currentChunk.length) {
            chunks.push([...currentChunk]);
            currentChunk = [];
            currentLines = 0;
        }
    };
    
    const isFirstPage = () => chunks.length === 0 && currentChunk.length === 0;
    const maxLinesForPage = () => isFirstPage() ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rawLines = calculateTextLines(item.nombre, MAX_CHARS);
        const itemLines = ROW_BASE_LINES + rawLines;
        const isLastItem = i === items.length - 1;
        
        // Si el ítem entero supera el límite de la página actual, dividirlo
        if (itemLines > maxLinesForPage()) {
            // Item muy largo - necesita división
            if (currentChunk.length > 0) flush();
            
            const parts = splitItemByLines(item, maxLinesForPage());
            
            for (let p = 0; p < parts.length; p++) {
                const partText = parts[p];
                const partRawLines = calculateTextLines(partText, MAX_CHARS);
                const partItemLines = ROW_BASE_LINES + partRawLines;
                const isLastPart = p === parts.length - 1;
                const currentPageMax = maxLinesForPage();
                
                if (isLastItem && isLastPart) {
                    if (currentLines + partItemLines + FOOTER_LINES > currentPageMax) flush();
                } else {
                    if (currentLines + partItemLines > currentPageMax) flush();
                }
                
                currentChunk.push({
                    ...item,
                    nombre: partText + (isLastPart ? '' : '...'),
                    globalIndex: p === 0 ? i + 1 : '',
                    isContinuation: p > 0
                });
                currentLines += partItemLines;
                
                if (!isLastPart) flush();
            }
        } else {
            // Item normal - cabe completo
            const pageMax = maxLinesForPage();
            
            if (isLastItem) {
                if (currentLines + itemLines + FOOTER_LINES > pageMax) flush();
            } else {
                if (currentLines + itemLines > pageMax) flush();
            }
            
            currentChunk.push({
                ...item,
                globalIndex: i + 1
            });
            currentLines += itemLines;
        }
    }
    
    flush();
    return chunks;
});

hbs.registerHelper('needsSeparatePageServicios9', function(items: any[]) {
    if (!items || items.length === 0) return false;
    
    const chunks = hbs.helpers.smartChunkServicios9(items);
    if (chunks.length === 0) return true;
    
    const lastChunk = chunks[chunks.length - 1];
    const isFirstPage = chunks.length === 1;
    const FOOTER_LINES = 24;
    const HEADER_LINES_FIRST = 16;
    const HEADER_LINES_OTHER = 4;
    const TOTAL_PAGE_CAPACITY = 52;  // Capacidad estimada en líneas
    
    let lastPageLines = 0;
    const ROW_BASE_LINES = 1;
    for (const item of lastChunk) {
        const descLines = calculateTextLines(item.nombre, 50);
        lastPageLines += ROW_BASE_LINES + descLines;
    }
    
    const headerLines = isFirstPage ? HEADER_LINES_FIRST : HEADER_LINES_OTHER;
    const totalUsed = headerLines + lastPageLines;
    const availableSpace = TOTAL_PAGE_CAPACITY - totalUsed;
    
    // Forzar página separada si no cabe el footer con un margen de seguridad
    const requiredSpace = FOOTER_LINES + 6;
    return availableSpace < requiredSpace;
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
export class HtmlPdfServiciosService9 implements OnModuleInit, OnModuleDestroy {
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

        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true,
        });

        await ctx.close();

        try { fs.unlinkSync(tmpFile); } catch {}

        return pdf;
    }
}