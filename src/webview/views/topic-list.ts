import { SerialisedTopicNode } from '../../models/topic-node';
import { state } from '../state';
import { topicListContainer, escapeHtml } from '../dom';

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

import morphdom from 'morphdom';

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

  if (allNodes.length === 0) {
    const emptyHTML = `<div class="empty-state-message"><p>No topics or payload data matching "${escapeHtml(state.filterQuery)}"</p></div>`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = emptyHTML;
    morphdom(topicListContainer, wrapper, { childrenOnly: true });
    return;
  }

  let html = '';
  for (const node of allNodes) {
    if (state.filterQuery && !doesNodeMatchFilter(node, state.filterQuery)) {
      continue;
    }

    const date = new Date(node.lastUpdated);
    const selectedCls = state.selectedTopic === node.fullTopic ? 'selected' : '';
    let preview = 'No messages';
    if (node.lastMessage) {
      preview = node.lastMessage.payload || '<empty payload>';
    }

    html += `
      <div class="list-node-row ${selectedCls}" data-topic="${escapeHtml(node.fullTopic)}">
        <div class="list-node-header">
          <span class="list-node-topic">${escapeHtml(node.fullTopic)}</span>
          <span class="list-node-time">${date.toLocaleTimeString()}</span>
        </div>
        <div class="list-node-preview">${escapeHtml(preview)}</div>
      </div>`;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  morphdom(topicListContainer, wrapper, { childrenOnly: true });
}
