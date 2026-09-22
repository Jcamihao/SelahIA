import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.WATCH_ROOT || '/home/caminhao/codeStage';
const REPOS = (process.env.WATCH_REPOS || 'Lumen,PraiseApp,Agilis,Triluga').split(',');
const POLL_MS = Number(process.env.WATCH_POLL_MS || 30000);
const STABLE_POLLS = Number(process.env.WATCH_STABLE_POLLS || 2);
// Ao rearmar o Monitor (expira a cada 30 min) o baseline so gera ruido; WATCH_QUIET_BASELINE=1 o omite.
const QUIET_BASELINE = process.env.WATCH_QUIET_BASELINE === '1';

const AI_RE = /selah|generativelanguage|@google\/generative-ai|@google\/genai|openai|ollama|anthropic|gemini/i;
const DIRECT_RE =
  /generativelanguage\.googleapis|@google\/generative-ai|@google\/genai|api\.openai\.com|['"]openai['"]|@anthropic-ai|api\.anthropic\.com|ollama/i;
const PATH_RE = /selah|assistant|receipt|insight|llm|(^|\/)ai[-_./]|[-_/]ai\./i;
const COMMIT_SUBJECT_RE = /selah|\bia\b|\bai\b|assistant|gemini|llm|prompt|ocr|insight/i;
const EXCLUDE_DIR = /(^|\/)(node_modules|dist|build|coverage|\.git|\.angular|android|ios|\.next)\//;
const EXCLUDE_FILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.lock|\.md|\.map|\.png|\.jpe?g|\.svg|\.ico|\.woff2?|\.pdf)$/i;

const out = (line) => console.log(line.replace(/\s+/g, ' ').slice(0, 600));
const relevantPath = (f) => !EXCLUDE_DIR.test(f) && !EXCLUDE_FILE.test(f);
const sha = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);

const git = (repo, args) =>
  execFileSync('git', ['-C', join(ROOT, repo), ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

// Mapa arquivo -> { added, removed, text } a partir de um `git diff -U0`.
const parseDiff = (raw) => {
  const files = new Map();
  let current = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/ b\/(.+)$/);
      current = match ? match[1] : null;
      if (current && relevantPath(current)) files.set(current, { added: 0, removed: 0, text: '' });
      else current = null;
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      const entry = files.get(current);
      entry.added += 1;
      entry.text += line.slice(1) + '\n';
    } else if (current && line.startsWith('-') && !line.startsWith('---')) {
      files.get(current).removed += 1;
    }
  }
  return files;
};

const contractFiles = (repo) => {
  try {
    return new Set(
      git(repo, ['grep', '-l', '-I', '-i', '-E', 'X-Selah|SELAH_|selah-ai|selah_ia|SelahIA'])
        .split('\n')
        .filter((f) => f && relevantPath(f)),
    );
  } catch {
    return new Set();
  }
};

const untrackedFiles = (repo) => {
  const files = new Map();
  for (const file of git(repo, ['ls-files', '--others', '--exclude-standard']).split('\n')) {
    if (!file || !relevantPath(file)) continue;
    try {
      const path = join(ROOT, repo, file);
      if (statSync(path).size > 1_000_000) continue;
      const text = readFileSync(path, 'utf8');
      files.set(file, { added: text.split('\n').length, removed: 0, text });
    } catch {
      /* arquivo sumiu entre o ls-files e a leitura */
    }
  }
  return files;
};

const classify = (repo, files) => {
  const contract = contractFiles(repo);
  const relevant = [];
  const direct = [];
  for (const [file, info] of files) {
    if (contract.has(file) || PATH_RE.test(file) || AI_RE.test(info.text)) relevant.push([file, info]);
    if (DIRECT_RE.test(info.text) && !contract.has(file)) direct.push(file);
  }
  return { relevant, direct };
};

const describe = (relevant) =>
  relevant
    .slice(0, 8)
    .map(([file, info]) => `${file}(+${info.added}/-${info.removed})`)
    .join(', ') + (relevant.length > 8 ? ` e mais ${relevant.length - 8}` : '');

const workingTree = (repo) => {
  const files = parseDiff(git(repo, ['diff', '-U0', '--no-color', '--no-ext-diff', 'HEAD']));
  for (const [file, info] of untrackedFiles(repo)) files.set(file, info);
  return classify(repo, files);
};

const fingerprint = ({ relevant, direct }) =>
  JSON.stringify([
    relevant.map(([file, info]) => [file, sha(info.text), info.removed]).sort(),
    [...direct].sort(),
  ]);

const state = new Map();

const init = (repo) => {
  if (!existsSync(join(ROOT, repo))) return out(`[INFO] ${repo}: pasta nao existe, sem vigia`);
  try {
    git(repo, ['rev-parse', '--git-dir']);
  } catch {
    return out(`[INFO] ${repo}: nao e repositorio git, sem vigia`);
  }
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const wt = workingTree(repo);
  state.set(repo, { head, lastFp: fingerprint(wt), pendingFp: null, stable: 0, alertedDirect: new Set() });
  const summary = wt.relevant.length
    ? `${wt.relevant.length} arquivo(s) relevantes p/ IA ja modificados e nao commitados: ${describe(wt.relevant)}`
    : 'sem alteracoes pendentes relevantes p/ IA';
  if (!QUIET_BASELINE) out(`[BASELINE] ${repo} @${head.slice(0, 7)}: ${summary}`);
  if (wt.direct.length) {
    state.get(repo).alertedDirect.add(JSON.stringify([...wt.direct].sort()));
    if (!QUIET_BASELINE) out(`[BASELINE-IA-DIRETA] ${repo}: provedor de IA acessado direto (fora do Selah) em: ${wt.direct.slice(0, 6).join(', ')}`);
  }
};

const poll = (repo) => {
  const s = state.get(repo);
  if (!s) return;

  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  if (head !== s.head) {
    const old = s.head;
    s.head = head;
    let subjects = '';
    let files = new Map();
    try {
      subjects = git(repo, ['log', '--format=%h "%s"', '-n', '5', `${old}..${head}`]).trim().split('\n').filter(Boolean).join('; ');
      files = parseDiff(git(repo, ['diff', '-U0', '--no-color', '--no-ext-diff', old, head]));
    } catch {
      /* historico reescrito */
    }
    const { relevant, direct } = classify(repo, files);
    if (relevant.length || COMMIT_SUBJECT_RE.test(subjects)) {
      out(`[COMMIT] ${repo}: ${subjects || `HEAD mudou p/ ${head.slice(0, 7)}`} | relevantes p/ IA: ${relevant.length ? describe(relevant) : 'nenhum arquivo'}`);
    }
    if (direct.length) {
      out(`[ALERTA-IA-DIRETA] ${repo}: commit mexe em provedor de IA fora do Selah: ${direct.slice(0, 6).join(', ')}`);
    }
  }

  const wt = workingTree(repo);
  const fp = fingerprint(wt);
  if (fp === s.lastFp) {
    s.pendingFp = null;
    s.stable = 0;
    return;
  }
  if (fp !== s.pendingFp) {
    s.pendingFp = fp;
    s.stable = 1;
    return;
  }
  s.stable += 1;
  if (s.stable < STABLE_POLLS) return;

  s.lastFp = fp;
  s.pendingFp = null;
  s.stable = 0;
  if (wt.relevant.length) {
    out(`[WIP] ${repo}: ${wt.relevant.length} arquivo(s) relevantes p/ IA alterados e nao commitados: ${describe(wt.relevant)}`);
  }
  const directKey = JSON.stringify([...wt.direct].sort());
  if (wt.direct.length && !s.alertedDirect.has(directKey)) {
    s.alertedDirect.add(directKey);
    out(`[ALERTA-IA-DIRETA] ${repo}: alteracao acessa provedor de IA fora do Selah: ${wt.direct.slice(0, 6).join(', ')}`);
  }
};

REPOS.forEach((repo) => {
  try {
    init(repo);
  } catch (error) {
    out(`[ERRO-VIGIA] ${repo}: ${String(error.message).slice(0, 160)}`);
  }
});

const lastError = new Map();
setInterval(() => {
  for (const repo of state.keys()) {
    try {
      poll(repo);
      lastError.delete(repo);
    } catch (error) {
      const message = String(error.message).slice(0, 160);
      if (lastError.get(repo) !== message) {
        lastError.set(repo, message);
        out(`[ERRO-VIGIA] ${repo}: ${message}`);
      }
    }
  }
}, POLL_MS);
