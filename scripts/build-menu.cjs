const { spawnSync } = require('node:child_process');
const { emitKeypressEvents } = require('node:readline');
const { styleText } = require('node:util');
const { getAndroidVersionCode } = require('../src/config/appVersion.cjs');
const { version } = require('../package.json');

const legalOptions = [
  { label: 'Оновити згенеровані документи', script: 'legal:sync' },
  { label: 'Перевірити актуальність документів', script: 'legal:check' },
  { label: 'Оновити документи й опублікувати сайт planitflow.com', script: 'legal:publish', publish: true },
];

const mainOptions = [
  { label: 'APK для Android', options: versionOptions('build:apk', 'release') },
  { label: 'AAB для Google Play', options: versionOptions('build:aab', 'playstore') },
  { label: 'Зібрати вебзастосунок локально', script: 'build:web' },
  { label: 'Опублікувати вебзастосунок · app.planitflow.com', script: 'deploy:web', publish: true },
  { label: 'Юридичні документи · політика конфіденційності', options: legalOptions },
  { label: 'Зібрати Android Dev Client', script: 'build:dev' },
];

function versionOptions(build, release) {
  const [major, minor, patch] = version.split('.').map(Number);
  return [
    { label: `${'Поточна версія'.padEnd(21)} ${version}`, script: build, version },
    ...[
      ['patch', 'Patch · виправлення', `${major}.${minor}.${patch + 1}`],
      ['minor', 'Minor · нові функції', `${major}.${minor + 1}.0`],
      ['major', 'Major · великий реліз', `${major + 1}.0.0`],
    ].map(([bump, label, nextVersion]) => ({
      label: `${label.padEnd(21)} ${version} → ${nextVersion}`,
      script: `${release}:${bump}`,
      version: nextVersion,
    })),
  ];
}

async function chooseAction() {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Відкрийте інтерактивний термінал і запустіть npm run build.');
  }

  const back = { label: 'Назад' };
  const exit = { label: 'Вийти' };
  const screens = [{ title: 'Білди та публікація', options: [...mainOptions, exit], index: 0 }];
  const currentScreen = () => screens[screens.length - 1];

  function render() {
    const { title, options, index } = currentScreen();
    const width = Math.min(stdout.columns - 1, 72);
    const fit = (line) => line.length > width ? `${line.slice(0, width - 1)}…` : line;
    const rows = [
      '',
      styleText(['bold', 'cyan'], fit(`  PlanIt  /  v${version}`)),
      styleText('bold', fit(`  ${title}`)),
      '',
      ...options.map(({ label }, row) => {
        const line = fit(row === index ? `  ❯  ${label}  ` : `     ${label}`);
        return row === index ? styleText(['bold', 'black', 'bgCyan'], line) : line;
      }),
      '',
      styleText('gray', fit(`  ↑ ↓  Вибір    Enter  Далі    Esc  ${screens.length === 1 ? 'Вийти' : 'Назад'}`)),
    ];
    stdout.write(`\x1b[H${rows.join('\x1b[K\r\n')}\x1b[J`);
  }

  let onKey;
  const wasRaw = stdin.isRaw;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  try {
    stdout.write('\x1b[?1049h\x1b[?25l');
    render();
    return await new Promise((resolve) => {
      onKey = (_, key) => {
        const screen = currentScreen();
        if (key.ctrl && key.name === 'c') {
          process.exitCode = 130;
          return resolve(null);
        }
        if (key.name === 'up' || key.name === 'down') {
          const step = key.name === 'up' ? -1 : 1;
          const count = screen.options.length;
          screen.index = (screen.index + step + count) % count;
        } else if (key.name === 'return' || key.name === 'enter' || key.name === 'escape') {
          const item = key.name === 'escape' ? back : screen.options[screen.index];
          if (item === exit || (item === back && screens.length === 1)) return resolve(null);
          if (item === back) {
            screens.pop();
          } else if (item.options) {
            screens.push({ title: item.label, options: [...item.options, back], index: 0 });
          } else if (item.publish) {
            screens.push({
              title: item.label,
              options: [{ label: 'Підтвердити публікацію', script: item.script }, back],
              index: 1,
            });
          } else {
            return resolve(item);
          }
        } else {
          return;
        }
        render();
      };
      stdin.on('keypress', onKey);
      stdout.on('resize', render);
      stdin.resume();
    });
  } finally {
    if (onKey) stdin.off('keypress', onKey);
    stdout.off('resize', render);
    stdin.setRawMode(wasRaw);
    stdin.pause();
    stdout.write('\x1b[?25h\x1b[?1049l');
  }
}

async function main() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Запустіть меню командою npm run build.');

  const action = await chooseAction();
  if (!action) return;
  if (action.version) getAndroidVersionCode(action.version);

  console.log(`\n▶ npm run ${action.script}\n`);
  const result = spawnSync(process.execPath, [npmCli, 'run', action.script], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
