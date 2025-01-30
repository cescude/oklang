import * as readline from "readline";
import * as fs from "fs";
import * as ok from "./ok";

const runner = new ok.Runner();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'ok> ',
});

const cmds = {
    ',load': filename => {
        runner.load(fs.readFileSync(filename, "utf8"));
    },
    ',clear': () => {
        runner.clear();
    },
    ',tick': () => {
        let result = runner.trace();
        if (result) {
            console.log(result);
        }
    },
    ',run': () => {
        runner.run();
    },
    ',facts': () => {
        const facts = runner.facts();
        if (facts.length) {
            console.log(' ' + facts.join(',\n ') + '.');
        } else {
            console.log('( no facts defined )');
        }
    },
    ',rules': () => {
        const rules = runner.rules();
        if (rules.length) {
            console.log(runner.rules().join('\n'));
        } else {
            console.log('( no rules defined )');
        }
    },
    ',help': () => {
        console.log(Object.keys(cmds).join(', '));
    },
};

cmds[',help']()

rl.prompt();

rl.on('line', line_raw => {
    const line = line_raw.trim()
    if (line.startsWith(',')) {
        let [cmd, ...args] = line.split(/\s+/);

        let [found, ...others] = Object.keys(cmds).filter(c => c.startsWith(cmd));
        if (others.length) {
            console.log(`Ambiguous command, try "${found}" or "${others.join('" or "')}"`);
        } else {
            cmds[found](...args);
        }
    } else {
        let result = runner.trace(line + "."); // returns the matched rule (if any matched)
        if (result) {
            console.log(result);
        }
    }

    rl.prompt();
});

rl.once('close', () => {
    console.log('bye');
});

