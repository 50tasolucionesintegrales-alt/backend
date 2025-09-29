import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TemplatesService {
  private assetsDir = path.join(process.cwd(), 'src', 'pdf', 'assets');

  getAllTemplates(): { name: string; data: string }[] {
    if (!fs.existsSync(this.assetsDir)) {
      return [];
    }

    return fs.readdirSync(this.assetsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(this.assetsDir, file);
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        return {
          name: file,
          data: `data:image/png;base64,${base64}`,
        };
      });
  }
}