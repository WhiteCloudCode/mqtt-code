/* eslint-disable @typescript-eslint/no-explicit-any */
import { state, vscode } from './state';
import {
  topicTreeContainer,
  topicListContainer,
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
  toastContainer,
  btnFormatJson,
  btnSampleJson,
  publishForm,
  pubTopic,
  pubQos,
  pubRetain,
  pubValidationMsg,
  btnAddProp,
  pubPropertiesContainer,
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
    topicTreeContainer.style.display = 'block';
    topicListContainer.style.display = 'none';
  } else {
    btnViewList.classList.add('active');
    btnViewTree.classList.remove('active');
    topicTreeContainer.style.display = 'none';
    topicListContainer.style.display = 'block';
  }
  renderTopics();
}

function showToast(message: string) {
  if (!toastContainer) {
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = document.createElement('span');
  icon.className = 'codicon codicon-check';
  const textNode = document.createElement('span');
  textNode.textContent = message;
  toast.appendChild(icon);
  toast.appendChild(textNode);

  toastContainer.appendChild(toast);

  // The CSS animation takes 2.5s total (0.3s fade in, wait, 0.5s fade out starting at 2s).
  setTimeout(() => {
    if (toastContainer.contains(toast)) {
      toastContainer.removeChild(toast);
    }
  }, 2600);
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
            document.getElementById('history-payload-monaco-container') as HTMLElement,
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
  const truncateText = (str: string, maxLength = 40) =>
    str.length > maxLength ? str.substring(0, maxLength) + '...' : str;

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
      showToast('Copied topic segment: ' + truncateText(text));

      target.classList.remove('flash-update');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          target.classList.add('flash-update');
        });
      });
    }
  });

  btnCopyTopic.addEventListener('click', () => {
    if (state.selectedTopic) {
      navigator.clipboard.writeText(state.selectedTopic);
      showToast('Copied topic: ' + truncateText(state.selectedTopic));
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
      showToast('Copied payload: ' + truncateText(displayNode.lastMessage.payload));
    }
  });
}

function initPublishForm() {
  if ((window as any).monacoReady) {
    (window as any).monacoReady.then(() => {
      if ((window as any).pubMonacoEditor) {
        (window as any).pubMonacoEditor.onDidChangeModelContent(() => {
          pubValidationMsg.textContent = '';
        });
      }
    });
  }

  pubTopic.addEventListener('input', () => {
    pubValidationMsg.textContent = '';
  });

  btnFormatJson.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(
        (window as any).pubMonacoEditor ? (window as any).pubMonacoEditor.getValue() : ''
      );
      if ((window as any).pubMonacoEditor) {
        (window as any).pubMonacoEditor.setValue(JSON.stringify(parsed, null, 2));
      }
      pubValidationMsg.textContent = '';
    } catch {
      pubValidationMsg.textContent = 'Invalid JSON in payload.';
    }
  });

  btnSampleJson.addEventListener('click', () => {
    if ((window as any).pubMonacoEditor) {
      (window as any).pubMonacoEditor.setValue(
        JSON.stringify(
          {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            device_id: 'sensor-alpha-01',
            temperature: 22.4,
            humidity: 58.2,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
    if (!pubTopic.value) {
      pubTopic.value = 'sensors/telemetry/sample';
    }
  });

  if (btnAddProp) {
    btnAddProp.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'pub-prop-row';
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.marginBottom = '4px';

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.placeholder = 'Property Key';
      keyInput.className = 'pub-prop-key flex-1';
      keyInput.required = true;

      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.placeholder = 'Property Value';
      valInput.className = 'pub-prop-val flex-2';
      valInput.required = true;

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'mini-btn';
      rmBtn.innerHTML = '<span class="codicon codicon-trash"></span>';
      rmBtn.addEventListener('click', () => {
        pubPropertiesContainer.removeChild(row);
      });

      row.appendChild(keyInput);
      row.appendChild(valInput);
      row.appendChild(rmBtn);
      pubPropertiesContainer.appendChild(row);
    });
  }

  publishForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = pubTopic.value.trim();
    const payload = (window as any).pubMonacoEditor
      ? (window as any).pubMonacoEditor.getValue()
      : '';
    const qos = Number.parseInt(pubQos.value, 10) as 0 | 1 | 2;
    const retain = pubRetain.checked;

    const userProperties: Record<string, string> = {};
    if (pubPropertiesContainer) {
      const rows = pubPropertiesContainer.querySelectorAll('.pub-prop-row');
      rows.forEach((row) => {
        const k = (row.querySelector('.pub-prop-key') as HTMLInputElement).value.trim();
        const v = (row.querySelector('.pub-prop-val') as HTMLInputElement).value.trim();
        if (k) {
          userProperties[k] = v;
        }
      });
    }

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
        userProperties: Object.keys(userProperties).length > 0 ? userProperties : undefined,
      },
    });
  });
}

export function initialiseEventListeners() {
  topicTreeContainer.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;

    const twistie = target.closest('.tree-twistie');
    if (twistie) {
      e.stopPropagation();
      const topic = twistie.getAttribute('data-twistie-topic');
      const isCollapsed = twistie.getAttribute('data-twistie-collapsed') === 'true';
      if (topic) {
        state.userToggledNodes.set(topic, !isCollapsed);
        renderTopics();
      }
      return;
    }

    const row = target.closest('.tree-node-row');
    if (row) {
      const topic = row.getAttribute('data-topic');
      const hasChildren = row.getAttribute('data-has-children') === 'true';
      const isCollapsed = row.getAttribute('data-is-collapsed') === 'true';

      if (topic) {
        state.selectedTopic = topic;
        const pubTopicInput = document.getElementById('pub-topic') as HTMLInputElement;
        if (pubTopicInput) {
          pubTopicInput.value = topic;
        }

        if (hasChildren) {
          state.userToggledNodes.set(topic, !isCollapsed);
        }

        updateSelectedTopicDetails();
        renderTopics();
        vscode.postMessage({ type: 'requestHistory', topic });
      }
    }
  });

  topicListContainer.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('.list-node-row');
    if (row) {
      const topic = row.getAttribute('data-topic');
      if (topic) {
        state.selectedTopic = topic;
        const pubTopicInput = document.getElementById('pub-topic') as HTMLInputElement;
        if (pubTopicInput) {
          pubTopicInput.value = topic;
        }

        updateSelectedTopicDetails();
        renderTopics();
        vscode.postMessage({ type: 'requestHistory', topic });
      }
    }
  });

  initTabs();
  initToolbar();
  initResizer();
  initSearch();
  initCopyActions();
  initPublishForm();
}
