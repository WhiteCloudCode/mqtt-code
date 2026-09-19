import * as path from 'node:path';
import * as fs from 'node:fs';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
  });

  return new Promise((resolve, reject) => {
    // Collect all test files, excluding webview UI tests which are run separately
    const files = fs
      .readdirSync(__dirname)
      .filter((f: string) => f.endsWith('.test.js') && !f.startsWith('webview-'));

    for (const file of files) {
      mocha.addFile(path.resolve(__dirname, file));
    }

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
