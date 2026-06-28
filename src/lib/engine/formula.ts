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

export interface WeaponTerm {
  notation: string;
  typeName: string;
  colour: string;
}

export type WeaponDamageRefs = {
  main?: WeaponTerm[];
  side?: WeaponTerm[];
};

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

// ── Weapon damage reference expansion ────────────────────────────────────────

function scaleNotation(notation: string, factor: number): string {
  if (factor === 0) return '0';
  if (factor === 1) return notation;
  const scaledDice: string[] = [];
  const withoutDice = notation.replace(/(\d+)d(\d+)/gi, (_, c, s) => {
    scaledDice.push(`${Number(c) * factor}d${s}`);
    return '0';
  });
  const r = evalFormula(withoutDice || '0', {});
  const flat = (r.error ? 0 : Math.round(r.value)) * factor;
  let result = scaledDice.join('+');
  if (flat > 0) result = result ? `${result}+${flat}` : `${flat}`;
  else if (flat < 0) result = result ? `${result}${flat}` : `${flat}`;
  return result || '0';
}

export function serializeWeaponTerms(terms: WeaponTerm[], factor: number): string {
  if (!terms || !terms.length) return '0';
  return terms
    .map((t) => {
      const s = scaleNotation(t.notation, factor);
      return t.typeName !== 'untyped' ? `${s} ${t.typeName}` : s;
    })
    .join(' + ');
}

function expandWeaponRefs(src: string, refs: WeaponDamageRefs, ctx?: FormulaContext): string {
  const expand = (s: string, key: string, terms: WeaponTerm[] | undefined): string => {
    const t = terms ?? [];
    // numeric literal * key  or  key * numeric literal
    s = s.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*\\*\\s*\\b${key}\\b`, 'g'),
      (_, n) => serializeWeaponTerms(t, Number(n)));
    s = s.replace(new RegExp(`\\b${key}\\b\\s*\\*\\s*(\\d+(?:\\.\\d+)?)`, 'g'),
      (_, n) => serializeWeaponTerms(t, Number(n)));
    // variable * key  or  key * variable (resolved from ctx, e.g. {{aim * main}})
    if (ctx) {
      s = s.replace(new RegExp(`([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\*\\s*\\b${key}\\b`, 'g'),
        (_, id) => serializeWeaponTerms(t, Object.prototype.hasOwnProperty.call(ctx, id) ? Math.round(ctx[id]) : 0));
      s = s.replace(new RegExp(`\\b${key}\\b\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'),
        (_, id) => serializeWeaponTerms(t, Object.prototype.hasOwnProperty.call(ctx, id) ? Math.round(ctx[id]) : 0));
    }
    // bare key
    s = s.replace(new RegExp(`\\b${key}\\b`, 'g'),
      () => serializeWeaponTerms(t, 1));
    return s;
  };
  src = expand(src, 'main', refs.main);
  src = expand(src, 'side', refs.side);
  return src;
}

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
  // Mixed dice + numeric: extract and sum dice by face count, evaluate the rest
  const diceMap = new Map<number, number>();
  const numericStr = joined.replace(/(\d+)d(\d+)/gi, (_, c, s) => {
    diceMap.set(Number(s), (diceMap.get(Number(s)) ?? 0) + Number(c));
    return '0';
  });
  const r = evalFormula(numericStr, ctx);
  if (r.error) return substituteVars(joined, ctx);
  const numVal = Math.round(r.value);
  const dicePart = [...diceMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([faces, count]) => `${count}d${faces}`)
    .join(' + ');
  if (numVal === 0) return dicePart;
  return numVal > 0 ? `${dicePart} + ${numVal}` : `${dicePart} - ${Math.abs(numVal)}`;
}

/** Combine two already-rendered damage strings (same damage type) into one. */
function combineDiceText(a: string, b: string): string {
  const diceMap = new Map<number, number>();
  let flat = 0;
  for (const text of [a, b]) {
    const noisy = text.replace(/(\d+)d(\d+)/gi, (_, c, s) => {
      diceMap.set(Number(s), (diceMap.get(Number(s)) ?? 0) + Number(c));
      return '0';
    });
    const r = evalFormula(noisy || '0', {});
    flat += r.error ? 0 : Math.round(r.value);
  }
  const diceParts = [...diceMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([faces, count]) => `${count}d${faces}`);
  const diceStr = diceParts.join(' + ');
  if (!diceStr) return String(flat);
  if (flat === 0) return diceStr;
  return flat > 0 ? `${diceStr} + ${flat}` : `${diceStr} - ${Math.abs(flat)}`;
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
  const result = parts.length ? parts : [{ text: substituteVars(src, ctx) }];

  // Merge adjacent parts of the same colour (e.g. two slashing terms → one combined term)
  const merged: DmgPart[] = [];
  for (const p of result) {
    const last = merged[merged.length - 1];
    if (last && last.colour === p.colour) {
      last.text = combineDiceText(last.text, p.text);
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
}

/**
 * Split text into literal + computed segments. Formulas are written inside
 * `{{ ... }}` (§3). Each computed segment carries its inputs for the breakdown.
 * Pass `damageTypes` to enable dice notation and damage-type coloring.
 * Pass `weaponRefs` to enable `main`/`side` weapon damage references:
 *   {{main}}        — main weapon's damage
 *   {{2 * main}}    — doubled (e.g. 1d6+2 → 2d6+4)
 *   {{main + side}} — both weapons combined, same-type terms merged
 */
export function interpolate(text: string, ctx: FormulaContext, damageTypes: DmgTypeInfo[] = [], weaponRefs?: WeaponDamageRefs): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\{\{([^}]*)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const src = m[1].trim();

    const hasWeaponRef = !!weaponRefs && (/\bmain\b/.test(src) || /\bside\b/.test(src));
    const effectiveSrc = hasWeaponRef ? expandWeaponRefs(src, weaponRefs!, ctx) : src;

    const hasDice = /\d+d\d+/.test(effectiveSrc);
    const hasDmgType = damageTypes.some((dt) => new RegExp(`\\b${dt.name}\\b`, 'i').test(effectiveSrc));

    if (hasDice || hasDmgType || hasWeaponRef) {
      const parts = parseDmgExpr(effectiveSrc, ctx, damageTypes);
      segments.push({ kind: 'dmg', src, parts });
    } else {
      const r = evalFormula(effectiveSrc, ctx);
      const vars = extractVars(effectiveSrc)
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
