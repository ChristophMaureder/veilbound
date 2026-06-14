// ──────────────────────────────────────────────────────────────────────────
// Safe arithmetic formula evaluator (NEVER uses eval / Function).
//
// Grammar (Pratt / precedence-climbing):
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/' | '%') factor)*
//   factor  := power ('^' factor)?          (right-assoc)
//   power   := ('-' | '+') power | primary
//   primary := number | ident | ident '(' args ')' | '(' expr ')'
//
// Identifiers resolve against a supplied context (e.g. STR, level, prof).
// A small whitelist of math functions is supported. Anything else -> error.
// ──────────────────────────────────────────────────────────────────────────

export type FormulaContext = Record<string, number>;

export interface FormulaResult {
  value: number;
  error: string | null;
}

export interface DmgTypeInfo {
  name: string;
  colour: string;
}

export interface DmgPart {
  text: string;
  colour?: string;
}

type Token =
  | { t: 'num'; v: number }
  | { t: 'ident'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'comma' };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  floor: (a) => Math.floor(a),
  ceil: (a) => Math.ceil(a),
  round: (a) => Math.round(a),
  abs: (a) => Math.abs(a),
  // clamp(x, lo, hi)
  clamp: (x, lo, hi) => Math.min(Math.max(x, lo), hi),
};

class FormulaError extends Error {}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      const v = Number(text);
      if (!Number.isFinite(v)) throw new FormulaError(`Bad number "${text}"`);
      tokens.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      tokens.push({ t: 'ident', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/%^'.includes(c)) {
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ t: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ t: 'rparen' });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ t: 'comma' });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected character "${c}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[], private readonly ctx: FormulaContext) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const v = this.parseExpr();
    if (this.pos !== this.tokens.length) {
      throw new FormulaError('Unexpected trailing input');
    }
    return v;
  }

  private parseExpr(): number {
    let left = this.parseTerm();
    let tok = this.peek();
    while (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
      this.next();
      const right = this.parseTerm();
      left = tok.v === '+' ? left + right : left - right;
      tok = this.peek();
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseFactor();
    let tok = this.peek();
    while (tok && tok.t === 'op' && (tok.v === '*' || tok.v === '/' || tok.v === '%')) {
      this.next();
      const right = this.parseFactor();
      if (tok.v === '*') left = left * right;
      else if (tok.v === '/') left = right === 0 ? 0 : left / right;
      else left = right === 0 ? 0 : left % right;
      tok = this.peek();
    }
    return left;
  }

  private parseFactor(): number {
    const base = this.parseUnary();
    const tok = this.peek();
    if (tok && tok.t === 'op' && tok.v === '^') {
      this.next();
      const exp = this.parseFactor(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    const tok = this.peek();
    if (tok && tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      this.next();
      const v = this.parseUnary();
      return tok.v === '-' ? -v : v;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.next();
    if (!tok) throw new FormulaError('Unexpected end of formula');
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'lparen') {
      const v = this.parseExpr();
      const close = this.next();
      if (!close || close.t !== 'rparen') throw new FormulaError('Expected ")"');
      return v;
    }
    if (tok.t === 'ident') {
      // function call?
      if (this.peek()?.t === 'lparen') {
        this.next(); // consume '('
        const args: number[] = [];
        if (this.peek()?.t !== 'rparen') {
          args.push(this.parseExpr());
          while (this.peek()?.t === 'comma') {
            this.next();
            args.push(this.parseExpr());
          }
        }
        const close = this.next();
        if (!close || close.t !== 'rparen') throw new FormulaError('Expected ")"');
        const fn = FUNCTIONS[tok.v];
        if (!fn) throw new FormulaError(`Unknown function "${tok.v}"`);
        return fn(...args);
      }
      // variable
      if (Object.prototype.hasOwnProperty.call(this.ctx, tok.v)) {
        return this.ctx[tok.v];
      }
      throw new FormulaError(`Unknown variable "${tok.v}"`);
    }
    throw new FormulaError('Unexpected token');
  }
}

/** Evaluate a formula. Never throws — returns {value, error}. */
export function evalFormula(src: string, ctx: FormulaContext): FormulaResult {
  try {
    const tokens = tokenize(src ?? '');
    if (tokens.length === 0) return { value: 0, error: null };
    const value = new Parser(tokens, ctx).parse();
    if (!Number.isFinite(value)) return { value: 0, error: 'Result is not a finite number' };
    return { value, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { value: 0, error: msg };
  }
}

/** Convenience: evaluate and round to an integer (most game values are ints). */
export function evalInt(src: string, ctx: FormulaContext): number {
  return Math.round(evalFormula(src, ctx).value);
}

/** Validate a formula's syntax against a set of allowed variable names. */
export function validateFormula(src: string, allowedVars: string[]): string | null {
  const ctx: FormulaContext = {};
  for (const v of allowedVars) ctx[v] = 1;
  const r = evalFormula(src, ctx);
  return r.error;
}

/** Names of variables referenced by a formula (excludes function names). */
export function extractVars(src: string): string[] {
  let tokens: Token[];
  try {
    tokens = tokenize(src ?? '');
  } catch {
    return [];
  }
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t === 'ident') {
      const next = tokens[i + 1];
      const isFn = next && next.t === 'lparen';
      if (!isFn && !out.includes(t.v)) out.push(t.v);
    }
  }
  return out;
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'expr'; src: string; value: number; error: string | null; vars: { name: string; value: number }[] }
  | { kind: 'dmg'; src: string; parts: DmgPart[] };

// ── Damage-type expression parsing ───────────────────────────────────────────

function splitTopLevelPlus(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    else if (src[i] === '+' && depth === 0) {
      parts.push(src.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(src.slice(start).trim());
  return parts.filter((s) => s.length > 0);
}

function substituteVars(src: string, ctx: FormulaContext): string {
  return src.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m) =>
    Object.prototype.hasOwnProperty.call(ctx, m) ? String(Math.round(ctx[m])) : m,
  );
}

function evalGroupDisplay(terms: string[], ctx: FormulaContext): string {
  const joined = terms.filter((t) => t.trim()).join(' + ');
  if (!joined.trim()) return '';
  if (!/\d+d\d+/.test(joined)) {
    const r = evalFormula(joined, ctx);
    return r.error ? substituteVars(joined, ctx) : String(Math.round(r.value));
  }
  // Mixed dice + numeric: extract dice, evaluate the rest, combine
  const diceFound: string[] = [];
  const numericStr = joined.replace(/\d+d\d+/g, (m) => { diceFound.push(m); return '0'; });
  const r = evalFormula(numericStr, ctx);
  if (r.error) return substituteVars(joined, ctx);
  const numVal = Math.round(r.value);
  const dicePart = diceFound.join(' + ');
  if (numVal === 0) return dicePart;
  return numVal > 0 ? `${dicePart} + ${numVal}` : `${dicePart} - ${Math.abs(numVal)}`;
}

export function parseDmgExpr(src: string, ctx: FormulaContext, damageTypes: DmgTypeInfo[]): DmgPart[] {
  const typeMap = new Map<string, string>();
  for (const dt of damageTypes) typeMap.set(dt.name.toLowerCase(), dt.colour);

  const rawTerms = splitTopLevelPlus(src);
  const parsed: { numericText: string; colour?: string }[] = [];
  for (const term of rawTerms) {
    const words = term.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();
    if (typeMap.has(lastWord)) {
      parsed.push({ numericText: words.slice(0, -1).join(' ').trim(), colour: typeMap.get(lastWord) });
    } else {
      parsed.push({ numericText: term.trim() });
    }
  }

  const parts: DmgPart[] = [];
  let pending: string[] = [];
  for (const p of parsed) {
    pending.push(p.numericText);
    if (p.colour !== undefined) {
      const text = evalGroupDisplay(pending, ctx);
      if (text) parts.push({ text, colour: p.colour });
      pending = [];
    }
  }
  if (pending.some((t) => t.trim())) {
    const text = evalGroupDisplay(pending, ctx);
    if (text) parts.push({ text });
  }
  return parts.length ? parts : [{ text: substituteVars(src, ctx) }];
}

/**
 * Split text into literal + computed segments. Formulas are written inside
 * `{{ ... }}` (§3). Each computed segment carries its inputs for the breakdown.
 * Pass `damageTypes` to enable dice notation and damage-type coloring.
 */
export function interpolate(text: string, ctx: FormulaContext, damageTypes: DmgTypeInfo[] = []): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\{\{([^}]*)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const src = m[1].trim();

    const hasDice = /\d+d\d+/.test(src);
    const hasDmgType = damageTypes.some((dt) => new RegExp(`\\b${dt.name}\\b`, 'i').test(src));

    if (hasDice || hasDmgType) {
      const parts = parseDmgExpr(src, ctx, damageTypes);
      segments.push({ kind: 'dmg', src, parts });
    } else {
      const r = evalFormula(src, ctx);
      const vars = extractVars(src)
        .filter((n) => Object.prototype.hasOwnProperty.call(ctx, n))
        .map((n) => ({ name: n, value: ctx[n] }));
      segments.push({ kind: 'expr', src, value: r.value, error: r.error, vars });
    }
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/** True if the text contains at least one `{{ }}` formula. */
export function hasInterpolation(text: string): boolean {
  return /\{\{[^}]*\}\}/.test(text);
}
