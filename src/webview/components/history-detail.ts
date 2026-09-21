import { MqttMessage } from '../../models/mqtt-message';
import { state } from '../state';
import { updatePayloadView } from './payload-inspector';
import { formatBytes, escapeHtml, renderSelectableTopic } from '../dom';
import { activateTab } from '../events';

function setElText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function setElHtml(id: string, html: string) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = html;
  }
}

export function showHistoryDetail(msg: MqttMessage) {
  state.currentHistoryMessage = msg;
  const detailView = document.getElementById('history-detail-view');
  const masterView = document.getElementById('history-master-view');

  if (!detailView || !masterView) {
    return;
  }

  const tabBtnHistory = document.getElementById('tab-btn-history');
  if (tabBtnHistory) {
    tabBtnHistory.style.display = 'inline-block';
    tabBtnHistory.textContent = 'Message Details';
  }
  activateTab('tab-history');
  masterView.style.display = 'none';
  detailView.style.display = 'flex';

  setElText(
    'history-detail-title',
    `Message Properties (${new Date(msg.timestamp).toLocaleTimeString()})`
  );
  setElHtml('history-meta-topic', renderSelectableTopic(msg.topic));
  setElText('history-meta-qos', msg.qos.toString());
  setElText('history-meta-retained', msg.retain ? 'Yes' : 'No');
  setElText('history-meta-size', formatBytes(msg.sizeBytes));

  const historyUserProps = document.getElementById('history-detail-user-properties');
  if (historyUserProps) {
    if (msg.userProperties && Object.keys(msg.userProperties).length > 0) {
      historyUserProps.style.display = 'block';
      const rows = Object.entries(msg.userProperties)
        .map(
          ([key, val]) => `
          <div class="prop-item" style="margin-bottom: 2px;">
            <strong>${escapeHtml(key)}:</strong> <span style="color: var(--vscode-textPreformat-foreground);">${escapeHtml(Array.isArray(val) ? val.join(', ') : val)}</span>
          </div>`
        )
        .join('');
      historyUserProps.innerHTML = `<div style="margin-bottom: 4px; font-weight: bold; color: var(--vscode-foreground);">User Properties</div>${rows}`;
    } else {
      historyUserProps.style.display = 'none';
      historyUserProps.innerHTML = '';
    }
  }

  updatePayloadView(
    msg,
    document.getElementById('history-payload-monaco-container') as HTMLElement,
    state.historyFormat
  );
}

export function hideHistoryDetail() {
  const detailView = document.getElementById('history-detail-view');
  const masterView = document.getElementById('history-master-view');
  if (detailView && masterView) {
    detailView.style.display = 'none';
    masterView.style.display = 'block';

    const tabBtnHistory = document.getElementById('tab-btn-history');
    if (tabBtnHistory) {
      tabBtnHistory.textContent = 'Message History';
    }
  }
}
