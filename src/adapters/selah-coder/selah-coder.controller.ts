import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { SelahCoderAgentService } from './selah-coder-agent.service';
import { SelahCoderOllamaClient } from './selah-coder-ollama.client';
import { RunSelahCoderAgentDto } from './dto/run-selah-coder-agent.dto';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/selah-coder')
export class SelahCoderController {
  constructor(
    private readonly selahCoderAgentService: SelahCoderAgentService,
    private readonly ollamaClient: SelahCoderOllamaClient,
  ) {}

  @Get('models')
  async models() {
    return { models: await this.ollamaClient.listModels() };
  }

  @Get('memory')
  async memory(@Query('workdir') workdir: string) {
    if (!workdir) return { exists: false, content: null };
    const memoryPath = path.join(workdir, '.selah', 'memory.md');
    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      return { exists: true, content: content.trim() };
    } catch {
      return { exists: false, content: null };
    }
  }

  @Post('agent/run')
  @HttpCode(200)
  run(@Body() dto: RunSelahCoderAgentDto) {
    return this.selahCoderAgentService.run(dto);
  }

  @Post('agent/decompose-stream')
  async decomposeStream(@Body() dto: RunSelahCoderAgentDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      await this.selahCoderAgentService.decomposeAndRun(dto, emit);
    } catch (err: any) {
      emit({ type: 'error', message: err?.message || 'Erro desconhecido' });
    }

    res.end();
  }

  @Post('agent/stream')
  async stream(@Body() dto: RunSelahCoderAgentDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (event: object) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.selahCoderAgentService.runStream(dto, emit);
    } catch (err: any) {
      emit({ type: 'error', message: err?.message || 'Erro desconhecido' });
    }

    res.end();
  }
}
