const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const TEMPLATE_DIR = path.join(__dirname, '..', '.agent');
const PKG = require('../package.json');

// ── Colors (ANSI, no dependencies) ──────────────────────────────
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// ── Helpers ─────────────────────────────────────────────────────

function log(msg) { console.log(msg); }
function success(msg) { log(`  ${c.green}✅${c.reset} ${msg}`); }
function warn(msg) { log(`  ${c.yellow}⚠️${c.reset}  ${msg}`); }
function error(msg) { log(`  ${c.red}❌${c.reset} ${msg}`); }
function info(msg) { log(`  ${c.cyan}ℹ${c.reset}  ${msg}`); }

function getDestination(isGlobal) {
    if (isGlobal) {
        const home = os.homedir();
        return path.join(home, '.gemini', 'antigravity');
    }
    return path.join(process.cwd(), '.agent');
}

function copyDirSync(src, dest, dryRun = false) {
    let count = 0;

    if (!dryRun && !fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.name === '__pycache__' || entry.name === '.antigravityignore') {
            continue;
        }

        if (entry.isDirectory()) {
            count += copyDirSync(srcPath, destPath, dryRun);
        } else {
            if (dryRun) {
                log(`  ${c.dim}  would copy: ${path.relative(dest, destPath)}${c.reset}`);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
            count++;
        }
    }

    return count;
}

function countItems(dir, type) {
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (type === 'dirs') return entries.filter(e => e.isDirectory()).length;
    if (type === 'files') return entries.filter(e => e.isFile()).length;
    return entries.length;
}

function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

function printBanner() {
    log('');
    log(`  ${c.magenta}${c.bold}🚀 Antigravity Agent Toolkit${c.reset} ${c.dim}v${PKG.version}${c.reset}`);
    log(`  ${c.dim}${'─'.repeat(45)}${c.reset}`);
}

// ── Commands ────────────────────────────────────────────────────

async function init(options) {
    printBanner();

    if (!fs.existsSync(TEMPLATE_DIR)) {
        error('Template .agent/ not found in package. Reinstall the toolkit.');
        process.exit(1);
    }

    const dest = getDestination(options.global);
    const destLabel = options.global
        ? `${c.cyan}~/.gemini/antigravity/${c.reset} (global)`
        : `${c.cyan}.agent/${c.reset} (local)`;

    log(`\n  📁 Destino: ${destLabel}\n`);

    if (fs.existsSync(dest) && !options.force) {
        warn(`O diretório ${options.global ? '~/.gemini/antigravity/' : '.agent/'} já existe.`);
        const answer = await ask(`  ${c.yellow}?${c.reset}  Sobrescrever? (s/N): `);

        if (answer !== 's' && answer !== 'sim' && answer !== 'y' && answer !== 'yes') {
            info('Operação cancelada.');
            log('');
            process.exit(0);
        }
    }

    if (options.dryRun) {
        info('Modo dry-run — nenhum arquivo será criado:\n');
        const count = copyDirSync(TEMPLATE_DIR, dest, true);
        log(`\n  ${c.dim}  Total: ${count} arquivos seriam copiados${c.reset}`);
        log('');
        return;
    }

    const agentCount = countItems(path.join(TEMPLATE_DIR, 'agents'), 'files');
    const skillCount = countItems(path.join(TEMPLATE_DIR, 'skills'), 'dirs');
    const workflowCount = countItems(path.join(TEMPLATE_DIR, 'workflows'), 'files');
    const scriptCount = countItems(path.join(TEMPLATE_DIR, 'scripts'), 'files');

    log(`  📦 Instalando...\n`);

    const totalFiles = copyDirSync(TEMPLATE_DIR, dest);

    success(`${totalFiles} arquivos copiados com sucesso!`);
    log('');
    log(`  ${c.dim}  ├── 🤖 ${agentCount} Agentes${c.reset}`);
    log(`  ${c.dim}  ├── 📚 ${skillCount} Habilidades${c.reset}`);
    log(`  ${c.dim}  ├── 🔄 ${workflowCount} Workflows${c.reset}`);
    log(`  ${c.dim}  └── ⚙️  ${scriptCount} Scripts${c.reset}`);
    log('');

    if (options.global) {
        success('Toolkit instalado globalmente!');
        info('Os agentes estarão disponíveis em todos os projetos.');
    } else {
        success('Toolkit instalado no projeto!');
        info('O diretório .agent/ foi criado na raiz do projeto.');
    }

    log('');
    log(`  ${c.dim}Documentação: .agent/ARCHITECTURE.md${c.reset}`);
    log(`  ${c.dim}GitHub: ${PKG.repository.url}${c.reset}`);
    log('');
}

async function update(options) {
    printBanner();

    const dest = getDestination(options.global);
    const destLabel = options.global ? '~/.gemini/antigravity/' : '.agent/';

    if (!fs.existsSync(dest)) {
        error(`Nenhuma instalação encontrada em ${destLabel}`);
        info('Execute primeiro: npx antigravity-agent-toolkit init');
        log('');
        process.exit(1);
    }

    const backupDir = `${dest}_backup_${Date.now()}`;

    log(`\n  🔄 Atualizando ${c.cyan}${destLabel}${c.reset}\n`);

    if (!options.force) {
        const answer = await ask(`  ${c.yellow}?${c.reset}  Criar backup e sobrescrever? (s/N): `);
        if (answer !== 's' && answer !== 'sim' && answer !== 'y' && answer !== 'yes') {
            info('Atualização cancelada.');
            log('');
            process.exit(0);
        }
    }

    if (options.dryRun) {
        info('Modo dry-run — nenhum arquivo será modificado.');
        log(`  ${c.dim}  Backup seria criado em: ${backupDir}${c.reset}`);
        const count = copyDirSync(TEMPLATE_DIR, dest, true);
        log(`\n  ${c.dim}  Total: ${count} arquivos seriam atualizados${c.reset}`);
        log('');
        return;
    }

    info(`Criando backup em: ${path.basename(backupDir)}`);
    copyDirSync(dest, backupDir);

    const totalFiles = copyDirSync(TEMPLATE_DIR, dest);

    success(`${totalFiles} arquivos atualizados!`);
    info(`Backup salvo em: ${path.basename(backupDir)}`);
    log('');
}

function list(subcommand) {
    printBanner();

    const categories = {
        agents: { dir: 'agents', emoji: '🤖', label: 'Agentes', type: 'files', ext: '.md' },
        skills: { dir: 'skills', emoji: '📚', label: 'Habilidades', type: 'dirs' },
        workflows: { dir: 'workflows', emoji: '🔄', label: 'Workflows', type: 'files', ext: '.md' },
        scripts: { dir: 'scripts', emoji: '⚙️', label: 'Scripts', type: 'files' },
    };

    const toShow = subcommand && categories[subcommand]
        ? { [subcommand]: categories[subcommand] }
        : categories;

    if (subcommand && !categories[subcommand]) {
        error(`Categoria desconhecida: "${subcommand}"`);
        info('Categorias válidas: agents, skills, workflows, scripts');
        log('');
        process.exit(1);
    }

    log('');

    for (const [key, cat] of Object.entries(toShow)) {
        const dir = path.join(TEMPLATE_DIR, cat.dir);
        if (!fs.existsSync(dir)) continue;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const items = cat.type === 'dirs'
            ? entries.filter(e => e.isDirectory()).map(e => e.name)
            : entries.filter(e => e.isFile()).map(e => e.name);

        log(`  ${cat.emoji} ${c.bold}${cat.label}${c.reset} ${c.dim}(${items.length})${c.reset}`);
        log('');

        items.sort().forEach(item => {
            const name = cat.ext ? item.replace(cat.ext, '') : item;
            log(`  ${c.dim}  •${c.reset} ${name}`);
        });

        log('');
    }
}

function showVersion() {
    log(`antigravity-agent-toolkit v${PKG.version}`);
}

function showHelp() {
    printBanner();
    log('');
    log(`  ${c.bold}Uso:${c.reset}`);
    log(`    ${c.cyan}antigravity-agent-toolkit${c.reset} <comando> [opções]`);
    log('');
    log(`  ${c.bold}Comandos:${c.reset}`);
    log(`    ${c.green}init${c.reset}              Instala o toolkit no projeto atual`);
    log(`    ${c.green}update${c.reset}            Atualiza uma instalação existente`);
    log(`    ${c.green}list${c.reset} [categoria]   Lista agentes, skills, workflows ou scripts`);
    log('');
    log(`  ${c.bold}Opções:${c.reset}`);
    log(`    ${c.yellow}--global, -g${c.reset}      Instalar em ~/.gemini/antigravity/ (global)`);
    log(`    ${c.yellow}--force, -f${c.reset}       Sobrescrever sem perguntar`);
    log(`    ${c.yellow}--dry-run${c.reset}         Simular sem criar arquivos`);
    log(`    ${c.yellow}--version, -v${c.reset}     Mostrar versão`);
    log(`    ${c.yellow}--help, -h${c.reset}        Mostrar esta ajuda`);
    log('');
    log(`  ${c.bold}Exemplos:${c.reset}`);
    log(`    ${c.dim}$ npx antigravity-agent-toolkit init${c.reset}`);
    log(`    ${c.dim}$ npx antigravity-agent-toolkit init --global${c.reset}`);
    log(`    ${c.dim}$ npx antigravity-agent-toolkit list agents${c.reset}`);
    log(`    ${c.dim}$ npx antigravity-agent-toolkit update --force${c.reset}`);
    log('');
}

module.exports = { init, update, list, showHelp, showVersion };
