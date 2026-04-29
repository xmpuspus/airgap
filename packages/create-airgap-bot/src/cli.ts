#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import pc from 'picocolors';
import prompts from 'prompts';
import {scaffold} from './scaffold';
import {TEMPLATES, TEMPLATE_LABELS, isTemplate, type Template} from './templates';

interface CliArgs {
  botName: string | undefined;
  template: Template | undefined;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    botName: undefined,
    template: undefined,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      args.version = true;
      continue;
    }
    if (arg === '--template' || arg === '-t') {
      const value = argv[++i];
      if (value && isTemplate(value)) {
        args.template = value;
      } else if (value) {
        throw new Error(
          `Unknown template '${value}'. Valid options: ${TEMPLATES.join(', ')}.`,
        );
      }
      continue;
    }
    if (arg.startsWith('--template=')) {
      const value = arg.slice('--template='.length);
      if (isTemplate(value)) {
        args.template = value;
      } else {
        throw new Error(
          `Unknown template '${value}'. Valid options: ${TEMPLATES.join(', ')}.`,
        );
      }
      continue;
    }
    if (!arg.startsWith('-') && args.botName === undefined) {
      args.botName = arg;
      continue;
    }
  }
  return args;
}

function printHelp(): void {
  const lines = [
    `${pc.bold('create-airgap-bot')} ${pc.dim(': scaffold an Airgap support bot from an industry template.')}`,
    '',
    `${pc.bold('Usage:')}`,
    '  npx create-airgap-bot <bot-name> [--template <industry>]',
    '',
    `${pc.bold('Options:')}`,
    '  -t, --template  Industry template (one of:',
    `                  ${TEMPLATES.join(', ')})`,
    '  -h, --help      Show this message.',
    '  -v, --version   Print package version.',
    '',
    `${pc.bold('Examples:')}`,
    '  npx create-airgap-bot acme-support --template telco',
    '  npx create-airgap-bot mybot',
    '',
    'Run with no arguments for interactive mode.',
  ];
  for (const line of lines) {
    process.stdout.write(line + '\n');
  }
}

function printVersion(): void {
  // Read version from the package.json that ships with this CLI.
  // dist/cli.js -> ../package.json after build.
  const pkg = require(path.join(__dirname, '..', 'package.json')) as {version: string};
  process.stdout.write(`${pkg.version}\n`);
}

function isValidBotName(name: string): boolean {
  // Lowercase letters, digits, hyphens. Must start with a letter. Length 2-50.
  return /^[a-z][a-z0-9-]{1,49}$/.test(name);
}

async function resolveBotName(initial: string | undefined): Promise<string> {
  if (initial && isValidBotName(initial)) {
    return initial;
  }
  if (initial && !isValidBotName(initial)) {
    process.stdout.write(
      pc.yellow(
        `Bot name '${initial}' is invalid. Use lowercase letters, digits, and hyphens; start with a letter.\n`,
      ),
    );
  }
  const response = await prompts(
    {
      type: 'text',
      name: 'botName',
      message: 'Bot name (kebab-case, e.g. acme-support):',
      validate: (value: string) =>
        isValidBotName(value)
          ? true
          : 'Use lowercase letters, digits, hyphens; start with a letter; 2-50 chars.',
    },
    {onCancel: () => process.exit(1)},
  );
  return response.botName as string;
}

async function resolveTemplate(initial: Template | undefined): Promise<Template> {
  if (initial) {
    return initial;
  }
  const response = await prompts(
    {
      type: 'select',
      name: 'template',
      message: 'Pick an industry template:',
      choices: TEMPLATES.map((t) => ({title: TEMPLATE_LABELS[t], value: t})),
      initial: TEMPLATES.indexOf('telco'),
    },
    {onCancel: () => process.exit(1)},
  );
  return response.template as Template;
}

async function main(): Promise<void> {
  let parsed: CliArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(pc.red((err as Error).message) + '\n');
    process.exit(2);
  }

  if (parsed.help) {
    printHelp();
    return;
  }
  if (parsed.version) {
    printVersion();
    return;
  }

  process.stdout.write(pc.bold(pc.cyan('create-airgap-bot')) + '\n');
  process.stdout.write(
    pc.dim('Scaffold a config-driven, on-device support bot from an Airgap template.\n\n'),
  );

  const botName = await resolveBotName(parsed.botName);
  const template = await resolveTemplate(parsed.template);

  const targetDir = path.resolve(process.cwd(), botName);

  process.stdout.write(
    pc.dim(`Bot name: ${pc.bold(botName)}\nTemplate: ${pc.bold(template)}\nTarget:   ${pc.bold(targetDir)}\n\n`),
  );

  try {
    await scaffold({botName, template, targetDir});
  } catch (err) {
    process.stderr.write(pc.red(`Scaffold failed: ${(err as Error).message}\n`));
    process.exit(1);
  }

  const next = [
    pc.green('Done.') + ' Next steps:',
    pc.dim(`  cd ${botName}`),
    pc.dim('  npm install'),
    pc.dim('  npm run android   ' + pc.italic('# or npm run ios')),
    '',
    pc.dim('Edit ') + pc.bold('airgap.config.json') + pc.dim(' to change branding, theme, and policies.'),
    pc.dim('Native signing keys are NOT regenerated; run ' + pc.bold('./scripts/setup.sh') + ' if needed.'),
  ];
  for (const line of next) {
    process.stdout.write(line + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(pc.red(`Unexpected error: ${(err as Error).stack ?? err}\n`));
  process.exit(1);
});
