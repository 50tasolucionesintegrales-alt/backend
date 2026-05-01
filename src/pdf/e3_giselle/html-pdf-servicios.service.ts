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

// Helper para calcular líneas reales de texto
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

// Función para dividir un item largo en múltiples partes
function splitItemByLines(item: any, maxLines: number): any[] {
    const text = item.nombre;
    const words = text.split(' ');
    
    const parts: any[] = [];
    let current = '';
    
    for (const w of words) {
        const test = current + (current ? ' ' : '') + w;
        const lines = calculateTextLines(test, 55);
        
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

// Helper para calcular paginación inteligente con división de items largos - SERVICIOS E3
hbs.registerHelper('smartChunkServicios3', function(items: any[]) {
    if (!items || items.length === 0) return [];
    
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;
    
    const MAX_FIRST_PAGE_LINES = 18;  // ✅ REDUCIDO (antes 26) - menos contenido en primera página
    const MAX_OTHER_PAGES_LINES = 30;
    const FOOTER_LINES = 22;  // ✅ AUMENTADO (antes 20) - más espacio reservado para footer
    const ROW_BASE_LINES = 1;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        let descLines = calculateTextLines(item.nombre, 55);
        let itemLines = ROW_BASE_LINES + descLines;
        
        const isFirstPage = chunks.length === 0;
        const maxLines = isFirstPage ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
        const isLastItem = i === items.length - 1;
        
        let availableLines = maxLines - currentLines;
        
        if (isLastItem) {
            const spaceNeeded = currentLines + itemLines + FOOTER_LINES;
            if (spaceNeeded > maxLines && currentChunk.length > 0) {
                availableLines = 0;
            }
        }
        
        // PRIMERA PÁGINA: dividir si NO CABE
        if (isFirstPage && currentChunk.length === 0 && itemLines > MAX_FIRST_PAGE_LINES) {
            const parts: string[] = [];
            const text = item.nombre;
            const words = text.split(' ');
            
            let firstPart = '';
            let rest = '';
            let inFirstPart = true;
            
            for (const word of words) {
                if (inFirstPart) {
                    const test = firstPart + (firstPart ? ' ' : '') + word;
                    const lines = calculateTextLines(test, 55);
                    if (lines > MAX_FIRST_PAGE_LINES) {
                        rest = word;
                        inFirstPart = false;
                    } else {
                        firstPart = test;
                    }
                } else {
                    rest += (rest ? ' ' : '') + word;
                }
            }
            
            if (firstPart) parts.push(firstPart);
            if (rest) parts.push(rest);
            
            for (let p = 0; p < parts.length; p++) {
                const partDescLines = calculateTextLines(parts[p], 55);
                const partItemLines = ROW_BASE_LINES + partDescLines;
                
                const partIsFirstPage = chunks.length === 0;
                const partMaxLines = partIsFirstPage ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
                const partAvailable = partMaxLines - currentLines;
                
                if (isLastItem && p === parts.length - 1) {
                    const spaceNeeded = currentLines + partItemLines + FOOTER_LINES;
                    if (spaceNeeded > partMaxLines && currentChunk.length > 0) {
                        chunks.push([...currentChunk]);
                        currentChunk = [];
                        currentLines = 0;
                    }
                }
                else if (partItemLines > partAvailable && currentChunk.length > 0) {
                    chunks.push([...currentChunk]);
                    currentChunk = [];
                    currentLines = 0;
                }
                
                currentChunk.push({
                    ...item,
                    nombre: parts[p] + (p === 0 && parts.length > 1 ? '...' : ''),
                    globalIndex: p === 0 ? i + 1 : '',
                    isContinuation: p > 0
                });
                currentLines += partItemLines;
            }
        }
        // OTRAS PÁGINAS: dividir si NO CABE
        else if (!isFirstPage && itemLines > MAX_OTHER_PAGES_LINES) {
            const parts = splitItemByLines(item, MAX_OTHER_PAGES_LINES);
            
            for (let p = 0; p < parts.length; p++) {
                const partDescLines = calculateTextLines(parts[p], 55);
                const partItemLines = ROW_BASE_LINES + partDescLines;
                
                const partAvailable = MAX_OTHER_PAGES_LINES - currentLines;
                
                if (isLastItem && p === parts.length - 1) {
                    const spaceNeeded = currentLines + partItemLines + FOOTER_LINES;
                    if (spaceNeeded > MAX_OTHER_PAGES_LINES && currentChunk.length > 0) {
                        chunks.push([...currentChunk]);
                        currentChunk = [];
                        currentLines = 0;
                    }
                }
                else if (partItemLines > partAvailable && currentChunk.length > 0) {
                    chunks.push([...currentChunk]);
                    currentChunk = [];
                    currentLines = 0;
                }
                
                currentChunk.push({
                    ...item,
                    nombre: parts[p] + (p < parts.length - 1 ? '...' : ''),
                    globalIndex: p === 0 ? i + 1 : '',
                    isContinuation: p > 0
                });
                currentLines += partItemLines;
            }
        }
        // ITEM NORMAL: cabe completo
        else {
            const currentMaxLines = chunks.length === 0 ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
            const currentAvail = currentMaxLines - currentLines;
            
            if (itemLines > currentAvail && currentChunk.length > 0) {
                chunks.push([...currentChunk]);
                currentChunk = [];
                currentLines = 0;
            }
            
            currentChunk.push({
                ...item,
                globalIndex: i + 1
            });
            currentLines += itemLines;
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
});

// Helper para saber si necesita página separada para info importante - SERVICIOS E3
hbs.registerHelper('needsSeparatePageServicios3', function(items: any[]) {
    if (!items || items.length === 0) return false;
    
    const chunks = hbs.helpers.smartChunkServicios3(items);
    if (chunks.length === 0) return true;
    
    const lastChunk = chunks[chunks.length - 1];
    let lastPageLines = 0;
    const ROW_BASE_LINES = 1;
    
    for (const item of lastChunk) {
        const descLines = calculateTextLines(item.nombre, 55);
        lastPageLines += ROW_BASE_LINES + descLines;
    }
    
    const isFirstPage = chunks.length === 1;
    const headerLines = isFirstPage ? 16 : 4;
    const totalLinesOnLastPage = headerLines + lastPageLines;
    const FOOTER_LINES = 22;
    
    // ✅ ULTRA AGRESIVO: Si hay más de 8 líneas de contenido en última página, footer va a página separada
    // Esto garantiza que SIEMPRE se separa cuando hay un servicio con descripción mediana/larga
    if (lastPageLines > 8) return true;
    
    // También separar si no hay suficiente espacio
    const availableSpace = (isFirstPage ? 45 : 55) - totalLinesOnLastPage;
    return availableSpace < 22 || (totalLinesOnLastPage + FOOTER_LINES) > 45;
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
export class HtmlPdfServiciosService3 implements OnModuleInit, OnModuleDestroy {
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