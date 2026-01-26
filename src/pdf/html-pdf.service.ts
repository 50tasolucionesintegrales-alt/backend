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
hbs.registerHelper('add', (a: any, b: any) => Number(a) + Number(b));
hbs.registerHelper('sub', (a: any, b: any) => Number(a) - Number(b));
hbs.registerHelper('lte', (a: any, b: any) => Number(a) <= Number(b));
hbs.registerHelper('gte', (a: any, b: any) => Number(a) >= Number(b));
hbs.registerHelper('multiply', (a: any, b: any) =>  Number(a) * Number(b));


// =========================================================
//   CONFIG GENERAL DEL SISTEMA DE PAGINADO
// =========================================================

const ITEMS_PER_PAGE = 8;

hbs.registerHelper('itemsPerPage', () => ITEMS_PER_PAGE);

// Divide items en bloques de 8 por página
hbs.registerHelper('chunkArray', function(array: any[]) {
    if (!array) return [];
    const chunks: any[][] = [];
    for (let i = 0; i < array.length; i += ITEMS_PER_PAGE) {
        chunks.push(array.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
});

// Calcula cuántos items hay en la última hoja
hbs.registerHelper('itemsOnLastPage', function(items: any[]) {
    if (!items) return 0;
    if (items.length <= ITEMS_PER_PAGE) return items.length;

    const afterFirst = items.length - ITEMS_PER_PAGE;
    const mod = afterFirst % ITEMS_PER_PAGE;

    return mod === 0 ? ITEMS_PER_PAGE : mod;
});

// REGLA 1: Si hay 4 o menos items → info importante en la misma hoja
hbs.registerHelper('showImportantOnFirstPage', function(items: any[]) {
    if (!items) return false;
    return items.length <= 4;
});

// REGLA 5: Mostrar info en la última hoja solo si hay 4 o menos items
hbs.registerHelper('showImportantOnLastPage', function(items: any[]) {
    if (!items) return false;

    const total = items.length;

    // Caso sencillo: 1–4 items → última = primera → mostrar ahí
    if (total <= 4) return true;

    // Si tiene 5–8 items → NO cabe → va en otra hoja
    if (total <= ITEMS_PER_PAGE) return false;

    // Si hay más de 8 items → calcular última hoja
    const afterFirst = total - ITEMS_PER_PAGE;
    const mod = afterFirst % ITEMS_PER_PAGE;
    const lastPageCount = mod === 0 ? ITEMS_PER_PAGE : mod;

    // Mostrar ahí si hay 4 o menos items
    return lastPageCount <= 4;
});

// REGLA 3 y REGLA 4: Saber si necesita una hoja EXTRA para info importante
hbs.registerHelper('needsSeparateImportantPage', function(items: any[]) {
    if (!items) return false;

    const total = items.length;

    // 1–4 items → NO necesita hoja extra
    if (total <= 4) return false;

    // 5–8 items → Siempre necesita hoja extra
    if (total <= ITEMS_PER_PAGE) return true;

    // 9+ → revisar última hoja
    const afterFirst = total - ITEMS_PER_PAGE;
    const mod = afterFirst % ITEMS_PER_PAGE;
    const lastPageCount = mod === 0 ? ITEMS_PER_PAGE : mod;

    // Si en la última hoja hay 5–8 items → NO cabe ahí → hoja extra
    return lastPageCount > 4;
});

// =========================================================
//   RESOLUCIÓN DE DIRECTORIOS
// =========================================================

function resolveBaseDir() {
    const distDir = path.join(__dirname);
    const distTpl = path.join(distDir, 'templates');
    if (fs.existsSync(distTpl)) return distDir;

    const srcDir = path.join(process.cwd(), 'src', 'pdf');
    const srcTpl = path.join(srcDir, 'templates');
    if (fs.existsSync(srcTpl)) return srcDir;

    return distDir;
}

// =========================================================
//   SERVICIO PRINCIPAL DE PDF
// =========================================================

@Injectable()
export class HtmlPdfService implements OnModuleInit, OnModuleDestroy {
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