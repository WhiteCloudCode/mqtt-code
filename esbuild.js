const esbuild = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

async function build() {
  // Ensure output directories exist
  const webviewDist = path.join(__dirname, 'dist', 'webview');
  const brokerFormDist = path.join(webviewDist, 'broker-form');

  if (!fs.existsSync(brokerFormDist)) {
    fs.mkdirSync(brokerFormDist, { recursive: true });
  }

  // Copy static webview assets (HTML, CSS)
  fs.copyFileSync(
    path.join(__dirname, 'src', 'webview', 'index.html'),
    path.join(webviewDist, 'index.html')
  );
  fs.copyFileSync(
    path.join(__dirname, 'src', 'webview', 'style.css'),
    path.join(webviewDist, 'style.css')
  );

  // Copy broker-form assets
  fs.copyFileSync(
    path.join(__dirname, 'src', 'webview', 'broker-form', 'index.html'),
    path.join(brokerFormDist, 'index.html')
  );
  fs.copyFileSync(
    path.join(__dirname, 'src', 'webview', 'broker-form', 'style.css'),
    path.join(brokerFormDist, 'style.css')
  );

  // Copy Monaco Editor
  const monacoDist = path.join(webviewDist, 'vs');
  if (!fs.existsSync(monacoDist)) {
    fs.mkdirSync(monacoDist, { recursive: true });
    fs.cpSync(path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs'), monacoDist, { recursive: true });
  }


  // Extension Host build context
  const extensionContext = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
  });

  // Main Webview client script build context
  const webviewContext = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    format: 'iife',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'browser',
    outfile: 'dist/webview/main.js',
    logLevel: 'info',
  });

  // Broker Form Webview client script build context
  const brokerFormContext = await esbuild.context({
    entryPoints: ['src/webview/broker-form/main.ts'],
    bundle: true,
    format: 'iife',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'browser',
    outfile: 'dist/webview/broker-form/main.js',
    logLevel: 'info',
  });

  // Tests compilation context
  const testContext = await esbuild.context({
    entryPoints: [
      'src/test/run-test.ts',
      'src/test/suite/index.ts',
      'src/test/suite/topic-tree-manager.test.ts',
      'src/test/suite/models.test.ts',
      'src/test/suite/extension.test.ts',
      'src/test/suite/storage-service.test.ts',
      'src/test/suite/connection-manager.test.ts',
      'src/test/suite/webview-setup.ts',
      'src/test/suite/webview-topic-tree.test.ts'
    ],
    bundle: true,
    format: 'cjs',
    sourcemap: true,
    platform: 'node',
    outdir: 'dist/test',
    outbase: 'src/test',
    external: ['vscode', 'mocha', 'assert', '@vscode/test-electron', 'jsdom', 'jsdom-global'],
    logLevel: 'info',
  });

  if (isWatch) {
    console.log('[watch] Starting watch mode...');
    await Promise.all([
      extensionContext.watch(),
      webviewContext.watch(),
      brokerFormContext.watch(),
      testContext.watch()
    ]);
  } else {
    await Promise.all([
      extensionContext.rebuild(),
      webviewContext.rebuild(),
      brokerFormContext.rebuild(),
      testContext.rebuild()
    ]);
    await Promise.all([
      extensionContext.dispose(),
      webviewContext.dispose(),
      brokerFormContext.dispose(),
      testContext.dispose()
    ]);
    console.log('[build] Successfully built extension, webviews, and tests.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
