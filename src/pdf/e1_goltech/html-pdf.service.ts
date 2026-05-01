import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

// ========== Helpers básicos (sin cambios) ==========
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

// Paginación 
hbs.registerHelper('smartChunk', function(items: any[]) {
    if (!items || items.length === 0) return [];

    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLines = 0;
    const MAX_LINES_PER_PAGE = 20; 

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const descLength = item.nombre ? item.nombre.length : 0;
        let itemLines = 1;
        if (descLength > 200) itemLines = 5;
        else if (descLength > 150) itemLines = 4;
        else if (descLength > 100) itemLines = 3;
        else if (descLength > 50) itemLines = 2;
        else if (descLength > 30) itemLines = 1.5;

        if (currentLines + itemLines <= MAX_LINES_PER_PAGE) {
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

// detecta si el footer cabe en la última págin
hbs.registerHelper('needsSeparateImportantPage', function(items: any[], options?: any) {
    if (!items || items.length === 0) return false;

    const root = options?.data?.root || {};
    const MAX_LINES_PER_PAGE = 20; // Mismo valor que en smartChunk

    // Función para calcular líneas que ocupa UN ítem (coherente con smartChunk)
    const getItemLines = (item: any) => {
        const len = item.nombre?.length || 0;
        if (len > 200) return 5;
        if (len > 150) return 4;
        if (len > 100) return 3;
        if (len > 50) return 2;
        if (len > 30) return 1.5;
        return 1;
    };

    // Calcular líneas ocupadas por los ítems de la última página
    const chunks = hbs.helpers.smartChunk(items);
    if (!chunks.length) return true;
    const lastChunk = chunks[chunks.length - 1];
    let itemsLines = 0;
    for (const it of lastChunk) itemsLines += getItemLines(it);

    // Calcular líneas que ocupa el footer (según contenido real)
    let footerLines = 0;

    // Totales (3 filas)
    footerLines += 3;

    footerLines += 1;

    // Condiciones: cada ~85 caracteres sin etiquetas = 1 línea
    if (root.condiciones) {
        const cleanText = root.condiciones.replace(/<[^>]*>/g, '');
        footerLines += Math.max(1, Math.ceil(cleanText.length / 85));
    }

    footerLines += 1 + 5 + 1;
    if (root.firmantePuesto) footerLines += 1;

    // Datos de contacto: cada campo presente es una línea (tal como aparecen en HTML)
    if (root.contactoTelefono) footerLines++;
    if (root.contactoRFC) footerLines++;
    if (root.contactoEmail) footerLines++;
    if (root.contactoEmpresa) footerLines++;
    if (root.contactoDireccion) footerLines++;
    if (root.contactoCiudad) footerLines++;

    // El footer además tiene un border-top y padding que consumen ~1 línea adicional
    footerLines += 1;

    // Decisión: si la suma supera el máximo, necesita página separada
    return (itemsLines + footerLines) > MAX_LINES_PER_PAGE;
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