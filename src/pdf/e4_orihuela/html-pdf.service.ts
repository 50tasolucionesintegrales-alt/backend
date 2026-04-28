import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// Helpers básicos (sin cambios)
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

// Helper smartChunk_e4 – VALORES AUMENTADOS AL MÁXIMO
hbs.registerHelper('smartChunk_e4', function(items: any[]) {
    if (!items || items.length === 0) return [];

    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;

    const MAX_LINES_OTHER_PAGES = 28;        
    const MAX_LINES_FIRST_PAGE = 18;         
    const IMPORTANT_SECTION_LINES = 10;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const descLength = item.nombre ? item.nombre.length : 0;
        let itemLines = 1;
        if (descLength > 200) itemLines = 6;
        else if (descLength > 150) itemLines = 5;
        else if (descLength > 100) itemLines = 4;
        else if (descLength > 50) itemLines = 3;
        else if (descLength > 30) itemLines = 2;

        const isFirstPage = (chunks.length === 0 && currentChunk.length === 0);
        const isLastItem = i === items.length - 1;

        let maxAllowed;
        if (isFirstPage) {
            maxAllowed = MAX_LINES_FIRST_PAGE;
        } else {
            const wouldIncludeImportant = isLastItem && (currentLines + itemLines + IMPORTANT_SECTION_LINES <= MAX_LINES_OTHER_PAGES);
            maxAllowed = wouldIncludeImportant ? MAX_LINES_OTHER_PAGES - IMPORTANT_SECTION_LINES : MAX_LINES_OTHER_PAGES;
        }

        if (currentLines + itemLines <= maxAllowed) {
            currentChunk.push({ ...item, globalIndex: i + 1 });
            currentLines += itemLines;
        } else {
            if (currentChunk.length) chunks.push([...currentChunk]);
            currentChunk = [{ ...item, globalIndex: i + 1 }];
            currentLines = itemLines;
        }
    }
    if (currentChunk.length) chunks.push(currentChunk);
    return chunks;
});

// Helper needsSeparateImportantPage_e4
hbs.registerHelper('needsSeparateImportantPage_e4', function(items: any[]) {
    if (!items || items.length === 0) return false;

    const MAX_LINES_OTHER_PAGES = 28;   
    const FOOTER_LINES_ESTIMATED = 18;  

    const getItemLines = (item: any) => {
        const len = item.nombre?.length || 0;
        if (len > 200) return 6;
        if (len > 150) return 5;
        if (len > 100) return 4;
        if (len > 50) return 3;
        if (len > 30) return 2;
        return 1;
    };

    const chunks = hbs.helpers.smartChunk_e4(items);
    if (!chunks.length) return true;
    const lastChunk = chunks[chunks.length - 1];
    let itemsLines = 0;
    for (const it of lastChunk) itemsLines += getItemLines(it);

    return (itemsLines + FOOTER_LINES_ESTIMATED > MAX_LINES_OTHER_PAGES);
});

// ========== Resolución de rutas y servicio ==========
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
export class HtmlPdfService4 implements OnModuleInit, OnModuleDestroy {
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