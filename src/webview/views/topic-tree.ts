import morphdom from 'morphdom';
import { SerialisedTopicNode } from '../../models/topic-node';
import { state } from '../state';
import { topicTreeContainer, escapeHtml } from '../dom';
import { doesNodeMatchFilter } from './topic-list';

function createTwistieHTML(fullTopic: string, hasChildren: boolean, isCollapsed: boolean): string {
  if (hasChildren) {
    const cls = isCollapsed ? 'collapsed' : 'expanded';
    return `<span class="tree-twistie ${cls}" data-twistie-topic="${escapeHtml(fullTopic)}" data-twistie-collapsed="${isCollapsed}"></span>`;
  } else {
    return `<span class="tree-twistie">&nbsp;</span>`;
  }
}

export function buildTreeHTML(
  originalNode: SerialisedTopicNode,
  _segmentName: string,
  depth: number
): string {
  let squashedName = originalNode.name;
  let curr = originalNode;

  while (Object.keys(curr.children).length === 1 && !curr.lastMessage) {
    const childKey = Object.keys(curr.children)[0];
    const child = curr.children[childKey];
    squashedName += '/' + child.name;
    curr = child;
  }

  const hasChildren = Object.keys(curr.children).length > 0;

  const isCollapsed = state.filterQuery
    ? false
    : state.userToggledNodes.has(curr.fullTopic)
      ? state.userToggledNodes.get(curr.fullTopic)!
      : depth > 1;

  const aggregatedCount =
    (curr as SerialisedTopicNode & { aggregatedMessageCount?: number }).aggregatedMessageCount ??
    curr.messageCount;

  let badgeHTML = '';
  if (aggregatedCount > 0) {
    const depthClass = depth <= 5 ? `badge-depth-${depth}` : 'badge-depth-5';
    badgeHTML = `<span class="node-msg-badge ${depthClass}">${aggregatedCount}</span>`;
  }

  const selectedCls = state.selectedTopic === curr.fullTopic ? 'selected' : '';
  const rowHTML = `
    <div class="tree-node-row ${selectedCls}" style="padding-left: ${depth * 12}px" data-topic="${escapeHtml(curr.fullTopic)}" data-has-children="${hasChildren}" data-is-collapsed="${isCollapsed}">
      ${createTwistieHTML(curr.fullTopic, hasChildren, isCollapsed)}
      <span class="tree-node-label">${escapeHtml(squashedName)}</span>
      ${badgeHTML}
    </div>`;

  let childrenHTML = '';
  if (hasChildren && !isCollapsed) {
    const sortedKeys = Object.keys(curr.children).sort((a, b) => a.localeCompare(b));
    for (const childKey of sortedKeys) {
      childrenHTML += buildTreeHTML(curr.children[childKey], childKey, depth + 1);
    }

    if (childrenHTML) {
      childrenHTML = `<div class="tree-children-container">${childrenHTML}</div>`;
    } else if (state.filterQuery && !doesNodeMatchFilter(curr, state.filterQuery)) {
      return '';
    }
  } else if (state.filterQuery && !doesNodeMatchFilter(curr, state.filterQuery)) {
    return '';
  }

  return `<div class="tree-node-container" id="node-${escapeHtml(curr.fullTopic)}">${rowHTML}${childrenHTML}</div>`;
}

export function renderTopicTree() {
  let html = '';
  if (state.rootTree) {
    const sortedKeys = Object.keys(state.rootTree.children).sort((a, b) => a.localeCompare(b));
    for (const childKey of sortedKeys) {
      html += buildTreeHTML(state.rootTree.children[childKey], childKey, 1);
    }
  }

  if (!html && state.filterQuery) {
    html = `<div class="empty-state-message">No topics matching "${escapeHtml(state.filterQuery)}"</div>`;
  }

  // Wrap in a div to morph cleanly
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  morphdom(topicTreeContainer, wrapper, {
    childrenOnly: true,
  });
}
