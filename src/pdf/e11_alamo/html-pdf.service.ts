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

// Helper para dividir strings (para condiciones)
hbs.registerHelper('split', function(str: string, delimiter: string) {
    if (!str) return [];
    return str.split(delimiter);
});

// Helper para calcular paginación inteligente
hbs.registerHelper('smartChunk', function(items: any[]) {
    if (!items || items.length === 0) return [];
    
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    
    // Variables de control
    let currentLines = 0;
    const MAX_LINES_PER_PAGE = 27; // Líneas máximas por página (estimado)
    const IMPORTANT_SECTION_LINES = 10; // Líneas que ocupa la sección importante
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Calcular líneas aproximadas que ocupa este item
        const descLength = item.nombre ? item.nombre.length : 0;
        let itemLines = 1; // mínimo una línea
        
        if (descLength > 80) itemLines = 3;
        else if (descLength > 50) itemLines = 2;
        else if (descLength > 30) itemLines = 1.5;
        
        const isLastItem = i === items.length - 1;
        const wouldIncludeImportant = isLastItem && 
            (currentLines + itemLines + IMPORTANT_SECTION_LINES <= MAX_LINES_PER_PAGE);
        
        const maxAllowedLines = wouldIncludeImportant ? 
            MAX_LINES_PER_PAGE - IMPORTANT_SECTION_LINES : 
            MAX_LINES_PER_PAGE;
        
        if (currentLines + itemLines <= maxAllowedLines) {
            currentChunk.push({
                ...item,
                globalIndex: i + 1 // Guardamos el índice global aquí
            });
            currentLines += itemLines;
        } else {
            if (currentChunk.length > 0) {
                chunks.push([...currentChunk]);
            }
            currentChunk = [{
                ...item,
                globalIndex: i + 1
            }];
            currentLines = itemLines;
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
});

// Helper para saber si necesita página separada para info importante
hbs.registerHelper('needsSeparateImportantPage', function(items: any[]) {
    if (!items || items.length === 0) return false;
    
    const chunks = hbs.helpers.smartChunk(items);
    if (chunks.length === 0) return true;
    
    const lastChunk = chunks[chunks.length - 1];
    let lastPageLines = 0;
    
    for (const item of lastChunk) {
        const descLength = item.nombre ? item.nombre.length : 0;
        let itemLines = 1;
        
        if (descLength > 80) itemLines = 3;
        else if (descLength > 50) itemLines = 2;
        else if (descLength > 30) itemLines = 1.5;
        
        lastPageLines += itemLines;
    }
    
    return lastPageLines + 10 > 27; // 27 líneas máximas por página
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
export class HtmlPdfService11 implements OnModuleInit, OnModuleDestroy {
    private templates = new Map<string, hbs.TemplateDelegate>();
    private browser!: Browser;
    private baseDir = resolveBaseDir();

    async onModuleInit() {
        console.log('Iniciando HtmlPdfService11, baseDir:', this.baseDir);
        console.log('Template path:', path.join(this.baseDir, 'templates', 'empresa-11.hbs'));
        
        const partialsDir = path.join(this.baseDir, 'templates', 'partials');

        if (fs.existsSync(partialsDir)) {
            console.log('Cargando partials desde:', partialsDir);
            for (const f of fs.readdirSync(partialsDir)) {
                if (f.endsWith('.hbs')) {
                    const name = path.basename(f, '.hbs');
                    const str = fs.readFileSync(path.join(partialsDir, f), 'utf8');
                    hbs.registerPartial(name, str);
                    console.log('  - Registrado partial:', name);
                }
            }
        } else {
            console.log('No se encontró directorio de partials:', partialsDir);
        }

        this.browser = await chromium.launch({ 
            args: ['--no-sandbox'] 
        });
        console.log('Navegador Chromium iniciado para HtmlPdfService11');
    }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            console.log('Navegador Chromium cerrado para HtmlPdfService11');
        }
    }

    private getTemplate(name: string) {
        if (!this.templates.has(name)) {
            const file = path.join(this.baseDir, 'templates', `${name}.hbs`);
            console.log('Buscando template:', file);
            
            if (!fs.existsSync(file)) {
                throw new Error(`Template ${name} no encontrado en ${file}. Directorio base: ${this.baseDir}`);
            }
            
            const str = fs.readFileSync(file, 'utf8');
            console.log(`Template ${name} cargado (${str.length} bytes)`);
            const tpl = hbs.compile(str, { noEscape: true });
            this.templates.set(name, tpl);
        }
        return this.templates.get(name)!;
    }

    async renderToPdf(templateName: string, data: any): Promise<Buffer> {
        console.log(`Renderizando PDF para template: ${templateName}`);
        
        const tpl = this.getTemplate(templateName);
        
        try {
            const html = tpl(data);
            console.log(`HTML generado (${html.length} bytes)`);
            
            // Guardar HTML temporal para depuración
            const debugDir = path.join(this.baseDir, 'debug');
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }
            const debugFile = path.join(debugDir, `debug_${templateName}_${Date.now()}.html`);
            fs.writeFileSync(debugFile, html, 'utf8');
            console.log(`HTML guardado para depuración: ${debugFile}`);
            
            const tmpDir = this.baseDir;
            const tmpFile = path.join(tmpDir, `__tmp_${templateName}_${Date.now()}.html`);
            console.log(`Creando archivo temporal: ${tmpFile}`);

            fs.writeFileSync(tmpFile, html, 'utf8');

            const ctx = await this.browser.newContext();
            const page = await ctx.newPage();

            const fileUrl = 'file://' + tmpFile.replace(/\\/g, '/');
            console.log(`Navegando a: ${fileUrl}`);
            
            await page.goto(fileUrl, { 
                waitUntil: 'load',
                timeout: 30000
            });

            console.log('Página cargada, generando PDF...');
            const pdf = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: {
                    top: '0.5cm',
                    right: '0.5cm',
                    bottom: '0.5cm',
                    left: '0.5cm'
                },
                preferCSSPageSize: true
            });

            await ctx.close();

            try { 
                fs.unlinkSync(tmpFile); 
                console.log('Archivo temporal eliminado');
            } catch (e) {
                console.warn('No se pudo eliminar archivo temporal:', e);
            }

            console.log(`PDF generado (${pdf.length} bytes)`);
            return pdf;
        } catch (error) {
            console.error('Error al generar PDF:', error);
            throw error;
        }
    }
}