import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const BASH_TIMEOUT_MS = 30_000;
const MAX_FILE_READ_BYTES = 50_000;
const MAX_OUTPUT_CHARS = 10_000;
const MAX_DIFF_LINES = 400;  // skip LCS for files larger than this
const CONTEXT_LINES = 3;     // unchanged lines shown around each hunk

export type DiffLine = { t: '+' | '-' | ' '; c: string };

export type ToolExecuteResult = {
  result: string;          // plain text returned to the model
  diff?: DiffLine[];       // only for write_file
  isNewFile?: boolean;
  filePath?: string;
};

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
  ): Promise<ToolExecuteResult> {
    try {
      const resolved = this.resolve(filePath, workingDir);

      // Read existing content before overwriting to compute diff
      let oldContent: string | null = null;
      try { oldContent = await fs.readFile(resolved, 'utf-8'); } catch { /* new file */ }

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');

      const isNewFile = oldContent === null;
      const diff = this.computeDiff(oldContent ?? '', content);
      const added = diff.filter((l) => l.t === '+').length;
      const removed = diff.filter((l) => l.t === '-').length;
      const summary = isNewFile
        ? `Created: ${filePath} (+${content.split('\n').length} lines)`
        : `Updated: ${filePath} (+${added} -${removed})`;

      const verifyErrors = await this.runVerification(filePath, workingDir);
      const result = verifyErrors
        ? `${summary}\n\n⚠ TypeScript errors detected — fix before continuing:\n${verifyErrors}`
        : summary;

      return { result, diff, isNewFile, filePath };
    } catch (e: any) {
      return { result: `Error writing file: ${e.message}` };
    }
  }

  private async runVerification(filePath: string, workingDir: string): Promise<string | null> {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.ts', '.tsx'].includes(ext)) return null;

    // Only run if tsconfig.json AND node_modules exist; avoids npm lookup errors
    // in freshly scaffolded projects that haven't been installed yet.
    try {
      await fs.access(path.join(workingDir, 'tsconfig.json'));
      await fs.access(path.join(workingDir, 'node_modules'));
    } catch { return null; }

    // Prefer the local tsc binary so we never trigger an npx download.
    const tscBin = path.join(workingDir, 'node_modules', '.bin', 'tsc');
    const tscCmd = `"${tscBin}" --noEmit --skipLibCheck 2>&1 | head -40`;

    try {
      const { stdout, stderr } = await execAsync(tscCmd, {
        cwd: workingDir,
        timeout: 20_000,
        shell: '/bin/bash',
      });
      const out = (stdout + stderr).trim();
      if (!out || !out.includes('error TS')) return null;
      return out.slice(0, 3000);
    } catch (e: any) {
      const out = (String(e.stdout || '') + String(e.stderr || '')).trim();
      if (!out || !out.includes('error TS')) return null;
      return out.slice(0, 3000);
    }
  }

  private computeDiff(oldContent: string, newContent: string): DiffLine[] {
    const oldLines = oldContent === '' ? [] : oldContent.split('\n');
    const newLines = newContent.split('\n');

    // For large files skip LCS and return a simple summary diff
    if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
      const added = newLines.filter((l) => !oldLines.includes(l)).length;
      const removed = oldLines.filter((l) => !newLines.includes(l)).length;
      return [
        { t: ' ', c: `[File too large for inline diff — ${added} lines added, ${removed} lines removed]` },
      ];
    }

    // LCS-based diff
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const full: DiffLine[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        full.unshift({ t: ' ', c: oldLines[i - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        full.unshift({ t: '+', c: newLines[j - 1] });
        j--;
      } else {
        full.unshift({ t: '-', c: oldLines[i - 1] });
        i--;
      }
    }

    // Reduce to hunks: keep only changed lines + CONTEXT_LINES of context
    return this.toHunks(full);
  }

  private toHunks(lines: DiffLine[]): DiffLine[] {
    const changed = new Set<number>();
    lines.forEach((l, i) => { if (l.t !== ' ') changed.add(i); });
    if (!changed.size) return [];

    const keep = new Set<number>();
    changed.forEach((idx) => {
      for (let k = Math.max(0, idx - CONTEXT_LINES); k <= Math.min(lines.length - 1, idx + CONTEXT_LINES); k++) {
        keep.add(k);
      }
    });

    const result: DiffLine[] = [];
    let prev = -1;
    Array.from(keep).sort((a, b) => a - b).forEach((idx) => {
      if (prev !== -1 && idx > prev + 1) result.push({ t: ' ', c: '...' });
      result.push(lines[idx]);
      prev = idx;
    });

    return result;
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
      // Auto-create directory if it doesn't exist so the agent never gets stuck on ENOENT
      try {
        await fs.readdir(resolved);
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          await fs.mkdir(resolved, { recursive: true });
          return `(directory did not exist — created: ${resolved})`;
        }
        throw e;
      }
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
  ): Promise<ToolExecuteResult> {
    switch (toolName) {
      case 'read_file':
        return { result: await this.readFile(String(args.path ?? ''), workingDir) };
      case 'write_file':
        return this.writeFile(
          String(args.path ?? ''),
          String(args.content ?? ''),
          workingDir,
        );
      case 'run_bash':
        return { result: await this.runBash(String(args.command ?? ''), workingDir) };
      case 'list_dir':
        return {
          result: await this.listDir(
            args.path ? String(args.path) : undefined,
            workingDir,
          ),
        };
      case 'search_files':
        return {
          result: await this.searchFiles(
            String(args.pattern ?? ''),
            args.path ? String(args.path) : undefined,
            args.filePattern ? String(args.filePattern) : undefined,
            workingDir,
          ),
        };
      case 'run_tests':
        return { result: await this.runTests(workingDir) };
      default:
        return { result: `Unknown tool: ${toolName}` };
    }
  }

  async runTests(workingDir: string): Promise<string> {
    let cmd: string | null = null;

    try {
      const pkg = JSON.parse(await fs.readFile(path.join(workingDir, 'package.json'), 'utf-8'));
      const devDeps = { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
      if (devDeps['jest'] || devDeps['@jest/core'] || devDeps['ts-jest'])
        cmd = 'npx jest --passWithNoTests --no-coverage 2>&1 | tail -60';
      else if (devDeps['vitest'])
        cmd = 'npx vitest run --reporter=verbose 2>&1 | tail -60';
      else if (pkg.scripts?.test && !String(pkg.scripts.test).includes('no test'))
        cmd = 'npm test 2>&1 | tail -60';
    } catch { /* no package.json */ }

    if (!cmd) {
      try {
        await execAsync('python -m pytest --version 2>/dev/null', { cwd: workingDir, timeout: 3000 });
        cmd = 'python -m pytest --tb=short -q 2>&1 | tail -60';
      } catch { /* no pytest */ }
    }

    if (!cmd) return 'No test runner detected (jest, vitest, pytest). No tests were run.';

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: workingDir, timeout: 60_000 });
      return (stdout + stderr).trim() || 'All tests passed (no output)';
    } catch (e: any) {
      const out = (String(e.stdout || '') + String(e.stderr || '')).trim();
      return out ? `Tests failed:\n${out.slice(0, 4000)}` : `Tests failed: ${e.message}`;
    }
  }
}
