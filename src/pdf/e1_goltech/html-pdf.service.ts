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

// Helper ÚNICO para empresa-1 (Goltech) - paginación inteligente
hbs.registerHelper('smartChunk_e1', function(items: any[]) {
    if (!items || items.length === 0) return [];
    
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;
    
    const MAX_FIRST_PAGE_LINES = 26;
    const MAX_OTHER_PAGES_LINES = 30;
    const FOOTER_LINES = 18; // DEBE SER IGUAL al de needsSeparateImportantPage_e1
    const ROW_BASE_LINES = 1;
    const MAX_ITEM_LINES_PER_PAGE = 20;
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Calcular líneas reales de la descripción
        let descLines = calculateTextLines(item.nombre, 55);
        let itemLines = ROW_BASE_LINES + descLines;
        
        const isFirstPage = chunks.length === 0 && currentChunk.length === 0;
        const maxLines = isFirstPage ? MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES;
        const isLastItem = i === items.length - 1;
        
        let availableLines = maxLines - currentLines;
        
        if (isLastItem && currentChunk.length === 0) {
            availableLines = maxLines - FOOTER_LINES;
        }
        
        // 🔥 Si el item es muy largo, dividirlo en partes
        if (itemLines > MAX_ITEM_LINES_PER_PAGE) {
            const parts = splitItemByLines(item, MAX_ITEM_LINES_PER_PAGE);
            
            for (let p = 0; p < parts.length; p++) {
                const partDescLines = calculateTextLines(parts[p], 55);
                const partItemLines = ROW_BASE_LINES + partDescLines;
                
                // Verificar si la parte cabe en la página actual
                const currentMaxLines = (chunks.length === 0 && currentChunk.length === 0) 
                    ? MAX_FIRST_PAGE_LINES 
                    : MAX_OTHER_PAGES_LINES;
                let currentAvailable = currentMaxLines - currentLines;
                
                if (isLastItem && p === parts.length - 1 && currentChunk.length === 0) {
                    currentAvailable = currentMaxLines - FOOTER_LINES;
                }
                
                if (partItemLines > currentAvailable && currentChunk.length > 0) {
                    // Guardar página actual y empezar nueva
                    chunks.push([...currentChunk]);
                    currentChunk = [];
                    currentLines = 0;
                }
                
                currentChunk.push({
                    ...item,
                    nombre: parts[p] + (parts.length > 1 && p < parts.length - 1 ? '...' : ''),
                    globalIndex: p === 0 ? i + 1 : '',
                    isContinuation: p > 0
                });
                currentLines += partItemLines;
            }
        } else {
            // Item normal, manejo estándar
            if (itemLines > availableLines && currentChunk.length > 0) {
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

// Helper ÚNICO para empresa-1 - verificar si necesita página separada
hbs.registerHelper('needsSeparateImportantPage_e1', function(items: any[]) {
    if (!items || items.length === 0) return false;
    
    const chunks = hbs.helpers.smartChunk_e1(items);
    if (chunks.length === 0) return true;
    
    const lastChunk = chunks[chunks.length - 1];
    let lastPageLines = 0;
    const ROW_BASE_LINES = 1;
    
    for (const item of lastChunk) {
        const descLines = calculateTextLines(item.nombre, 55);
        lastPageLines += ROW_BASE_LINES + descLines;
    }
    
    // LÓGICA CORREGIDA:
    // Si es la única página (primera y última), usa MAX_FIRST_PAGE_LINES
    // Si es página subsecuente, usa MAX_OTHER_PAGES_LINES
    const isFirstPage = chunks.length === 1;
    const maxLinesAvailable = isFirstPage ? 26 : 30; // MAX_FIRST_PAGE_LINES : MAX_OTHER_PAGES_LINES
    const FOOTER_LINES = 18; // Espacio que ocupa el footer
    
    // Si productos + footer exceden espacio disponible → necesita página separada
    return lastPageLines + FOOTER_LINES > maxLinesAvailable;
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
export class HtmlPdfService1 implements OnModuleInit, OnModuleDestroy {
    private templates = new Map<string, hbs.TemplateDelegate>();
    private browser!: Browser;
    private baseDir = resolveBaseDir();

    private toBase64(filePath: string): string {
        const abs = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.baseDir, filePath);

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
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            preferCSSPageSize: true,
        });

        await ctx.close();

        try { fs.unlinkSync(tmpFile); } catch {}

        return pdf;
    }
}