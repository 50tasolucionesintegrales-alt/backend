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

// Helper smartChunk_e7 
hbs.registerHelper('smartChunk_e7', function(items: any[]) {
    if (!items || items.length === 0) return [];

    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;

    // CONSTANTES 
    const MAX_LINES_PER_PAGE = 24;          
    const HEADER_LINES_FIRST_PAGE = 12;          
    const MAX_ITEMS_LINES_FIRST_PAGE = 12;       
    const MAX_ITEMS_LINES_OTHER = 24;             

    // Cálculo de líneas por ítem 
    const getItemLines = (item: any) => {
        const len = item.nombre?.length || 0;
        if (len > 250) return 7;
        if (len > 200) return 6;
        if (len > 150) return 5;
        if (len > 100) return 4;
        if (len > 70) return 3;
        if (len > 40) return 2;
        if (len > 20) return 2;
        return 1;
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemLines = getItemLines(item);
        const isFirstPage = (chunks.length === 0 && currentChunk.length === 0);
        const maxAllowed = isFirstPage ? MAX_ITEMS_LINES_FIRST_PAGE : MAX_ITEMS_LINES_OTHER;

        if (itemLines > maxAllowed) {
            if (currentChunk.length) chunks.push([...currentChunk]);
            currentChunk = [{ ...item, globalIndex: i + 1 }];
            currentLines = itemLines;
        } 
        else if (currentLines + itemLines <= maxAllowed) {
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

// Helper needsSeparateImportantPage_e7 
hbs.registerHelper('needsSeparateImportantPage_e7', function(items: any[], options?: any) {
    if (!items || items.length === 0) return false;

    const MAX_LINES_PER_PAGE = 24;
    const FOOTER_LINES_ESTIMATED = 16;   

    const getItemLines = (item: any) => {
        const len = item.nombre?.length || 0;
        if (len > 250) return 7;
        if (len > 200) return 6;
        if (len > 150) return 5;
        if (len > 100) return 4;
        if (len > 70) return 3;
        if (len > 40) return 2;
        if (len > 20) return 2;
        return 1;
    };

    const chunks = hbs.helpers.smartChunk_e7(items);
    if (!chunks.length) return true;
    const lastChunk = chunks[chunks.length - 1];
    let itemsLines = 0;
    for (const it of lastChunk) itemsLines += getItemLines(it);

    return (itemsLines + FOOTER_LINES_ESTIMATED > MAX_LINES_PER_PAGE);
});

// ========== Resolución de rutas y servicio  ==========
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
export class HtmlPdfService7 implements OnModuleInit, OnModuleDestroy {
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