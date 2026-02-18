#!/usr/bin/env node

const { init, update, list, showHelp, showVersion } = require('../src/index');

const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);

const options = {
    global: flags.includes('--global') || flags.includes('-g'),
    force: flags.includes('--force') || flags.includes('-f'),
    dryRun: flags.includes('--dry-run'),
};

switch (command) {
    case 'init':
        init(options);
        break;
    case 'update':
        update(options);
        break;
    case 'list':
        list(flags[0]);
        break;
    case '--version':
    case '-v':
        showVersion();
        break;
    case '--help':
    case '-h':
    case undefined:
        showHelp();
        break;
    default:
        console.error(`\n  ❌ Unknown command: "${command}"\n`);
        showHelp();
        process.exit(1);
}
