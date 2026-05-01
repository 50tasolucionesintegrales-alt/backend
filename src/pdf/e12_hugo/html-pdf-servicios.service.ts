import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

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

hbs.registerHelper('split', function(str: string, delimiter: string) {
    if (!str) return [];
    return str.split(delimiter);
});

function calculateTextLines(text: string, maxCharsPerLine: number): number {
    if (!text) return 1;
    const plainText = text.replace(/<[^>]*>/g, '');
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

function splitTextIntoParts(text: string, maxLines: number, maxCharsPerLine: number): string[] {
    const words = text.split(' ');
    const parts: string[] = [];
    let currentPart = '';

    for (const word of words) {
        const testLine = currentPart + (currentPart ? ' ' : '') + word;
        const lines = calculateTextLines(testLine, maxCharsPerLine);
        if (lines > maxLines && currentPart.length > 0) {
            parts.push(currentPart.trim());
            currentPart = word;
        } else {
            currentPart = testLine;
        }
    }
    if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim());
    }
    return parts.length ? parts : [text];
}

hbs.registerHelper('smartChunkServicios12', function(items: any[]) {
    if (!items || items.length === 0) return [];

    const MAX_FIRST_PAGE_LINES = 14;
    const MAX_OTHER_PAGES_LINES = 26;
    const FOOTER_LINES = 28;
    const MAX_CHARS = 55;

    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;

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
        const isLastItem = i === items.length - 1;

        if (rawLines > maxLinesForPage()) {
            const parts = splitTextIntoParts(item.nombre, maxLinesForPage(), MAX_CHARS);
            for (let p = 0; p < parts.length; p++) {
                const partText = parts[p];
                const partLines = calculateTextLines(partText, MAX_CHARS);
                const isLastPart = p === parts.length - 1;
                const currentPageMax = maxLinesForPage();

                if (isLastItem && isLastPart) {
                    if (currentLines + partLines + FOOTER_LINES > currentPageMax) {
                        flush();
                    }
                } else {
                    if (currentLines + partLines > currentPageMax) {
                        flush();
                    }
                }

                currentChunk.push({
                    ...item,
                    nombre: partText + (isLastPart ? '' : '...'),
                    globalIndex: p === 0 ? i + 1 : '',
                    isContinuation: p > 0,
                });
                currentLines += partLines;

                if (!isLastPart) {
                    flush();
                }
            }
        } else {
            const pageMax = maxLinesForPage();

            if (isLastItem) {
                if (currentLines + rawLines + FOOTER_LINES > pageMax) {
                    flush();
                }
            } else {
                if (currentLines + rawLines > pageMax) {
                    flush();
                }
            }

            currentChunk.push({ ...item, globalIndex: i + 1 });
            currentLines += rawLines;
        }
    }

    flush();
    return chunks;
});

hbs.registerHelper('needsSeparatePageServicios12', function(items: any[]) {
    if (!items || items.length === 0) return true;

    const chunks = (hbs.helpers as any).smartChunkServicios12(items);
    if (!chunks || chunks.length === 0) return true;

    const lastChunk = chunks[chunks.length - 1];
    const isFirstPage = chunks.length === 1;
    const FOOTER_LINES = 28;
    const HEADER_LINES_FIRST = 16;
    const HEADER_LINES_OTHER = 4;
    const TOTAL_PAGE_CAPACITY = 58;

    let lastPageLines = 0;
    for (const item of lastChunk) {
        lastPageLines += calculateTextLines(item.nombre, 55);
    }

    const headerLines = isFirstPage ? HEADER_LINES_FIRST : HEADER_LINES_OTHER;
    const totalUsed = headerLines + lastPageLines;
    const availableSpace = TOTAL_PAGE_CAPACITY - totalUsed;

    // Forzar página separada si el espacio disponible es menor que el footer + un margen de 8 líneas
    const requiredSpace = FOOTER_LINES + 8;
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
export class HtmlPdfServiciosService12 implements OnModuleInit, OnModuleDestroy {
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
            if (!fs.existsSync(file)) {
                throw new Error(`Template ${name} no encontrado en ${file}`);
            }
            const str = fs.readFileSync(file, 'utf8');
            const tpl = hbs.compile(str, { noEscape: true });
            this.templates.set(name, tpl);
        }
        return this.templates.get(name)!;
    }

    async renderToPdf(templateName: string, data: any): Promise<Buffer> {
        const tpl = this.getTemplate(templateName);
        const html = tpl(data);

        const tmpFile = path.join(this.baseDir, `__tmp_${templateName}_${Date.now()}.html`);
        fs.writeFileSync(tmpFile, html, 'utf8');

        const ctx = await this.browser.newContext();
        const page = await ctx.newPage();

        const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });

        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '0.5cm',
                right: '0.5cm',
                bottom: '0.5cm',
                left: '0.5cm',
            },
            preferCSSPageSize: true,
        });

        await ctx.close();

        try { fs.unlinkSync(tmpFile); } catch (e) {}

        return pdf;
    }
}