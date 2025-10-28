import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as hbs from 'handlebars';
import { chromium, Browser } from 'playwright';

type MoneyInput = string | number | null | undefined;

// Helpers Handlebars
hbs.registerHelper('inc', (v: number) => Number(v) + 1);

hbs.registerHelper('money', (n: MoneyInput) => {
  const num = typeof n === 'number' ? n : Number(n ?? 0);
  return `$${num.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
});

hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);
hbs.registerHelper('or', (a: unknown, b: unknown) => Boolean(a || b));

// Helper "chunk" para dividir en grupos de N productos
hbs.registerHelper('chunk', function (items: unknown[], size: number, options) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const chunks: unknown[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  let result = '';
  chunks.forEach((group, index) => {
    const isLast = index === chunks.length - 1;
    result += options.fn({ items: group, isLast });
    if (!isLast) result += '<div class="page-break"></div>';
  });

  return result;
});

// Resolver directorio base (dist en prod, src en dev)
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
export class HtmlPdfService implements OnModuleInit, OnModuleDestroy {
  private templates = new Map<string, hbs.TemplateDelegate>();
  private browser!: Browser;
  private baseDir = resolveBaseDir();

  async onModuleInit() {
    // Registrar partials
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

  async renderToPdf(templateName: string, data: Record<string, unknown>): Promise<Buffer> {
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
