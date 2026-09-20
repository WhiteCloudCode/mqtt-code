import { SerialisedTopicNode } from '../../models/topic-node';
import { state } from '../state';
import { firehoseContainer, sankeyContainer, btnFirehose, btnSankey } from '../dom';
import { getDescendantMessages } from '../utils/tree-utils';
import { renderSankeyChart } from './sankey';
import { showHistoryDetail } from '../components/history-detail';

export function renderIntermediateNodeView(node: SerialisedTopicNode) {
  if (state.intermediateViewMode === 'firehose') {
    firehoseContainer.style.display = 'block';
    sankeyContainer.style.display = 'none';
    btnFirehose.classList.add('active');
    btnSankey.classList.remove('active');

    const msgs = getDescendantMessages(node);
    msgs.sort((a, b) => b.timestamp - a.timestamp);
    const latest = msgs.slice(0, 50);

    if (latest.length === 0) {
      firehoseContainer.innerHTML =
        '<div class="empty-state-message">No messages received in this branch yet.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const msg of latest) {
      const row = document.createElement('div');
      row.className = 'list-node-row';

      const header = document.createElement('div');
      header.className = 'list-node-header';

      const topicSpan = document.createElement('span');
      topicSpan.className = 'list-node-topic';
      topicSpan.textContent = msg.topic;
      header.appendChild(topicSpan);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'list-node-time';
      timeSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();
      header.appendChild(timeSpan);

      row.appendChild(header);

      const preview = document.createElement('div');
      preview.className = 'list-node-preview';
      preview.textContent = msg.payload.replace(/\\n/g, ' ').substring(0, 150);
      row.appendChild(preview);

      row.addEventListener('mousedown', () => {
        showHistoryDetail(msg);
      });

      fragment.appendChild(row);
    }
    firehoseContainer.innerHTML = '';
    firehoseContainer.appendChild(fragment);
  } else {
    firehoseContainer.style.display = 'none';
    sankeyContainer.style.display = 'block';
    btnFirehose.classList.remove('active');
    btnSankey.classList.add('active');

    if (sankeyContainer.querySelector('.empty-state-message')) {
      sankeyContainer.innerHTML = '';
    }
    renderSankeyChart(node);
  }
}
