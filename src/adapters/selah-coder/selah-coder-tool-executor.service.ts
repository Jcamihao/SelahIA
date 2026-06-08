import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const BASH_TIMEOUT_MS = 30_000;
const MAX_FILE_READ_BYTES = 50_000;
const MAX_OUTPUT_CHARS = 10_000;

/**
 * Patterns that look like unfilled template placeholders from any LLM:
 *   {name}  {src}  {module_name}   — Python/JS format-string style
 *   <name>  <Module>               — XML/angle-bracket style
 *   [name]  [SomeName]             — bracket style (also catches [dir] from list_dir output)
 *   __name__  __PLACEHOLDER__      — dunder style
 *   YOUR_NAME  NAME_HERE           — all-caps descriptive style
 *
 * In file paths, none of these sequences ever appear in real source code.
 * In bash commands, {a,b} IS valid brace expansion, so we only flag single-word
 * {identifier} (no comma, no dots, no spaces) — those are always placeholders.
 */
const PATH_PLACEHOLDER_RE =
  /\{[^}]+\}|<[A-Za-z][A-Za-z0-9_ ]*>|\[[A-Z][A-Za-z0-9_ ]*\]|__[A-Z_]{3,}__|(?:^|\/)YOUR_[A-Z]+|(?:^|\/)_*[A-Z][A-Z0-9_]{4,}_(?:NAME|PATH|HERE|MODULE|FILE|DIR|CLASS|TYPE|COMPONENT)(?:\/|$)/;

const BASH_PLACEHOLDER_RE =
  /\{[a-zA-Z_][a-zA-Z0-9_]*\}|<[A-Za-z][A-Za-z0-9_ ]*>|__[A-Z_]{3,}__/;

@Injectable()
export class SelahCoderToolExecutorService {
  private readonly logger = new Logger(SelahCoderToolExecutorService.name);

  private allowedPaths(): string[] {
    const raw = String(process.env.CODEX_ALLOWED_PATHS || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  private resolve(filePath: string, workingDir: string): string {
    const match = filePath.match(PATH_PLACEHOLDER_RE);
    if (match) {
      throw new Error(
        `Invalid path — contains an unresolved placeholder "${match[0]}" in "${filePath}". Use a literal path.`,
      );
    }

    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(workingDir, filePath);

    const allowed = this.allowedPaths();
    if (allowed.length > 0 && !allowed.some((a) => resolved.startsWith(a))) {
      throw new Error(
        `Path not allowed: ${resolved}. Set CODEX_ALLOWED_PATHS to permit it.`,
      );
    }

    return resolved;
  }

  async readFile(filePath: string, workingDir: string): Promise<string> {
    try {
      const resolved = this.resolve(filePath, workingDir);
      const stat = await fs.stat(resolved);
      const raw = await fs.readFile(resolved, 'utf-8');
      if (stat.size > MAX_FILE_READ_BYTES) {
        return (
          raw.slice(0, MAX_FILE_READ_BYTES) +
          `\n\n[truncated — total ${stat.size} bytes]`
        );
      }
      return raw;
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  }

  async writeFile(
    filePath: string,
    content: string,
    workingDir: string,
  ): Promise<string> {
    try {
      const resolved = this.resolve(filePath, workingDir);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return `Written: ${resolved} (${content.length} chars)`;
    } catch (e: any) {
      return `Error writing file: ${e.message}`;
    }
  }

  async runBash(command: string, workingDir: string): Promise<string> {
    const placeholderMatch = command.match(BASH_PLACEHOLDER_RE);
    if (placeholderMatch) {
      return `Error: command contains an unresolved placeholder "${placeholderMatch[0]}". Replace it with a literal value and retry.`;
    }
    this.logger.log(`runBash: ${command.slice(0, 120)}`);
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: BASH_TIMEOUT_MS,
      });
      const out = (stdout + stderr).trim();
      return (out || '(no output)').slice(0, MAX_OUTPUT_CHARS);
    } catch (e: any) {
      const out = (String(e.stdout || '') + String(e.stderr || '') || e.message).trim();
      return `Error: ${out.slice(0, MAX_OUTPUT_CHARS)}`;
    }
  }

  async listDir(dirPath: string | undefined, workingDir: string): Promise<string> {
    try {
      const resolved = this.resolve(dirPath || '.', workingDir);
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const lines = entries
        .filter((e) => e.name !== 'node_modules' && e.name !== '.git')
        .map((e) => `${e.isDirectory() ? '[dir] ' : '[file]'} ${e.name}`);
      return lines.join('\n') || '(empty)';
    } catch (e: any) {
      return `Error listing directory: ${e.message}`;
    }
  }

  async searchFiles(
    pattern: string,
    searchPath: string | undefined,
    filePattern: string | undefined,
    workingDir: string,
  ): Promise<string> {
    try {
      const resolved = this.resolve(searchPath || '.', workingDir);
      const includeArg = filePattern ? `--include="${filePattern}"` : '';
      const cmd = [
        'grep -rn',
        includeArg,
        '--exclude-dir=node_modules',
        '--exclude-dir=.git',
        `"${pattern.replace(/"/g, '\\"')}"`,
        `"${resolved}"`,
        '2>/dev/null | head -50',
      ]
        .filter(Boolean)
        .join(' ');

      const { stdout } = await execAsync(cmd, { timeout: BASH_TIMEOUT_MS });
      return stdout.trim() || 'No matches found';
    } catch {
      return 'No matches found';
    }
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    workingDir: string,
  ): Promise<string> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(String(args.path ?? ''), workingDir);
      case 'write_file':
        return this.writeFile(
          String(args.path ?? ''),
          String(args.content ?? ''),
          workingDir,
        );
      case 'run_bash':
        return this.runBash(String(args.command ?? ''), workingDir);
      case 'list_dir':
        return this.listDir(
          args.path ? String(args.path) : undefined,
          workingDir,
        );
      case 'search_files':
        return this.searchFiles(
          String(args.pattern ?? ''),
          args.path ? String(args.path) : undefined,
          args.filePattern ? String(args.filePattern) : undefined,
          workingDir,
        );
      default:
        return `Unknown tool: ${toolName}`;
    }
  }
}
