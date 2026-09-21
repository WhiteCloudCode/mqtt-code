export function setTextContentIfChanged(element: HTMLElement | null, text: string | null) {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderSelectableTopic(topicPath: string): string {
  if (!topicPath) {
    return '';
  }
  return topicPath
    .split('/')
    .map((segment) => `<span class="topic-segment-badge">${escapeHtml(segment)}</span>`)
    .join('<span class="topic-segment-slash">/</span>');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatHexDump(base64Buffer: string): string {
  if (!base64Buffer) {
    return '';
  }
  try {
    const raw = atob(base64Buffer);
    let hexDump = '';
    for (let i = 0; i < raw.length; i += 16) {
      const chunk = raw.slice(i, i + 16);
      const hexPart = Array.from(chunk)
        .map((c) => (c.codePointAt(0) ?? 0).toString(16).padStart(2, '0'))
        .join(' ');
      const asciiPart = Array.from(chunk)
        .map((c) => {
          const code = c.codePointAt(0) ?? 0;
          return code >= 32 && code <= 126 ? c : '.';
        })
        .join('');
      hexDump += `${i.toString(16).padStart(6, '0')}  ${hexPart.padEnd(48, ' ')}  |${asciiPart}|\\n`;
    }
    return hexDump;
  } catch {
    return 'Unable to render Hex dump.';
  }
}

export function syntaxHighlightJson(json: string): string {
  const tokenRegex =
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

  let lastIndex = 0;
  let result = '';

  json.replace(tokenRegex, (...args) => {
    const match = args[0];
    const offset = args[args.length - 2] as number;

    result += escapeHtml(json.substring(lastIndex, offset));

    let cls = 'json-number';
    if (match.startsWith('"')) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (match === 'true' || match === 'false') {
      cls = 'json-boolean';
    } else if (match === 'null') {
      cls = 'json-null';
    }

    result += `<span class="${cls}">${escapeHtml(match)}</span>`;
    lastIndex = offset + match.length;
    return match;
  });

  result += escapeHtml(json.substring(lastIndex));
  return result;
}

// DOM Elements
export const brokerStatusBadge = document.getElementById('broker-status-badge') as HTMLElement;
export const brokerEndpointLabel = document.getElementById('broker-endpoint-label') as HTMLElement;
export const topicCountBadge = document.getElementById('topic-count-badge') as HTMLElement;
export const topicSearchInput = document.getElementById('topic-search-input') as HTMLInputElement;
export const btnClearSearch = document.getElementById('btn-clear-search') as HTMLButtonElement;
export const topicTreeContainer = document.getElementById('topic-tree-container') as HTMLElement;
export const topicListContainer = document.getElementById('topic-list-container') as HTMLElement;
export const topicPane = document.getElementById('topic-pane') as HTMLElement;
export const paneResizer = document.getElementById('pane-resizer') as HTMLElement;

export const btnViewTree = document.getElementById('btn-view-tree') as HTMLButtonElement;
export const btnViewList = document.getElementById('btn-view-list') as HTMLButtonElement;
export const btnExpandAll = document.getElementById('btn-expand-all') as HTMLButtonElement;
export const btnCollapseAll = document.getElementById('btn-collapse-all') as HTMLButtonElement;

export const tabBtnPayload = document.getElementById('tab-btn-payload') as HTMLButtonElement;
export const tabBtnTraffic = document.getElementById('tab-btn-traffic') as HTMLButtonElement;
export const tabBtnHistory = document.getElementById('tab-btn-history') as HTMLButtonElement;
export const tabBtnProperties = document.getElementById('tab-btn-properties') as HTMLButtonElement;

export const selectedTopicTitle = document.getElementById('selected-topic-title') as HTMLElement;
export const topicMetadataBar = document.getElementById('topic-metadata-bar') as HTMLElement;
export const metaQos = document.getElementById('meta-qos') as HTMLElement;
export const metaRetained = document.getElementById('meta-retained') as HTMLElement;
export const metaSize = document.getElementById('meta-size') as HTMLElement;
export const metaTime = document.getElementById('meta-time') as HTMLElement;
export const metaMsgCount = document.getElementById('meta-msg-count') as HTMLElement;

export const standardPayloadView = document.getElementById('standard-payload-view') as HTMLElement;
export const intermediateNodeView = document.getElementById(
  'intermediate-node-view'
) as HTMLElement;
export const payloadDisplay = (document.getElementById('payload-monaco-container') ||
  document.getElementById('payload-display')) as HTMLElement;
export const btnFirehose = document.getElementById('btn-firehose') as HTMLButtonElement;
export const btnSankey = document.getElementById('btn-sankey') as HTMLButtonElement;
export const firehoseContainer = document.getElementById('firehose-container') as HTMLElement;
export const sankeyContainer = document.getElementById('sankey-container') as HTMLElement;

export const historyTableBody = document.getElementById('history-table-body') as HTMLElement;
export const propertiesContainer = document.getElementById('properties-container') as HTMLElement;

export const btnCopyTopic = document.getElementById('btn-copy-topic') as HTMLButtonElement;
export const btnCopyPayload = document.getElementById('btn-copy-payload') as HTMLButtonElement;
export const btnClearTree = document.getElementById('btn-clear-tree') as HTMLButtonElement;
export const btnRefreshState = document.getElementById('btn-refresh-state') as HTMLButtonElement;

export const publishForm = document.getElementById('publish-form') as HTMLFormElement;
export const pubTopic = document.getElementById('pub-topic') as HTMLInputElement;
export const pubQos = document.getElementById('pub-qos') as HTMLSelectElement;
export const pubRetain = document.getElementById('pub-retain') as HTMLInputElement;
// pubPayload replaced by pub-monaco-container in HTML
export const btnFormatJson = document.getElementById('btn-format-json') as HTMLButtonElement;
export const btnSampleJson = document.getElementById('btn-sample-json') as HTMLButtonElement;
export const pubValidationMsg = document.getElementById('pub-validation-message') as HTMLElement;

export const historyMasterView = document.getElementById('history-master-view') as HTMLElement;
export const historyDetailView = document.getElementById('history-detail-view') as HTMLElement;
export const btnCloseHistoryDetail = document.getElementById(
  'btn-close-history-detail'
) as HTMLButtonElement;
export const toastContainer = document.getElementById('toast-container') as HTMLDivElement;
