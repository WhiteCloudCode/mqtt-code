import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('jsdom-global')();

// Inject the actual webview HTML so all DOM elements exist
const htmlPath = path.resolve(__dirname, '../../../src/webview/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
document.body.innerHTML = html;

(global as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
  postMessage: () => {},
  getState: () => {},
  setState: () => {},
});

// Mock some ECharts methods just in case
(global as unknown as { echarts: unknown }).echarts = {
  init: () => ({
    setOption: () => {},
    clear: () => {},
  }),
};

// Also mock requestAnimationFrame for some UI libraries
(global as unknown as { requestAnimationFrame: (cb: () => void) => void }).requestAnimationFrame = (
  callback: () => void
) => setTimeout(callback, 0);
