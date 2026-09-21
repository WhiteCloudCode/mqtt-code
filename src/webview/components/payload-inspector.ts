import { MqttMessage } from '../../models/mqtt-message';
import { SerialisedTopicNode } from '../../models/topic-node';
import { state } from '../state';
import { findNode } from '../utils/tree-utils';
import { showHistoryDetail, hideHistoryDetail } from './history-detail';
import {
  setTextContentIfChanged,
  formatBytes,
  formatHexDump,
  syntaxHighlightJson,
  escapeHtml,
  renderSelectableTopic,
  selectedTopicTitle,
  topicMetadataBar,
  btnCopyTopic,
  btnCopyPayload,
  payloadDisplay,
  metaQos,
  metaRetained,
  metaSize,
  metaTime,
  metaMsgCount,
  propertiesContainer,
  historyTableBody,
  tabBtnPayload,
  tabBtnTraffic,
  tabBtnHistory,
  tabBtnProperties,
} from '../dom';

import { activateTab } from '../events';
import { renderIntermediateNodeView } from '../views/firehose';

export function updateSelectedTopicDetails() {
  if (state.previousSelectedTopic !== state.selectedTopic) {
    hideHistoryDetail();
    state.previousSelectedTopic = state.selectedTopic;
  }

  if (!state.selectedTopic) {
    selectedTopicTitle.innerHTML = 'Select a topic from the left';
    topicMetadataBar.style.display = 'none';
    btnCopyTopic.style.display = 'none';
    btnCopyPayload.style.display = 'none';
    updatePayloadView(undefined);
    tabBtnPayload.style.display = 'inline-block';
    tabBtnTraffic.style.display = 'none';
    tabBtnHistory.style.display = 'inline-block';
    tabBtnProperties.style.display = 'inline-block';
    if (document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'tab-traffic') {
      activateTab('tab-payload');
    }
    return;
  }

  const node = findNode(state.rootTree, state.selectedTopic);
  selectedTopicTitle.innerHTML = renderSelectableTopic(state.selectedTopic);
  topicMetadataBar.style.display = 'flex';
  btnCopyTopic.style.display = 'inline-block';

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

  const hasMessages = !!displayNode?.lastMessage;
  const hasChildren = node ? Object.keys(node.children).length > 0 : false;

  btnCopyPayload.style.display = hasMessages ? 'inline-block' : 'none';

  // Dynamic Tab Visibility Logic
  if (hasMessages && !hasChildren) {
    // Leaf node
    tabBtnPayload.style.display = 'inline-block';
    tabBtnHistory.style.display = 'inline-block';
    tabBtnProperties.style.display = 'inline-block';
    tabBtnTraffic.style.display = 'none';

    if (document.querySelector('.tab-btn.active')?.getAttribute('data-tab') === 'tab-traffic') {
      activateTab('tab-payload');
    }
  } else if (!hasMessages && hasChildren) {
    // Intermediate node
    tabBtnPayload.style.display = 'none';
    tabBtnProperties.style.display = 'none';
    tabBtnTraffic.style.display = 'inline-block';

    const historyDetailView = document.getElementById('history-detail-view');
    const isHistoryDetailOpen = historyDetailView && historyDetailView.style.display !== 'none';

    if (isHistoryDetailOpen) {
      tabBtnHistory.style.display = 'inline-block';
    } else {
      tabBtnHistory.style.display = 'none';
      if (document.querySelector('.tab-btn.active')?.getAttribute('data-tab') !== 'tab-traffic') {
        activateTab('tab-traffic');
      }
    }
  } else {
    // Hybrid node (has messages and children)
    tabBtnPayload.style.display = 'inline-block';
    tabBtnHistory.style.display = 'inline-block';
    tabBtnProperties.style.display = 'inline-block';
    tabBtnTraffic.style.display = 'inline-block';
  }

  if (hasMessages) {
    const msg = displayNode!.lastMessage!;
    setTextContentIfChanged(metaQos, msg.qos.toString());
    setTextContentIfChanged(metaRetained, msg.retain ? 'Yes (Retained)' : 'No');
    setTextContentIfChanged(metaSize, formatBytes(msg.sizeBytes));
    setTextContentIfChanged(metaTime, new Date(msg.timestamp).toLocaleTimeString());

    setTextContentIfChanged(
      metaMsgCount,
      (
        (displayNode as SerialisedTopicNode & { aggregatedMessageCount?: number })
          .aggregatedMessageCount ?? displayNode!.messageCount
      ).toString()
    );

    if (displayNode !== node) {
      selectedTopicTitle.innerHTML = `${renderSelectableTopic(
        state.selectedTopic
      )} <span class="topic-segment-slash">➔</span> ${renderSelectableTopic(
        displayNode!.fullTopic
      )}`;
    }

    updatePayloadView(msg);
    renderUserProperties(msg.userProperties);
  } else {
    setTextContentIfChanged(metaQos, '-');
    setTextContentIfChanged(metaRetained, '-');
    setTextContentIfChanged(metaSize, '0 B');
    setTextContentIfChanged(metaTime, '-');
    setTextContentIfChanged(
      metaMsgCount,
      node
        ? (
            (node as SerialisedTopicNode & { aggregatedMessageCount?: number })
              .aggregatedMessageCount ?? node.messageCount
          ).toString()
        : '0'
    );
    renderUserProperties();
    updatePayloadView(undefined);
  }

  if (hasChildren) {
    renderIntermediateNodeView(node!);
  }
}

export function updatePayloadView(
  message?: MqttMessage,
  displayElement: HTMLElement = payloadDisplay,
  formatOverride?: 'auto' | 'text' | 'hex' | 'base64'
) {
  const node = state.selectedTopic ? findNode(state.rootTree, state.selectedTopic) : null;
  const msg = message || (node ? node.lastMessage : undefined);

  const applyContent = (text: string, isJson: boolean = false) => {
    // Check if this is the main payload display which we replaced with Monaco
    if (
      displayElement.id === 'payload-display' ||
      displayElement.id === 'payload-monaco-container' ||
      !displayElement.id
    ) {
      // Wait for Monaco to be ready if it's not yet
      const win = window as unknown as {
        payloadMonacoEditor?: { setValue(v: string): void; updateOptions(o: unknown): void };
        monacoReady?: Promise<{ setValue(v: string): void; updateOptions(o: unknown): void }>;
      };
      if (win.payloadMonacoEditor) {
        win.payloadMonacoEditor.setValue(text);
        win.payloadMonacoEditor.updateOptions({ language: isJson ? 'json' : 'text' });
        // hide fallback
        const fallback = document.getElementById('payload-display-fallback');
        if (fallback) {
          fallback.style.display = 'none';
        }
      } else if (win.monacoReady) {
        win.monacoReady.then(
          (editor: { setValue(v: string): void; updateOptions(o: unknown): void }) => {
            editor.setValue(text);
            editor.updateOptions({ language: isJson ? 'json' : 'text' });
            const fallback = document.getElementById('payload-display-fallback');
            if (fallback) {
              fallback.style.display = 'none';
            }
          }
        );
      } else {
        setTextContentIfChanged(displayElement, text);
      }
    } else if (displayElement.id === 'history-payload-monaco-container') {
      const win = window as unknown as {
        historyMonacoEditor?: { setValue(v: string): void; updateOptions(o: unknown): void };
        monacoReady?: Promise<unknown>;
      };
      if (win.historyMonacoEditor) {
        win.historyMonacoEditor.setValue(text);
        win.historyMonacoEditor.updateOptions({ language: isJson ? 'json' : 'text' });
      } else if (win.monacoReady) {
        win.monacoReady.then(() => {
          if (win.historyMonacoEditor) {
            win.historyMonacoEditor.setValue(text);
            win.historyMonacoEditor.updateOptions({ language: isJson ? 'json' : 'text' });
          }
        });
      }
    } else {
      if (isJson) {
        displayElement.innerHTML = syntaxHighlightJson(text);
      } else {
        setTextContentIfChanged(displayElement, text);
      }
    }
  };

  if (!msg) {
    applyContent('No payload available.', false);
    delete displayElement.dataset.renderedMessageId;
    delete displayElement.dataset.renderedFormat;
    return;
  }

  const formatToUse = formatOverride || state.currentFormat;

  if (
    displayElement.dataset.renderedMessageId === msg.id &&
    displayElement.dataset.renderedFormat === formatToUse
  ) {
    return;
  }

  switch (formatToUse) {
    case 'auto':
      if (msg.isJson && msg.formattedJson) {
        applyContent(msg.formattedJson, true);
      } else {
        applyContent(msg.payload, false);
      }
      break;
    case 'text':
      applyContent(msg.payload, false);
      break;
    case 'hex':
      applyContent(formatHexDump(msg.payloadBuffer || ''), false);
      break;
    case 'base64':
      applyContent(msg.payloadBuffer || btoa(msg.payload), false);
      break;
  }

  displayElement.dataset.renderedMessageId = msg.id;
  displayElement.dataset.renderedFormat = formatToUse;
}

export function renderUserProperties(props?: Record<string, string | string[]>) {
  if (!props || Object.keys(props).length === 0) {
    propertiesContainer.innerHTML = `<p class="empty-props-message">No MQTT 5.0 user properties associated with this message.</p>`;
    return;
  }

  const rows = Object.entries(props)
    .map(
      ([key, val]) => `
      <div class="prop-item">
        <strong>${escapeHtml(key)}:</strong> <span>${escapeHtml(Array.isArray(val) ? val.join(', ') : val)}</span>
      </div>
    `
    )
    .join('');

  propertiesContainer.innerHTML = rows;
}

export function renderHistoryTable() {
  if (state.currentHistory.length === 0) {
    historyTableBody.innerHTML = `<tr><td colspan="5" class="empty-history-cell">No historical messages captured.</td></tr>`;
    return;
  }

  historyTableBody.innerHTML = state.currentHistory
    .map(
      (m, i) => `
    <tr data-index="${i}">
      <td>${new Date(m.timestamp).toLocaleTimeString()}</td>
      <td>${m.qos}</td>
      <td>${m.retain ? 'Yes' : 'No'}</td>
      <td>${formatBytes(m.sizeBytes)}</td>
      <td>${escapeHtml(m.payload.substring(0, 60))}${m.payload.length > 60 ? '...' : ''}</td>
    </tr>
  `
    )
    .join('');

  historyTableBody.querySelectorAll('tr[data-index]').forEach((tr) => {
    tr.addEventListener('mousedown', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
      const msg = state.currentHistory[idx];
      if (msg) {
        showHistoryDetail(msg);
      }
    });
  });
}
