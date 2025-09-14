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

function resolveBaseDir() {
    // __dirname en prod: .../dist/pdf
    const distDir = path.join(__dirname);
    const distTpl = path.join(distDir, 'templates');
    if (fs.existsSync(distTpl)) return distDir;

    // fallback dev: .../src/pdf
    const srcDir = path.join(process.cwd(), 'src', 'pdf');
    const srcTpl = path.join(srcDir, 'templates');
    if (fs.existsSync(srcTpl)) return srcDir;

    // último intento: donde estés corriendo
    return distDir;
}

@Injectable()
export class HtmlPdfService implements OnModuleInit, OnModuleDestroy {
    private templates = new Map<string, hbs.TemplateDelegate>();
    private browser!: Browser;
    private baseDir = resolveBaseDir(); // 👈

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

    async onModuleDestroy() { if (this.browser) await this.browser.close(); }

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

        // 1) Escribe HTML temporal en el mismo directorio base (o en tmp)
        const tmpDir = this.baseDir; // o usa: os.tmpdir()
        const tmpFile = path.join(tmpDir, `__tmp_${templateName}_${Date.now()}.html`);

        // Si tu HTML usa rutas relativas "assets/...", NO inyectes <base> aquí.
        fs.writeFileSync(tmpFile, html, 'utf8');

        const ctx = await this.browser.newContext();
        const page = await ctx.newPage();

        // 2) Navega al archivo local (ahora sí puede cargar file:// assets)
        const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
        await page.goto(fileUrl, { waitUntil: 'load' });

        const pdf = await page.pdf({
            format: 'Letter',
            printBackground: true,
        });

        await ctx.close();

        // 3) Limpia el archivo temporal
        try { fs.unlinkSync(tmpFile); } catch { }

        return pdf;
    }
}
