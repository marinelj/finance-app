import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Evaluates `expression` against a dependency-free module in a fresh Node process whose TZ is
 * `timeZone`. Jest sandboxes `process.env`, so changing TZ inside a test has no effect.
 * The module is imported as `m`, e.g. `m.todayLocal(new Date("2026-03-01T03:30:00Z"))`.
 */
export function evalInTimeZone(timeZone: string, modulePath: string, expression: string): string {
  const file = path.resolve(modulePath);
  const script = `import(${JSON.stringify(file)}).then((m) => process.stdout.write(String(${expression})));`;
  return execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], {
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  });
}
