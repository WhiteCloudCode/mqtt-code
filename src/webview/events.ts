import { state, vscode } from './state';
import {
  topicPane,
  paneResizer,
  btnViewTree,
  btnViewList,
  btnExpandAll,
  btnCollapseAll,
  topicSearchInput,
  btnClearSearch,
  btnClearTree,
  btnRefreshState,
  btnCopyTopic,
  btnCopyPayload,
  btnFormatJson,
  btnSampleJson,
  publishForm,
  pubTopic,
  pubQos,
  pubRetain,
  pubPayload,
  pubValidationMsg,
  btnFirehose,
  btnSankey,
  btnCloseHistoryDetail,
  historyDetailView,
  historyMasterView,
} from './dom';

import { findNode } from './utils/tree-utils';
import { renderTopics } from './main';
import { updatePayloadView, updateSelectedTopicDetails } from './components/payload-inspector';
import { renderIntermediateNodeView } from './views/firehose';
import { setAllNodesToggledState } from './utils/toggle-utils';

function switchViewMode(mode: 'tree' | 'list') {
  state.currentViewMode = mode;
  if (mode === 'tree') {
    btnViewTree.classList.add('active');
    btnViewList.classList.remove('active');
  } else {
    btnViewList.classList.add('active');
    btnViewTree.classList.remove('active');
  }
  renderTopics();
}

function showCopyConfirmation(btn: HTMLButtonElement, originalHtml: string) {
  const currentHtml = btn.innerHTML;
  if (currentHtml.includes('codicon-check')) {
    return;
  }
  btn.innerHTML = '<span class="codicon codicon-check"></span> Copied!';
  setTimeout(() => {
    btn.innerHTML = originalHtml;
  }, 2000);
}

export function activateTab(tabId: string) {
  const target = document.querySelector(`.tab-btn[data-tab="${tabId}"]`) as HTMLElement;
  if (!target) {
    return;
  }

  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

  target.classList.add('active');
  const content = document.getElementById(tabId);
  content?.classList.add('active');
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabId = target.dataset.tab;
      if (tabId) {
        activateTab(tabId);
      }
    });
  });

  document.querySelectorAll('.format-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const format = target.dataset.format as 'auto' | 'text' | 'hex' | 'base64' | undefined;
      if (!format) {
        return;
      }

      const container = target.closest('.format-toggles');
      if (container) {
        container.querySelectorAll('.format-btn').forEach((b) => b.classList.remove('active'));
      }
      target.classList.add('active');

      if (container && container.id === 'history-format-toggles') {
        state.historyFormat = format;
        if (state.currentHistoryMessage) {
          updatePayloadView(
            state.currentHistoryMessage,
            document.getElementById('history-payload-display') as HTMLElement,
            state.historyFormat
          );
        }
      } else {
        state.currentFormat = format;
        updatePayloadView();
      }
    });
  });

  if (btnCloseHistoryDetail && historyDetailView && historyMasterView) {
    btnCloseHistoryDetail.addEventListener('click', () => {
      historyDetailView.style.display = 'none';
      historyMasterView.style.display = 'block';
      updateSelectedTopicDetails();
    });
  }
}

function initToolbar() {
  btnFirehose.addEventListener('click', () => {
    state.intermediateViewMode = 'firehose';
    const node = findNode(state.rootTree, state.selectedTopic || '');
    if (node) {
      renderIntermediateNodeView(node);
    }
  });

  btnSankey.addEventListener('click', () => {
    state.intermediateViewMode = 'sankey';
    const node = findNode(state.rootTree, state.selectedTopic || '');
    if (node) {
      renderIntermediateNodeView(node);
    }
  });

  btnViewTree.addEventListener('click', () => switchViewMode('tree'));
  btnViewList.addEventListener('click', () => switchViewMode('list'));

  btnExpandAll.addEventListener('click', () => {
    setAllNodesToggledState(state.rootTree, false);
    renderTopics();
  });

  btnCollapseAll.addEventListener('click', () => {
    setAllNodesToggledState(state.rootTree, true);
    renderTopics();
  });

  btnClearTree.addEventListener('click', () => {
    vscode.postMessage({ type: 'clearTree' });
  });

  btnRefreshState.addEventListener('click', () => {
    vscode.postMessage({ type: 'requestState' });
  });
}

function initResizer() {
  let isResizing = false;
  paneResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    paneResizer.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) {
      return;
    }
    const newWidth = e.clientX;
    const minWidth = 240;
    const maxWidth = window.innerWidth - 300;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      topicPane.style.width = `${newWidth}px`;
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      paneResizer.classList.remove('is-resizing');
      document.body.style.cursor = '';
      vscode.postMessage({
        type: 'saveLayoutState',
        data: { topicPaneWidth: topicPane.style.width },
      });
      if (state.sankeyChartInstance) {
        state.sankeyChartInstance.resize();
      }
    }
  });

  const publisherDetails = document.getElementById('publisher-details') as HTMLDetailsElement;
  if (publisherDetails) {
    publisherDetails.addEventListener('toggle', () => {
      vscode.postMessage({
        type: 'savePublisherState',
        data: publisherDetails.open,
      });
    });
  }
}

function initSearch() {
  topicSearchInput.addEventListener('input', () => {
    state.filterQuery = topicSearchInput.value.trim().toLowerCase();
    renderTopics();
  });

  btnClearSearch.addEventListener('click', () => {
    topicSearchInput.value = '';
    state.filterQuery = '';
    renderTopics();
  });
}

function initCopyActions() {
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('topic-segment-badge')) {
      const text = target.textContent || '';
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection?.removeAllRanges();
      selection?.addRange(range);
      navigator.clipboard.writeText(text);

      target.classList.remove('flash-update');
      void target.offsetWidth; // Trigger reflow
      target.classList.add('flash-update');
    }
  });

  btnCopyTopic.addEventListener('click', () => {
    if (state.selectedTopic) {
      navigator.clipboard.writeText(state.selectedTopic);
      showCopyConfirmation(btnCopyTopic, '<span class="codicon codicon-copy"></span> Topic');
    }
  });

  btnCopyPayload.addEventListener('click', () => {
    const node = findNode(state.rootTree, state.selectedTopic || '');
    let displayNode = node;
    if (node && !node.lastMessage) {
      let curr = node;
      while (curr && Object.keys(curr.children).length === 1) {
        curr = Object.values(curr.children)[0];
      }
      if (curr && Object.keys(curr.children).length === 0 && curr.lastMessage) {
        displayNode = curr;
      }
    }
    if (displayNode?.lastMessage) {
      navigator.clipboard.writeText(displayNode.lastMessage.payload);
      showCopyConfirmation(btnCopyPayload, '<span class="codicon codicon-copy"></span> Payload');
    }
  });
}

function initPublishForm() {
  btnFormatJson.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(pubPayload.value);
      pubPayload.value = JSON.stringify(parsed, null, 2);
      pubValidationMsg.textContent = '';
    } catch {
      pubValidationMsg.textContent = 'Invalid JSON in payload.';
    }
  });

  btnSampleJson.addEventListener('click', () => {
    pubPayload.value = JSON.stringify(
      {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        device_id: 'sensor-alpha-01',
        temperature: 22.4,
        humidity: 58.2,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    if (!pubTopic.value) {
      pubTopic.value = 'sensors/telemetry/sample';
    }
  });

  publishForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = pubTopic.value.trim();
    const payload = pubPayload.value;
    const qos = Number.parseInt(pubQos.value, 10) as 0 | 1 | 2;
    const retain = pubRetain.checked;

    if (!topic) {
      pubValidationMsg.textContent = 'Topic is required.';
      return;
    }

    pubValidationMsg.textContent = '';
    vscode.postMessage({
      type: 'publish',
      data: {
        topic,
        payload,
        qos,
        retain,
      },
    });
  });
}

export function initialiseEventListeners() {
  initTabs();
  initToolbar();
  initResizer();
  initSearch();
  initCopyActions();
  initPublishForm();
}
