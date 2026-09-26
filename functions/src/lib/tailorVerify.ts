import type { SourceLine } from "./tailorSegment";

// Deterministic backstop for the tailored resume: the model proposes edits to
// numbered source lines, and this file decides which ones survive. A rewrite
// may only use facts (numbers, names, tools, degrees, seniority and ownership
// words) found in the source lines it cites. Anything else reverts to the
// original line, so a change is either applied whole or not at all.

export type TailorOpKind = "moveUp" | "cut" | "rephrase" | "surfaceKeyword";

export type TailorOp = {
  kind: TailorOpKind;
  lineIds: string[];
  // rephrase: the new line
  text: string;
  // surfaceKeyword: the term to list under Skills
  term: string;
  // Index into the match's requirements, -1 for none (cut only)
  requirement: number;
  reason: string;
};

export type RevertReason =
  | "unknown_line"
  | "locked_line"
  | "conflict"
  | "owner_mismatch"
  | "new_fact"
  | "too_long"
  | "no_requirement"
  | "no_change"
  | "empty_text"
  | "term_not_in_source"
  | "term_already_listed"
  | "qualified_source"
  | "others_work"
  | "dropped_specifier"
  | "dropped_qualifier"
  | "scope_change"
  | "job_word";

export type VerifiedOp = TailorOp & {
  index: number;
  status: "applied" | "reverted";
  revertReason?: RevertReason;
  // Facts in the rewrite that the cited lines don't state
  offendingTokens?: string[];
};

export type TailorVocabulary = {
  // Tools and skills named by the job (technologies and missingKeywords).
  // Any of them in a rewrite has to be in the cited lines too.
  terms: string[];
  // The job's requirement texts. A content word from them in a rewrite has
  // to be in the cited lines too.
  requirementTexts?: string[];
};

export const MAX_REPHRASE_GROWTH = 1.3;
// Short lines get a little slack so "Led X" → "Led X in Y" style edits of
// a two-word bullet aren't rejected on length alone
const MIN_LENGTH_ALLOWANCE = 24;

// Different spellings of one thing. Code applies these, never the model, so
// "Postgres" in the resume may become "PostgreSQL" to match the job's words.
const ALIASES: [canonical: string, variants: string[]][] = [
  ["postgresql", ["postgres", "postgre sql", "psql"]],
  ["javascript", ["js", "java script", "ecmascript"]],
  ["typescript", ["ts"]],
  ["kubernetes", ["k8s"]],
  ["node.js", ["nodejs", "node js", "node"]],
  ["react", ["react.js", "reactjs", "react js"]],
  ["vue", ["vue.js", "vuejs", "vue js"]],
  ["next.js", ["nextjs", "next js"]],
  ["go", ["golang"]],
  ["gcp", ["google cloud platform", "google cloud"]],
  ["aws", ["amazon web services"]],
  ["ml", ["machine learning"]],
  ["ai", ["artificial intelligence"]],
  ["nlp", ["natural language processing"]],
  ["llm", ["llms", "large language model", "large language models"]],
  ["ux", ["user experience"]],
  ["ui", ["user interface"]],
  ["c#", ["c sharp", "csharp"]],
  ["excel", ["microsoft excel", "ms excel"]],
  ["ci/cd", ["ci / cd", "cicd", "ci-cd"]],
  ["rest", ["restful"]],
  ["graphql", ["graph ql"]],
  ["saas", ["software as a service"]],
  ["b2b", ["business to business", "business-to-business"]],
  ["crm", ["customer relationship management"]],
  ["seo", ["search engine optimization"]],
  ["qa", ["quality assurance"]],
  ["a11y", ["accessibility"]],
];

const ALIAS_PATTERNS = ALIASES.flatMap(([canonical, variants]) =>
  variants
    .sort((a, b) => b.length - a.length)
    .map((variant) => ({
      pattern: new RegExp(`(?<![\\w.+#])${escapeRegExp(variant)}(?![\\w+#]|\\.\\w)`, "gi"),
      canonical,
    })),
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase, one spelling per alias, single spaces. */
export function canonicalize(text: string): string {
  let result = text.normalize("NFKC").toLowerCase();
  for (const { pattern, canonical } of ALIAS_PATTERNS) {
    result = result.replace(pattern, canonical);
  }
  return result.replace(/\s+/g, " ").trim();
}

// Word tokens, keeping the characters tool names use (c++, c#, node.js, ci/cd)
function wordsOf(canonicalText: string): string[] {
  return canonicalText
    .split(/[^a-z0-9+#./&'\-À-ɏЀ-ӿ]+/)
    .map((word) => word.replace(/^[.'/&-]+|[.'/&-]+$/g, "").replace(/'s$/, ""))
    .filter(Boolean);
}

export function containsPhrase(canonicalText: string, phrase: string): boolean {
  const needle = wordsOf(canonicalize(phrase)).join(" ");
  if (!needle) return false;
  return ` ${wordsOf(canonicalText).join(" ")} `.includes(` ${needle} `);
}

const SPELLED_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70",
  eighty: "80", ninety: "90", hundred: "100", dozen: "12",
  double: "x2", doubled: "x2", doubling: "x2", twice: "x2", triple: "x3", tripled: "x3",
  tripling: "x3", quadrupled: "x4", half: "x0.5", halved: "x0.5",
  once: "x1", dozens: "dozens", hundreds: "hundreds", thousands: "thousands", millions: "millions",
};

const MULTIPLIER_WORDS: Record<string, string> = {
  thousand: "k", million: "m", billion: "b", k: "k", m: "m", mm: "m", mn: "m", bn: "b", b: "b",
};

// Seniority, ownership, scope and credential words. A rewrite may not add one
// the cited lines don't have: "helped with" → "led" is an invented fact even
// though no new name or number appears.
const LEXICON: [family: string, pattern: RegExp][] = [
  ["lead", /^(led|lead|leads|leading|leader|leaders|leadership)$/],
  ["manage", /^(manage|managed|manages|managing|manager|managers|management)$/],
  ["own", /^(own|owned|owns|owning|owner|owners|ownership)$/],
  ["head", /^(head|headed|heads)$/],
  ["direct", /^(direct|directed|directs|directing|director|directors)$/],
  ["found", /^(founded|founder|founders|founding|co-founded|cofounded|co-founder|cofounder)$/],
  ["architect", /^(architect|architected|architecting|architects)$/],
  ["spearhead", /^spearhead(ed|ing|s)?$/],
  ["supervise", /^supervis(e|ed|es|ing|ion|or|ors)$/],
  ["oversee", /^(oversee|oversaw|overseen|oversees|overseeing|oversight)$/],
  ["mentor", /^mentor(ed|ing|s|ship)?$/],
  ["coach", /^coach(ed|es|ing)?$/],
  ["hire", /^(hire|hired|hiring|recruited|recruiting)$/],
  ["launch", /^launch(ed|es|ing)?$/],
  ["senior", /^(senior|sr|snr)$/],
  ["principal", /^principal$/],
  ["staff", /^staff$/],
  ["chief", /^(chief|cto|ceo|cfo|coo|cio|ciso)$/],
  ["vp", /^(vp|svp|evp)$/],
  ["executive", /^(executive|exec)$/],
  ["expert", /^(expert|experts|expertise|advanced|extensive|deep)$/],
  ["award", /^(award|awarded|awards|award-winning|winner|won)$/],
  ["patent", /^patent(ed|s)?$/],
  ["publish", /^(published|publication|publications|author|authored|co-authored)$/],
  ["certify", /^(certified|certification|certifications|certificate|accredited)$/],
  ["license", /^(licensed|license|licence|licenses|licences)$/],
  ["fluent", /^(fluent|fluency|native|bilingual|trilingual|proficient|proficiency)$/],
  ["degree", /^(bachelor|bachelors|master|masters|mba|phd|ph.d|doctorate|doctoral|bsc|msc|b.s|m.s|b.a|m.a|beng|meng|degree)$/],
  ["over", /^(over|exceeding|exceeded|exceeds|surpassing|surpassed)$/],
  ["nearly", /^(nearly|almost|approximately|approx|roughly|around)$/],
  ["atleast", /^least$/],
  ["top", /^(top|record|best|highest|largest|biggest|fastest|record-breaking)$/],
  ["sole", /^(sole|solely|single-handedly|alone|independently)$/],
  ["only", /^only$/],
  ["first", /^first$/],
  ["entire", /^(entire|entirely|every|whole|all)$/],
  ["global", /^(global|globally|worldwide|international|internationally|company-wide|org-wide|enterprise-wide)$/],
  // Intensifiers: "a busy 6-8 patient assignment" claims more than the line did
  ["busy", /^(busy|hectic)$/],
  ["high-volume", /^(high-volume|high-traffic|high-throughput|high-stakes|high-impact|high-profile)$/],
  ["fast-paced", /^(fast-paced|rapid|rapidly|fast-moving|fast-growing)$/],
  ["significant", /^(significant|significantly|substantial|substantially|considerable|considerably)$/],
  ["major", /^(major|massive|huge|enormous|vast|tremendous)$/],
  ["complex", /^(complex|complicated|sophisticated|intricate|challenging|demanding|intensive)$/],
  ["critical", /^(critical|mission-critical|business-critical|essential|vital|crucial)$/],
  ["large-scale", /^(large-scale|enterprise-scale|at-scale|scalable)$/],
  ["strategic", /^(strategic|strategically)$/],
  ["robust", /^(robust|seamless|seamlessly|cutting-edge|state-of-the-art|world-class|best-in-class)$/],
  ["highly", /^(highly|greatly|dramatically|drastically|vastly|hugely|exceptionally|exceptional|outstanding)$/],
  ["successful", /^(successful|successfully|proven|effective|effectively)$/],
  ["strong", /^(strong|strongly|solid|excellent|comprehensive|thorough|in-depth|superb)$/],
  ["numerous", /^(numerous|countless|many|multiple|various|extensive|extensively)$/],
];

const COMMON_CAPITALIZED = new Set([
  "i", "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "with", "by", "at", "as",
]);

// Ordinary words that often start a resume line. A capitalized word at the
// start of a line counts as a name unless it's -ed/-ing or listed here.
const COMMON_LINE_STARTS = new Set([
  "took", "ran", "drove", "grew", "built", "rebuilt", "cut", "set", "made", "wrote", "rewrote",
  "won", "kept", "brought", "taught", "sold", "gave", "held", "met", "put", "began", "became",
  "saw", "found", "sped", "shipped", "helped", "worked", "partnered", "each", "both", "most",
  "many", "this", "these", "our", "my", "across", "through", "using", "via", "from", "while",
  "within", "after", "before", "during", "when", "where", "responsible", "key", "hands-on",
]);

export type FactToken = string;

/**
 * Facts stated by a line, as comparable tokens: num:40, unit:%, mult:k,
 * lex:lead, word:kafka (names and tools), term:kubernetes (job vocabulary).
 * Numbers and lexicon words are matched case-insensitively; names and tools
 * are found by capitalization in the original text.
 */
export function factTokens(text: string, vocabulary: TailorVocabulary): Set<FactToken> {
  const facts = new Set<FactToken>();
  const canonical = canonicalize(text);

  for (const match of canonical.matchAll(/\d+(?:[.,]\d+)*/g)) {
    facts.add(`num:${normalizeNumber(match[0])}`);
  }
  if (/%|\bpercent\b|\bpct\b/.test(canonical)) facts.add("unit:%");
  for (const [symbol, name] of [["$", "usd"], ["€", "eur"], ["£", "gbp"]] as const) {
    if (canonical.includes(symbol) || new RegExp(`\\b${name}\\b`).test(canonical)) facts.add(`unit:${name}`);
  }
  if (/\d\s*\+/.test(canonical)) facts.add("unit:+");
  for (const match of canonical.matchAll(/\d(?:[.,]\d+)?\s?(k|m|mm|mn|bn|b|x)\b/g)) {
    facts.add(match[1] === "x" ? "mult:x" : `mult:${MULTIPLIER_WORDS[match[1]]}`);
  }

  for (const word of wordsOf(canonical)) {
    if (word in SPELLED_NUMBERS) {
      const value = SPELLED_NUMBERS[word];
      facts.add(value.startsWith("x") ? `mult:${value}` : `num:${value}`);
    }
    if (word === "thousand" || word === "million" || word === "billion") {
      facts.add(`mult:${MULTIPLIER_WORDS[word]}`);
    }
    for (const [family, pattern] of LEXICON) {
      if (pattern.test(word)) facts.add(`lex:${family}`);
    }
  }
  if (/\bmore than\b|\bupwards of\b/.test(canonical)) facts.add("lex:over");
  if (/\bup to\b/.test(canonical)) facts.add("lex:upto");
  if (/\bhigh (volume|traffic|throughput|stakes|impact|profile)\b/.test(canonical)) facts.add("lex:high-volume");
  if (/\bfast paced\b/.test(canonical)) facts.add("lex:fast-paced");
  if (/\blarge scale\b|\bat scale\b/.test(canonical)) facts.add("lex:large-scale");

  for (const word of namedWords(text)) facts.add(`word:${word}`);

  for (const term of vocabulary.terms) {
    if (term.trim() && containsPhrase(canonical, term)) facts.add(`term:${wordsOf(canonicalize(term)).join(" ")}`);
  }
  return facts;
}

function normalizeNumber(raw: string): string {
  // 1,000 and 1.000 as thousands; 1,5 as a decimal
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return raw.replace(/[.,]/g, "");
  return raw.replace(",", ".").replace(/\.0+$/, "");
}

/**
 * Words that look like names, tools or acronyms: capitalized mid-sentence,
 * or containing a digit, an inner capital, + or #. A capitalized word that
 * starts a sentence is ambiguous, so it's kept unless it reads as a verb
 * (-ed/-ing); the caller then only accepts it if the source has the word.
 */
function namedWords(text: string): string[] {
  const result: string[] = [];
  const tokens = text.normalize("NFKC").split(/\s+/).filter(Boolean);
  let sentenceStart = true;
  for (const token of tokens) {
    const word = token.replace(/^[^\w+#]+|[^\w+#]+$/g, "");
    const startsSentence = sentenceStart;
    sentenceStart = /[.!?:;]$/.test(token) || /^[•\-–—*]$/.test(token);
    if (!word) continue;
    const lower = word.toLowerCase();
    if (COMMON_CAPITALIZED.has(lower)) continue;
    const toolLike = /\d|[+#]/.test(word) || /^.+[A-Z]/.test(word);
    const capitalized = /^[A-ZÀ-ÞЀ-Я]/.test(word);
    if (!toolLike && !capitalized) continue;
    if (!toolLike && startsSentence && (/^[A-Z][a-z]+(ed|ing)$/.test(word) || COMMON_LINE_STARTS.has(lower))) {
      continue;
    }
    for (const part of wordsOf(canonicalize(word))) result.push(part);
  }
  return result;
}

/**
 * Facts in `text` that the source doesn't state. Names and tools are checked
 * against every word of the source (the resume may write them lowercase);
 * everything else against the source's own fact tokens.
 */
export function newFacts(
  text: string,
  sourceText: string,
  vocabulary: TailorVocabulary,
): string[] {
  const sourceFacts = factTokens(sourceText, vocabulary);
  const sourceCanonical = canonicalize(sourceText);
  // Raw words too: an alias like "Amazon Web Services" → "aws" must not hide
  // "Amazon" from a rewrite that keeps it
  const sourceWords = new Set([...wordsOf(sourceCanonical), ...wordsOf(sourceText.normalize("NFKC").toLowerCase())]);
  const missing: string[] = [];
  for (const fact of factTokens(text, vocabulary)) {
    if (fact.startsWith("word:")) {
      const word = fact.slice(5);
      if (!sourceWords.has(word) && !containsPhrase(sourceCanonical, word)) missing.push(fact);
    } else if (fact.startsWith("term:")) {
      if (!containsPhrase(sourceCanonical, fact.slice(5))) missing.push(fact);
    } else if (!sourceFacts.has(fact)) {
      missing.push(fact);
    }
  }
  return missing;
}

// Words that limit a claim. If the cited lines have one, the rewrite must
// keep it (or a word of the same family): dropping "informally", "a
// handful" or "no production use yet" makes a weak claim read strong.
const QUALIFIERS: [family: string, pattern: RegExp][] = [
  ["informal", /\b(informal|informally|casual|casually|ad hoc|ad-hoc|unofficial|unofficially)\b/],
  ["few", /\b(a handful|handful|a few|a couple|some|occasional|occasionally|sometimes|limited|small)\b/],
  ["basic", /\b(basic|basics|beginner|introductory|entry-level|foundational|fundamentals)\b/],
  ["learning", /\b(learning|learn|started|starting|began|beginning|studying|self-taught|exploring)\b/],
  ["not-shipped", /\b(no production|not in production|not deployed|never deployed|personal project|side project|hobby|course project|class project|kaggle|prototype|proof of concept)\b/],
  ["exposure", /\b(exposure|exposed|familiar|familiarity|awareness|aware|introduction)\b/],
  ["coursework", /\b(coursework|course|courses|non-degree|bootcamp|workshop|tutorial)\b/],
  ["assist", /\b(assisted|assisting|assist|assistant|helped|helping|help|supported|supporting|support|contributed|contributing|contribution|contributions|participated|participating|took part|part of|involved|member)\b/],
  ["candidate", /\b(candidate|pursuing|in progress|working toward|working towards|toward|towards|expected|ongoing|pending)\b/],
  ["approximate", /\b(approximately|approx|roughly|nearly|almost|~)\b/],
  ["frequency", /\b(once a|twice a|once per|per week|per month|a week|a month|as needed)\b/],
  ["cover", /\b(relief|backup|substitute|covering|cover for|stand-in|acting)\b/],
  ["partial", /\b(partial|partially|partly|some|part-time|temporary|temp|contract basis)\b/],
  ["junior", /\b(junior|intern|interns|internship|trainee|apprentice|apprenticeship|entry)\b/],
  ["attempt", /\b(tried|attempted|aimed|proposed|suggested|planned|drafted)\b/],
  ["observe", /\b(sat in on|sit in on|sits in on|attended|attend|attending|shadowed|shadowing|shadow|observed|observing|observe|watched|listened in)\b/],
];

// Qualifiers that describe how well the candidate knows a skill. A line with
// one can't put that skill under Skills. ("Supporting order processing" or
// "ad-hoc state" say nothing about skill level, so the other families don't
// count here.)
const SKILL_LEVEL_QUALIFIERS = new Set(["basic", "learning", "not-shipped", "exposure", "coursework", "candidate", "observe"]);

// Nouns for people. "the ML team" or "Salesforce admins" names someone
// else's work, not the candidate's skill.
const PEOPLE_NOUN = "(team|teams|squad|squads|group|groups|department|departments|org|organization|engineers|engineer|scientists|scientist|researchers|specialists|staff|colleagues|admins|administrators|analysts|consultants|contractors|vendor|vendors|partner|partners|experts|lead|leads|managers|people)";

/** True when the term appears in the line only as part of a name for other people. */
export function namesOthersWork(lineText: string, term: string): boolean {
  const line = canonicalize(lineText);
  const needle = wordsOf(canonicalize(term)).join(" ");
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const occurrences = line.match(new RegExp(`(?<![\\w+#.])${escaped}(?![\\w+#])`, "g"))?.length ?? 0;
  const asPeople = line.match(new RegExp(`(?<![\\w+#.])${escaped}(?:\\s+[a-z-]+)?\\s+${PEOPLE_NOUN}\\b`, "g"))?.length ?? 0;
  return occurrences > 0 && asPeople >= occurrences;
}

/**
 * A modifier the rewrite drops from a noun it keeps: "the invoice API" →
 * "the API" turns one API into all of them.
 */
export function droppedSpecifiers(text: string, sourceText: string): string[] {
  const source = wordsOf(canonicalize(sourceText)).join(" ");
  const rewrite = ` ${wordsOf(canonicalize(text)).join(" ")} `;
  const dropped: string[] = [];
  for (const [, modifier, noun] of source.matchAll(/\b(?:the|a|an|our|their)\s+([a-z][a-z-]*)\s+([a-z0-9][a-z0-9.+#-]*)/g)) {
    if (rewrite.includes(` ${modifier} `)) continue;
    if (new RegExp(` (?:the|a|an|our|their) ${noun.replace(/[.+#]/g, "\\$&")} `).test(rewrite)) dropped.push(`specifier:${modifier} ${noun}`);
  }
  return dropped;
}

/**
 * Scope the rewrite quietly widens: a number from the source that it drops
 * ("managed two writers" → "managed writers"), or a noun it turns plural
 * ("the budget" → "budgets").
 */
export function scopeChanges(text: string, sourceText: string): string[] {
  const noVocabulary = { terms: [] };
  const rewriteFacts = factTokens(text, noVocabulary);
  const droppedNumbers = [...factTokens(sourceText, noVocabulary)]
    .filter((fact) => (fact.startsWith("num:") || fact.startsWith("mult:")) && !rewriteFacts.has(fact))
    .map((fact) => `dropped-${fact}`);

  const sourceWords = new Set(wordsOf(canonicalize(sourceText)));
  const plurals = [...new Set(wordsOf(canonicalize(text)))]
    .filter((word) => /^[a-z-]{3,}s$/.test(word) && !sourceWords.has(word))
    .filter((word) => [word.slice(0, -1), word.replace(/ies$/, "y"), word.replace(/es$/, "")].some((singular) => sourceWords.has(singular)))
    .map((word) => `plural:${word}`);
  return [...droppedNumbers, ...plurals];
}

/** Qualifier families the source states that the rewrite drops. */
export function droppedQualifiers(text: string, sourceText: string): string[] {
  const rewrite = canonicalize(text);
  const source = canonicalize(sourceText);
  return QUALIFIERS.filter(([, pattern]) => pattern.test(source) && !pattern.test(rewrite)).map(([family]) => `qual:${family}`);
}

// Requirement words that say nothing on their own
const GENERIC_JOB_WORDS = new Set(
  ("experience experienced years year strong ability able skills skill working work knowledge understanding " +
    "including related field similar least plus preferred required requirement proven track record excellent " +
    "solid hands-on level professional environment environments teams team other their based using within " +
    "across tools tool must nice have with from into like such well good great familiarity comfortable " +
    "demonstrated background equivalent relevant role roles practices practice concepts principles").split(" "),
);

const stemOf = (word: string) => (word.length >= 6 ? word.slice(0, 5) : word);

/**
 * Content words from the job's requirements that the rewrite adds but the
 * cited lines don't state (compared by a 5-letter stem, so "prediction"
 * supports "predictive"). Stops a rewrite from stitching the job's wording
 * onto a line: "on-call rotation" must not become "on-call for
 * customer-facing services" because another bullet mentions them.
 */
export function unsupportedJobWords(text: string, citedText: string, requirementTexts: string[]): string[] {
  const jobWords = new Set(
    requirementTexts.flatMap((requirement) => wordsOf(canonicalize(requirement))).filter(
      (word) => word.length >= 4 && !GENERIC_JOB_WORDS.has(word) && !/^\d/.test(word),
    ),
  );
  const cited = new Set(wordsOf(canonicalize(citedText)).map(stemOf));
  return [...new Set(wordsOf(canonicalize(text)))]
    .filter((word) => jobWords.has(word) && !cited.has(stemOf(word)))
    .map((word) => `job:${word}`);
}

type VerifyContext = {
  lines: SourceLine[];
  vocabulary: TailorVocabulary;
  requirementCount: number;
};

const cleanText = (value: string) => value.replace(/\s+/g, " ").replace(/^[•●▪\-–—*]\s*/, "").trim();

/**
 * Checks every proposed edit against the source lines. The first edit to
 * claim a line wins; later ones on the same line revert as conflicts.
 */
export function verifyTailorOps(ops: TailorOp[], context: VerifyContext): VerifiedOp[] {
  const byId = new Map(context.lines.map((line) => [line.id, line]));
  const cutIds = new Set<string>();
  const rephrasedIds = new Set<string>();
  // Second line of a two-line rephrase: merged away
  const consumedIds = new Set<string>();
  const movedIds = new Set<string>();
  const surfaced = new Set<string>();
  const gone = (id: string) => cutIds.has(id) || consumedIds.has(id);

  return ops.map((op, index) => {
    const revert = (reason: RevertReason, offendingTokens?: string[]): VerifiedOp => ({
      ...op,
      index,
      status: "reverted",
      revertReason: reason,
      ...(offendingTokens ? { offendingTokens } : {}),
    });
    const apply = (): VerifiedOp => ({ ...op, index, status: "applied" });

    const cited = op.lineIds.map((id) => byId.get(id));
    if (cited.length === 0 || cited.some((line) => !line)) return revert("unknown_line");
    const sourceLines = cited as SourceLine[];
    if (sourceLines.some((line) => line.role !== "bullet")) return revert("locked_line");

    const hasRequirement =
      Number.isInteger(op.requirement) && op.requirement >= 0 && op.requirement < context.requirementCount;
    if (op.kind !== "cut" && !hasRequirement) return revert("no_requirement");

    switch (op.kind) {
    case "moveUp": {
      const [line] = sourceLines;
      if (sourceLines.length !== 1) return revert("unknown_line");
      if (movedIds.has(line.id) || gone(line.id)) return revert("conflict");
      movedIds.add(line.id);
      return apply();
    }
    case "cut": {
      const [line] = sourceLines;
      if (sourceLines.length !== 1) return revert("unknown_line");
      if (gone(line.id) || rephrasedIds.has(line.id) || movedIds.has(line.id)) return revert("conflict");
      cutIds.add(line.id);
      return apply();
    }
    case "rephrase": {
      if (sourceLines.length > 2 || new Set(op.lineIds).size !== op.lineIds.length) return revert("unknown_line");
      if (sourceLines.some((line) => gone(line.id) || rephrasedIds.has(line.id))) return revert("conflict");
      if (sourceLines.slice(1).some((line) => movedIds.has(line.id))) return revert("conflict");
      if (new Set(sourceLines.map((line) => line.owner)).size > 1) return revert("owner_mismatch");
      const text = cleanText(op.text);
      if (!text) return revert("empty_text");
      const sourceText = sourceLines.map((line) => line.text).join(" ");
      if (text.toLowerCase() === sourceText.toLowerCase()) return revert("no_change");
      const allowed = Math.max(sourceText.length * MAX_REPHRASE_GROWTH, sourceText.length + MIN_LENGTH_ALLOWANCE);
      if (text.length > allowed) return revert("too_long");
      const invented = newFacts(text, sourceText, context.vocabulary);
      if (invented.length) return revert("new_fact", invented);
      const dropped = droppedQualifiers(text, sourceText);
      if (dropped.length) return revert("dropped_qualifier", dropped);
      const unspecified = droppedSpecifiers(text, sourceText);
      if (unspecified.length) return revert("dropped_specifier", unspecified);
      const widened = scopeChanges(text, sourceText);
      if (widened.length) return revert("scope_change", widened);
      const borrowed = unsupportedJobWords(text, sourceText, context.vocabulary.requirementTexts ?? []);
      if (borrowed.length) return revert("job_word", borrowed);
      rephrasedIds.add(sourceLines[0].id);
      sourceLines.slice(1).forEach((line) => consumedIds.add(line.id));
      return { ...apply(), text };
    }
    case "surfaceKeyword": {
      const [line] = sourceLines;
      const term = cleanText(op.term);
      if (sourceLines.length !== 1 || !term) return revert("empty_text");
      if (!containsPhrase(canonicalize(line.text), term)) return revert("term_not_in_source");
      // "Started learning Python" doesn't make Python a skill to list
      const qualifiers = QUALIFIERS.filter(
        ([family, pattern]) => SKILL_LEVEL_QUALIFIERS.has(family) && pattern.test(canonicalize(line.text)),
      ).map(([family]) => `qual:${family}`);
      if (qualifiers.length) return revert("qualified_source", qualifiers);
      if (namesOthersWork(line.text, term)) return revert("others_work");
      const key = wordsOf(canonicalize(term)).join(" ");
      const skills = skillsSectionText(context.lines);
      const overlaps = [...surfaced].some((listed) => containsPhrase(listed, key) || containsPhrase(key, listed));
      if (overlaps || (skills !== null && containsPhrase(canonicalize(skills), term))) {
        return revert("term_already_listed");
      }
      surfaced.add(key);
      return { ...apply(), term };
    }
    default:
      return revert("unknown_line");
    }
  });
}

const SKILLS_HEADING = /skill|competenc|technolog|tools|stack/i;
const INTRO_HEADING = /summary|profile|about|objective/i;

export function skillsSectionText(lines: SourceLine[]): string | null {
  const heading = lines.find((line) => line.role === "heading" && SKILLS_HEADING.test(line.text));
  if (!heading) return null;
  return lines
    .filter((line) => line.section === heading.id && line.id !== heading.id)
    .map((line) => line.text)
    .join(" ");
}

export type DocLine = {
  text: string;
  bullet: boolean;
  kind: "original" | "rephrased" | "surfaced";
  // Source line ids this line comes from
  sourceIds: string[];
  // The edit that produced or moved it
  opIndex?: number;
};

export type DocSection = {
  heading: string | null;
  lines: DocLine[];
};

export type TailoredDoc = { sections: DocSection[] };

/**
 * Builds the final resume from the source lines and the applied edits. Every
 * line that no edit touched is the source text, byte for byte. `excluded`
 * holds edit indexes the user switched off.
 */
export function assembleTailoredResume(
  lines: SourceLine[],
  verified: VerifiedOp[],
  sectionOrder: string[],
  excluded: ReadonlySet<number> = new Set(),
): TailoredDoc {
  const active = verified.filter((op) => op.status === "applied" && !excluded.has(op.index));
  const cut = new Set(active.filter((op) => op.kind === "cut").map((op) => op.lineIds[0]));
  const rephrasedBy = new Map<string, VerifiedOp>();
  const consumed = new Set<string>();
  for (const op of active.filter((candidate) => candidate.kind === "rephrase")) {
    rephrasedBy.set(op.lineIds[0], op);
    op.lineIds.slice(1).forEach((id) => consumed.add(id));
  }
  const moveRank = new Map<string, number>();
  active.filter((op) => op.kind === "moveUp").forEach((op, rank) => moveRank.set(op.lineIds[0], rank));
  const movedBy = new Map(active.filter((op) => op.kind === "moveUp").map((op) => [op.lineIds[0], op.index]));

  const toDocLine = (line: SourceLine): DocLine => {
    const rephrase = rephrasedBy.get(line.id);
    if (rephrase) {
      return { text: rephrase.text, bullet: line.bullet, kind: "rephrased", sourceIds: rephrase.lineIds, opIndex: rephrase.index };
    }
    const moveIndex = movedBy.get(line.id);
    return {
      text: line.text,
      bullet: line.bullet,
      kind: "original",
      sourceIds: [line.id],
      ...(moveIndex !== undefined ? { opIndex: moveIndex } : {}),
    };
  };

  // Bullets under one owner, moved ones first (in edit order), then the rest
  // in source order. Owners (job headers) never move.
  const sectionLines = (sectionId: string | null): DocLine[] => {
    const members = lines.filter(
      (line) => line.section === sectionId && line.id !== sectionId && !cut.has(line.id) && !consumed.has(line.id),
    );
    const result: DocLine[] = [];
    let group: SourceLine[] = [];
    const flush = () => {
      const rank = (line: SourceLine) => moveRank.get(line.id) ?? 0;
      const moved = group.filter((line) => moveRank.has(line.id)).sort((a, b) => rank(a) - rank(b));
      const rest = group.filter((line) => !moveRank.has(line.id));
      result.push(...[...moved, ...rest].map(toDocLine));
      group = [];
    };
    for (const line of members) {
      if (line.role === "bullet") {
        if (group.length && group[0].owner !== line.owner) flush();
        group.push(line);
      } else {
        flush();
        result.push(toDocLine(line));
      }
    }
    flush();
    return result;
  };

  const headings = lines.filter((line) => line.role === "heading");
  const headingIds = new Set(headings.map((line) => line.id));
  const order =
    sectionOrder.length === headings.length &&
    new Set(sectionOrder).size === sectionOrder.length &&
    sectionOrder.every((id) => headingIds.has(id))
      ? sectionOrder
      : headings.map((line) => line.id);
  const byId = new Map(lines.map((line) => [line.id, line]));

  const sections: DocSection[] = [];
  const top = sectionLines(null);
  if (top.length) sections.push({ heading: null, lines: top });
  for (const id of order) {
    sections.push({ heading: byId.get(id)?.text ?? null, lines: sectionLines(id) });
  }

  const surfaced = active.filter((op) => op.kind === "surfaceKeyword");
  if (surfaced.length) {
    const line: DocLine = {
      text: surfaced.map((op) => op.term).join(", "),
      bullet: false,
      kind: "surfaced",
      sourceIds: surfaced.map((op) => op.lineIds[0]),
    };
    const skills = sections.find((section) => section.heading && SKILLS_HEADING.test(section.heading));
    if (skills) {
      skills.lines.push(line);
    } else {
      // No Skills section: add one near the top, after the summary if any
      const introIndex = sections.findIndex((section) => section.heading && INTRO_HEADING.test(section.heading));
      const insertAt = introIndex >= 0 ? introIndex + 1 : top.length ? 1 : 0;
      sections.splice(insertAt, 0, { heading: "Skills", lines: [line] });
    }
  }

  return { sections: sections.filter((section) => section.lines.length || section.heading === null) };
}

export type TailorStats = {
  proposed: number;
  applied: number;
  reverted: number;
  byReason: Partial<Record<RevertReason, number>>;
};

export function tailorStats(verified: VerifiedOp[]): TailorStats {
  const byReason: Partial<Record<RevertReason, number>> = {};
  for (const op of verified) {
    if (op.revertReason) byReason[op.revertReason] = (byReason[op.revertReason] ?? 0) + 1;
  }
  const applied = verified.filter((op) => op.status === "applied").length;
  return { proposed: verified.length, applied, reverted: verified.length - applied, byReason };
}
