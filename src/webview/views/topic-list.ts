import { SerialisedTopicNode } from '../../models/topic-node';
import { state, vscode } from '../state';
import { topicListContainer, escapeHtml } from '../dom';
import { updateSelectedTopicDetails } from '../components/payload-inspector';
import { renderTopics } from '../main';

export function doesNodeMatchFilter(node: SerialisedTopicNode, query: string): boolean {
  if (!query) {
    return true;
  }

  if (node.fullTopic.toLowerCase().includes(query)) {
    return true;
  }

  if (node.lastMessage) {
    const p = node.lastMessage.payload.toLowerCase();
    if (p.includes(query)) {
      return true;
    }
    if (node.lastMessage.isJson && node.lastMessage.formattedJson) {
      if (node.lastMessage.formattedJson.toLowerCase().includes(query)) {
        return true;
      }
    }
  }

  return false;
}

export function renderTopicList() {
  const allNodes: SerialisedTopicNode[] = [];

  const collectNodes = (node: SerialisedTopicNode) => {
    if (node.messageCount > 0) {
      allNodes.push(node);
    }
    for (const childKey of Object.keys(node.children)) {
      collectNodes(node.children[childKey]);
    }
  };

  if (state.rootTree) {
    collectNodes(state.rootTree);
  }

  allNodes.sort((a, b) => b.lastUpdated - a.lastUpdated);

  topicListContainer.innerHTML = '';

  if (allNodes.length === 0) {
    topicListContainer.innerHTML = `
      <div class="empty-state-message">
        <p>No topics or payload data matching "${escapeHtml(state.filterQuery)}"</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const node of allNodes) {
    if (state.filterQuery && !doesNodeMatchFilter(node, state.filterQuery)) {
      continue;
    }

    const row = document.createElement('div');
    row.className = `list-node-row ${state.selectedTopic === node.fullTopic ? 'selected' : ''}`;

    const header = document.createElement('div');
    header.className = 'list-node-header';

    const topicSpan = document.createElement('span');
    topicSpan.className = 'list-node-topic';
    topicSpan.textContent = node.fullTopic;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'list-node-time';
    const date = new Date(node.lastUpdated);
    timeSpan.textContent = date.toLocaleTimeString();

    header.appendChild(topicSpan);
    header.appendChild(timeSpan);

    const preview = document.createElement('div');
    preview.className = 'list-node-preview';
    if (node.lastMessage) {
      preview.textContent = node.lastMessage.payload || '<empty payload>';
    } else {
      preview.textContent = 'No messages';
    }

    row.appendChild(header);
    row.appendChild(preview);

    row.addEventListener('mousedown', () => {
      state.selectedTopic = node.fullTopic;
      const pubTopic = document.getElementById('pub-topic') as HTMLInputElement;
      if (pubTopic) {
        pubTopic.value = node.fullTopic;
      }
      updateSelectedTopicDetails();
      renderTopics();
      vscode.postMessage({ type: 'requestHistory', topic: node.fullTopic });
    });

    fragment.appendChild(row);
  }

  topicListContainer.appendChild(fragment);
}
