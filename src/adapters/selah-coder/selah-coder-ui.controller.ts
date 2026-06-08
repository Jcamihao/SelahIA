import { Controller, Get, Header, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller('selah-coder')
export class SelahCoderUiController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getUi(): string {
    // After `npm run build`, assets are copied to dist/ and __dirname resolves there.
    // During `nest start --watch` (ts-node), __dirname is the src/ path directly.
    // Fallback to src/ so the UI works in both modes without a prior build.
    const candidates = [
      path.join(__dirname, 'ui', 'index.html'),
      path.join(process.cwd(), 'src', 'adapters', 'selah-coder', 'ui', 'index.html'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    }
    throw new InternalServerErrorException(
      'UI not found. Run npm run build or start with nest start --watch.',
    );
  }
}
