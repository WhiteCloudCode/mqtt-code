import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main() {
  // Prevent VS Code integrated terminal from forcing Electron into Node mode
  delete process.env.ELECTRON_RUN_AS_NODE;

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version: '1.90.0',
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
