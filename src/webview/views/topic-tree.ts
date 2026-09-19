import { SerialisedTopicNode } from '../../models/topic-node';
import { state, vscode } from '../state';
import { topicTreeContainer } from '../dom';
import { updateSelectedTopicDetails } from '../components/payload-inspector';
import { renderTopics } from '../main';
import { doesNodeMatchFilter } from './topic-list';

function createTwistie(fullTopic: string, hasChildren: boolean, isCollapsed: boolean): HTMLElement {
  const twistie = document.createElement('span');
  twistie.className = 'tree-twistie';

  if (hasChildren) {
    twistie.classList.add(isCollapsed ? 'collapsed' : 'expanded');
    twistie.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      state.userToggledNodes.set(fullTopic, !isCollapsed);
      renderTopics();
    });
  } else {
    twistie.innerHTML = '&nbsp;';
  }
  return twistie;
}

export function buildTreeDOM(
  originalNode: SerialisedTopicNode,
  _segmentName: string,
  depth: number
): HTMLElement | null {
  let squashedName = originalNode.name;
  let curr = originalNode;

  // Compress single-child paths where the intermediate nodes have no messages
  while (Object.keys(curr.children).length === 1 && !curr.lastMessage) {
    const childKey = Object.keys(curr.children)[0];
    const child = curr.children[childKey];
    squashedName += '/' + child.name;
    curr = child;
  }

  const hasChildren = Object.keys(curr.children).length > 0;

  let isCollapsed = false;
  if (state.filterQuery) {
    isCollapsed = false;
  } else if (state.userToggledNodes.has(curr.fullTopic)) {
    isCollapsed = state.userToggledNodes.get(curr.fullTopic)!;
  } else {
    isCollapsed = depth > 1;
  }

  const container = document.createElement('div');
  container.className = 'tree-node-container';

  const row = document.createElement('div');
  row.className = `tree-node-row ${state.selectedTopic === curr.fullTopic ? 'selected' : ''}`;
  row.style.paddingLeft = `${depth * 12}px`;

  row.appendChild(createTwistie(curr.fullTopic, hasChildren, isCollapsed));

  const label = document.createElement('span');
  label.className = 'tree-node-label';
  label.textContent = squashedName;
  row.appendChild(label);

  const aggregatedCount =
    (curr as SerialisedTopicNode & { aggregatedMessageCount?: number }).aggregatedMessageCount ??
    curr.messageCount;

  if (aggregatedCount > 0) {
    const countBadge = document.createElement('span');
    const depthClass = depth <= 5 ? `badge-depth-${depth}` : 'badge-depth-5';
    countBadge.className = `node-msg-badge ${depthClass}`;
    countBadge.textContent = aggregatedCount.toString();
    row.appendChild(countBadge);
  }

  row.addEventListener('mousedown', () => {
    state.selectedTopic = curr.fullTopic;
    const pubTopic = document.getElementById('pub-topic') as HTMLInputElement;
    if (pubTopic) {
      pubTopic.value = curr.fullTopic;
    }

    if (hasChildren) {
      state.userToggledNodes.set(curr.fullTopic, !isCollapsed);
    }

    updateSelectedTopicDetails();
    renderTopics();
    vscode.postMessage({ type: 'requestHistory', topic: curr.fullTopic });
  });

  container.appendChild(row);

  if (hasChildren && !isCollapsed) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children-container';

    const sortedKeys = Object.keys(curr.children).sort((a, b) => a.localeCompare(b));
    for (const childKey of sortedKeys) {
      const childDOM = buildTreeDOM(curr.children[childKey], childKey, depth + 1);
      if (childDOM) {
        childrenContainer.appendChild(childDOM);
      }
    }

    if (childrenContainer.childNodes.length > 0) {
      container.appendChild(childrenContainer);
    } else if (state.filterQuery && !doesNodeMatchFilter(curr, state.filterQuery)) {
      return null;
    }
  } else if (state.filterQuery && !doesNodeMatchFilter(curr, state.filterQuery)) {
    return null;
  }

  return container;
}

export function renderTopicTree() {
  const fragment = document.createDocumentFragment();
  if (state.rootTree) {
    const sortedKeys = Object.keys(state.rootTree.children).sort((a, b) => a.localeCompare(b));
    for (const childKey of sortedKeys) {
      const dom = buildTreeDOM(state.rootTree.children[childKey], childKey, 1);
      if (dom) {
        fragment.appendChild(dom);
      }
    }
  }

  topicTreeContainer.innerHTML = '';
  if (fragment.childNodes.length === 0 && state.filterQuery) {
    // Escape HTML inline if needed, but for now we just use textContent logic to be safe, or direct innerHTML since filterQuery is just string search
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state-message';
    emptyState.textContent = `No topics matching "${state.filterQuery}"`;
    topicTreeContainer.appendChild(emptyState);
  } else {
    topicTreeContainer.appendChild(fragment);
  }
}
