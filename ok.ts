module hack {
    export function __eval__(expr: string, bindings: { [key:string]:string }): string {
        let captures = {
            ...bindings,
            min: Math.min,
            max: Math.max,
            abs: Math.abs,
            sin: (d:number) => Math.sin(d/180*Math.PI),
            cos: (d:number) => Math.cos(d/180*Math.PI),
        };
        let args = Object.keys(captures);
        let fn = Function(...args, `return ${expr}`);
        return String(fn(
            ...args.map(arg => {
                if (isNaN(Number(captures[arg]))) {
                    return captures[arg];
                }
                return Number(captures[arg]);
            })
        ));
    }
}

function assert(bln:boolean, msg:string = ''): void {
    if (!bln) throw "Assert failed! " + msg;
}

type Bindings = { [key: string]: string };

enum Word {
    Simple, Var, Expr
}

class Fact {
    words: string[] = [];
    types: Word[] = [];

    // Applies the provided bindings to create a simple fact out
    // of a...normal fact?
    simple(bindings: Bindings = {}): SimpleFact {
        return runner.simplify(this, bindings);
    }
}

class Rule {
    predicate: Fact[];
    result: Fact[];

    // Creates a human readable version of the rule, w/ bindings
    // included.
    traceString(bindings: Bindings = {}): string {
        return `${englishify.rule(this)}
(
${englishify.boundRule(this, bindings)}
)`;
    }
}

type SimpleFact = string[]; // Used for the env

type Env = { [key: string]: SimpleFact };

export module parse {

    function findstr(haystack: string, needle: string, idx: number): number {
        idx = haystack.indexOf(needle, idx);
        return idx == -1 ? haystack.length : idx;
    }

    function skipSpaces(str: string, idx: number): number {
        // yes this is hokey
        for (; idx < str.length && str.charCodeAt(idx) <= 32; idx++);
        return idx;
    }

    function skipNonSpaces(str:string, idx:number):number {
        for (; idx < str.length && str.charCodeAt(idx) > 32; idx++);
        return idx;
    }

    // Script contains interleaved Rules + SimpleFacts
    export function parseScript(str: string): Array<SimpleFact | Rule> {
        let result: Array<SimpleFact | Rule> = [];

        let idx: number = skipSpaces(str, 0);
        while (idx < str.length) {
            let [nextIdx, facts] = parseFacts(str, idx);

            // Next thing should be either a period . or an arrow =>
            if (str.startsWith('.', nextIdx)) {
                result.push(...facts.map(fact => fact.simple()));

                // Skip past the period
                idx = skipSpaces(str, nextIdx + 1);
            }
            else if (str.startsWith('=>', nextIdx)) {
                const rule = new Rule();
                rule.predicate = facts;

                // Skip past the =>
                idx = skipSpaces(str, nextIdx + 2);

                // Grab the result facts
                [nextIdx, facts] = parseFacts(str, idx);

                // A rule definition should end with a period
                if (str.startsWith('.', nextIdx)) {
                    rule.result = facts;
                    result.push(rule);

                    // Skip past the period
                    idx = skipSpaces(str, nextIdx + 1);
                } else {
                    assert(false, `Expected period to end rule: ${str.substring(idx, nextIdx)}`); // Bad syntax!
                }
            }
            else if (nextIdx == str.length) {
                // OK, we're just done processing the script. Be
                // ok w/out a terminating period!
            }
            else {
                assert(false, `Expected period or arrow (or end-of-input!)`);
            }
        }

        return result;
    }
    
    export function parseFacts(str: string, idx: number = 0): [number, Fact[]] {
        let facts: Fact[] = [];
        let current: Fact = new Fact();

        idx = skipSpaces(str, idx);
        while (idx < str.length) {
            let nextIdx = nextThing(str, idx);

            let thing = str.substring(idx, nextIdx).trim();
            if (thing == ',') {
                facts.push(current);
                current = new Fact();
            }
            else if (thing == '=>') {
                break;
            }
            else if (thing == '.') {
                break;
            }
            else if (thing.startsWith('(')) {
                // This is a comment, just skip over it.
            }
            else if (thing.startsWith('$(')) {
                current.words.push(thing.substring(2, thing.length-1));
                current.types.push(Word.Expr);
            }
            else if (thing.startsWith('$')) {
                current.words.push(thing.substring(1));
                current.types.push(Word.Var);
            }
            else if (thing.startsWith('[[')) {
                current.words.push(thing.substring(2, thing.length-2));
                current.types.push(Word.Simple);
            }
            else {
                current.words.push(thing);
                current.types.push(Word.Simple);
            }

            idx = nextIdx;
        }

        if (current.words.length) facts.push(current);
        
        return [idx, facts];
    }

    // Skip ahead until you find a significant token
    function nextThing(str: string, idx: number): number {
        if (str.startsWith('$(', idx)) {
            return skipSpaces(str, takeExpr(str, idx));
        }
        if (str.startsWith('$', idx)) {
            return skipSpaces(str, takeVar(str, idx));
        }
        if (str.startsWith('(', idx)) {
            return skipSpaces(str, takeComment(str, idx));
        }
        if (str.startsWith('[[', idx)) {
            return skipSpaces(str, takeQuote(str, idx));
        }
        if (str.startsWith('=>', idx)) {
            return skipSpaces(str, idx + 2);
        }
        if (str.startsWith(',', idx)) {
            return skipSpaces(str, idx + 1);
        }
        if (str.startsWith('.', idx)) {
            return skipSpaces(str, idx + 1);
        }
        return skipSpaces(str, takeWord(str, idx));
    }

    function nextSplitPoint(str:string, idx:number):number {
        // What's the index of the next word/token start?
        return Math.min(
            skipNonSpaces(str, idx),
            findstr(str, ',', idx),
            findstr(str, '.', idx),
            findstr(str, '=>', idx), // rule definition
            findstr(str, '$', idx),  // either a var or expr
            findstr(str, '[[', idx), // quoted word
            findstr(str, '(', idx),  // comment
        );
    }
    
    // Pulls a simple word
    function takeWord(str: string, idx: number): number {
        return nextSplitPoint(str, idx);
    }

    function takeVar(str: string, idx: number): number {
        assert(str.startsWith('$', idx), `takeVar called but str doesn't start with $`);
        return takeWord(str, idx + 1);
    }

    // [[some stuff]]
    function takeQuote(str: string, idx: number): number {
        assert(str.startsWith('[[', idx), `takeQuote called but str doesn't start with [[`);

        idx += 2;
        let depth = 1;
        while (idx < str.length && depth) {
            if (str.startsWith('[[', idx)) {
                depth++;
                idx += 2;
            } else if (str.startsWith(']]', idx)) {
                depth--;
                idx += 2;
            } else {
                idx++;
            }
        }

        assert(!depth, `Missing closing ]] for quoted word`);

        return idx;
    }

    // (a comment)
    function takeComment(str: string, idx: number): number {
        assert(str.startsWith('(', idx), `takeComment called but str doesn't start with (`);

        idx++;                  // skip the intial opening paren
        let depth;
        for (depth = 1; idx < str.length && depth; idx++) {
            if (str.startsWith('(', idx)) {
                depth++;
            } else if (str.startsWith(')', idx)) {
                depth--;
            }
        }

        assert(!depth, `Missing closing )`);
        return idx;
    }

    // $(an expression)
    function takeExpr(str: string, idx: number): number {
        assert(str.startsWith('$(', idx), `takeExpr called but str doesn't start with $(`);
        return takeComment(str, idx+1);
    }
}

// This is like, the opposite of the parse module
export module englishify {
    export function simpleFact(fact: SimpleFact): string {
        return fact.map(
            word => word.match(/\s/) ? `[[${word}]]` : word
        ).join(' ');
    }

    export function rule(rule: Rule): string {
        function repr(fact: Fact): string {
            return fact.words.map((word, idx) => {
                const type = fact.types[idx];
                if (type == Word.Simple && word.match(/\s+/)) return `[[${word}]]`;
                if (type == Word.Simple) return word;
                if (type == Word.Var) return `$${word}`;
                if (type == Word.Expr) return `$(${word})`;
                assert(false);
            }).join(' ');
        }
        let pstr = rule.predicate.map(repr).join(', ');
        let fstr = rule.result.map(repr).join(',\n  ');
        

        if (fstr.length) {
            return `${pstr} =>\n  ${fstr}.`;
        } else {
            return `${pstr} =>.`;
        }
    }

    export function boundRule(rule: Rule, bindings: Bindings): string {
        function repr(fact: Fact): string {
            return fact.words.map((word, idx) => {
                const type = fact.types[idx];
                if (type == Word.Simple && word.match(/\s+/)) return `[[${word}]]`;
                if (type == Word.Simple) return word;
                if (type == Word.Var) return `${bindings[word]}`;
                if (type == Word.Expr) return `${hack.__eval__(word, bindings)}`;
                assert(false);
            }).join(' ');
        }
        let pstr = rule.predicate.map(repr).join(', ');
        let fstr = rule.result.map(repr).join(',\n  ');

        if (fstr.length) {
            return `${pstr} =>\n  ${fstr}.`;
        } else {
            return `${pstr} =>.`;
        }
    }
}

export module runner {

    let gensym_idx = 0;
    function gensym() {
        return `__sym${gensym_idx++}`;
    }

    // This might modify bindings, if gensym is used
    export function simplify(fact: Fact, bindings: Bindings): SimpleFact {
        return fact.words.map((word, idx) => {
            const type = fact.types[idx];
            if (type == Word.Simple) return word;
            if (type == Word.Var) return bindings[word] = bindings[word] ?? gensym();
            if (type == Word.Expr) return hack.__eval__(word, bindings);
            assert(false);
        });
    }

    export function match(fact: SimpleFact, test: Fact, bindings: Bindings): Bindings | false {
        if (fact.length != test.words.length) return false;

        // Make sure we modify a copy, and not the original
        bindings = {...bindings};
        
        for (let idx=0; idx<fact.length; idx++) {
            let test_word;

            switch (test.types[idx]) {
                case Word.Simple:
                    test_word = test.words[idx];
                    break;
                    
                case Word.Var:
                    if (bindings[test.words[idx]] === undefined) {
                        test_word = bindings[test.words[idx]] = fact[idx];
                    } else {
                        test_word = bindings[test.words[idx]];
                    }
                    break;
                    
                case Word.Expr:
                    test_word = hack.__eval__(test.words[idx], bindings);
                    break;
            }

            if (test_word != fact[idx]) return false;
        }

        return bindings;
    }

    export function select(env: Env, predicate: Fact[]): Bindings | false {

        // [ fact1idx, fact2idx, ..., factNidx ]
        // [ b1, b1+b2, ..., b1+b2+...+bN ]

        const facts: SimpleFact[] = Object.values(env);
        let idxs: number[] = [0];
        let bindings: Bindings[] = [{}];

        let px = 0;
        while (px<predicate.length) {
            const pred = predicate[px];
            
            let bs: Bindings = bindings[px];
            let fx = idxs.pop();
            
            for (; fx<facts.length; fx++) {
                // Should I be able to match the same rule twice
                // in the same predicate? Right now it's no,
                // but...?
                if (idxs.includes(fx)) continue;
                
                const result = runner.match(facts[fx], pred, bs);
                if (result) {
                    idxs[px] = fx; // remember the current fact index, in case we need to backtrack...
                    px++;          // let's move onto the next predicate
                    idxs[px] = 0;  // start looking at the first fact
                    bindings[px] = {...result}; // next predicate should start with our updated bindings
                    break;
                }
            }

            if (fx == facts.length) {
                if (px == 0) return false;
                bindings.length = px;
                idxs.length = px;
                px--;
                idxs[px]++; // we know the given fact doesn't work, so try the next
            }
        }

        idxs.pop(); // Ignore the last value, we put one-too-many on the array

        // Remove any matched facts from our environment
        for (let fx of idxs) {
            const key = EnvironmentKey(facts[fx]);
            delete env[key];
        }

        return bindings.pop();
    }

    // Add facts to the provided environment all at once
    export function declare(
        env: Env, facts: Fact[], bindings: Bindings = {}
    ): void {
        for (let fact of facts) {
            const simple = fact.simple(bindings);
            env[EnvironmentKey(simple)] = simple;
        }
    }

    // Tries to apply a rule from `program` against `env`. Returns
    // true if successful, false if no rules work.
    export function tick(env: Env, program: Array<SimpleFact|Rule>): boolean {
        for (let x of program) {
            if (x instanceof Rule) {
                // Try to apply the rule. If it matches the
                // predicate...
                const bindings = runner.select(env, x.predicate);
                if (bindings) {

                    // ...then we declare the new facts...
                    runner.declare(env, x.result, bindings);

                    // ...and notify that we were able to
                    // apply a rule.
                    return true;
                }
            } else {
                env[EnvironmentKey(x)] = x;
            }
        }
        
        return false;
    }

    export function trace(env: Env, program: Array<SimpleFact|Rule>): string {
        for (let x of program) {
            if (x instanceof Rule) {
                const bindings = runner.select(env, x.predicate);
                if (bindings) {
                    runner.declare(env, x.result, bindings);
                    return x.traceString(bindings);
                }
            } else {
                env[EnvironmentKey(x)] = x;
            }
        }
        
        return null;
    }

    export function run(env: Env, program: Array<SimpleFact|Rule>): boolean {
        let any_success = false;
        while (tick(env, program)) {
            any_success = true;
        }
        return any_success;
    }

    export function put(
        env: Env, facts: Fact[], script: Array<SimpleFact|Rule>
    ): void {
        let bindings: Bindings = {};
        for (let fact of facts) {
            const simple = fact.simple(bindings);
            env[EnvironmentKey(simple)] = simple;
            while (tick(env, script));
        }
    }
}

// Generate a canonical representation for a simple fact
function EnvironmentKey(fact: SimpleFact): string {
    return fact.map(w => '[[' + w + ']]').join(' ');
}

export function select(env: Env, predicate_str: string): Bindings | false {
    let [remainder, predicate] = parse.parseFacts(predicate_str);
    // assert(remainder == predicate_str.length, 'select');
    return runner.select(env, predicate);
}

export function put(env: Env, facts_str: string, bindings: Bindings = {}): void {
    let [end, facts] = parse.parseFacts(facts_str);
    // assert(end == facts_str.length, 'put ' + facts_str);
    return runner.declare(env, facts, bindings);
}

type MatchFn = ((object) => string) | ((object) => void);

export function match(env: Env, predicate_str: string, onMatch: MatchFn): boolean {
    const bindings = select(env, predicate_str);
    if (bindings) {
        const facts_str = onMatch(bindings);
        put(env, facts_str || '', bindings);
        return true;
    }
    return false;
}

export function matchAll(env: Env, predicate_str: string, onMatch: MatchFn): boolean {
    let [end, predicate] = parse.parseFacts(predicate_str);
    let any_matched = false;
    let bindings;
    while (bindings = runner.select(env, predicate)) {
        any_matched = true;
        const facts_str = onMatch(bindings);
        put(env, facts_str || '', bindings);
    }
    return any_matched;
}

// Returns true if a rule was applied
export function tick(env: Env, script_str: string): boolean {
    let script = parse.parseScript(script_str || '');
    return runner.tick(env, script);
}

// Returns true if any rules were applied, false if it was a noop
export function apply(env: Env, script_str: string): boolean {
    let script = parse.parseScript(script_str || '');

    let noop = true;
    while (runner.tick(env, script)) {
        noop = false;
    }
    return !noop;
}

export function dump(env: Env): void {
    console.log(Object.values(env).sort());
}

export function clear(env: Env): void {
    for (let k in env) {
        delete env[k];
    }
}

// In case you're into this sort of thing :^/
export class Runner {
    env: Env = {};
    script: Array<SimpleFact|Rule> = [];
    plugins: Plugin[] = [];

    clear(): Runner {
        clear(this.env);
        this.script = [];
        return this;
    }

    load(script_str: string): Runner {
        this.script.push(...parse.parseScript(script_str));
        return this;
    }

    put(facts_str: string): Runner {
        put(this.env, facts_str, {});
        return this;
    }

    select(predicate_str: string): Bindings | false {
        return select(this.env, predicate_str);
    }

    match(predicate_str: string, on_match: MatchFn): boolean {
        return match(this.env, predicate_str, on_match);
    }

    matchAll(predicate_str: string, on_match: MatchFn): boolean {
        return matchAll(this.env, predicate_str, on_match);
    }

    run(script_str?: string): Runner {
        runner.run(
            this.env,
            script_str ? parse.parseScript(script_str) : this.script
        );
        return this;
    }

    tick(script_str?: string): boolean {
        return runner.tick(
            this.env,
            script_str ? parse.parseScript(script_str) : this.script
        );
    }

    trace(script_str?: string): string {
        return runner.trace(
            this.env,
            script_str ? parse.parseScript(script_str) : this.script
        );
    }

    dump(): Runner {
        console.log(Object.values(this.env));
        return this;
    }

    facts(): string[] {
        return Object.values(this.env).map(englishify.simpleFact);
    }

    rules(): string[] {
        return this.script.map(thing => {
            if (thing instanceof Rule) {
                return englishify.rule(thing);
            }
            return englishify.simpleFact(thing);
        });
    }
}

