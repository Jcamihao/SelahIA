import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { ParseLumenReceiptDto } from './dto/parse-lumen-receipt.dto';
import { LumenReceiptParserService } from './lumen-receipt-parser.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/lumen/receipt-parser')
export class LumenReceiptParserController {
  constructor(
    private readonly lumenReceiptParserService: LumenReceiptParserService,
  ) {}

  @Post('parse')
  @HttpCode(200)
  async parse(@Body() dto: ParseLumenReceiptDto) {
    return this.lumenReceiptParserService.parse(dto);
  }
}
