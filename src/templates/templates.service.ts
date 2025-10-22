import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TemplatesService {
  private assetsDir = path.join(process.cwd(), 'src', 'pdf', 'assets');

  private empresaMap: Record<string, string> = {
    emp1: 'Goltech',
    emp2: 'Juan Angel Bazan Gonzales',
    emp3: 'Alejandra Giselle Hernández Islas',
    emp4: 'Adrián Orihuela Rodríguez',
    emp5: 'Mariana Loeza Hernández',
    emp6: 'Michelle',
    emp7: 'Chalor',
    emp8: 'Leyses',
    emp9: 'ES',
    emp10: 'Jessica Rabadan Castro',
  };

  getAllTemplates(): { name: string; data: string }[] {
    if (!fs.existsSync(this.assetsDir)) {
      return [];
    }

    return fs
      .readdirSync(this.assetsDir)
      .filter(file => /^emp[1-7]\.png$/i.test(file))
      .map(file => {
        const filePath = path.join(this.assetsDir, file);
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');

        const baseName = path.parse(file).name;
        const nombreVisible = this.empresaMap[baseName] || baseName;

        return {
          name: nombreVisible,
          data: `data:image/png;base64,${base64}`,
        };
      });
  }
}