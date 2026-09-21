import { state } from './state';
import { initialiseEventListeners } from './events';
import { renderTopicTree } from './views/topic-tree';
import { renderTopicList } from './views/topic-list';
import { updateConnectionStatus } from './components/metadata';
import { updateSelectedTopicDetails, renderHistoryTable } from './components/payload-inspector';
import { topicCountBadge, setTextContentIfChanged } from './dom';
import { computeAggregatedMessageCounts } from './utils/tree-utils';
import { ExtensionToWebviewMessage } from '../types/webview-messages';

export function renderTopics() {
  if (state.currentViewMode === 'tree') {
    renderTopicTree();
  } else {
    renderTopicList();
  }

  const count = state.rootTree
    ? ((state.rootTree as typeof state.rootTree & { aggregatedMessageCount?: number })
        .aggregatedMessageCount ?? state.rootTree.messageCount)
    : 0;
  if (topicCountBadge) {
    setTextContentIfChanged(topicCountBadge, count.toString());
  }
}

window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  if (event.origin !== window.location.origin && event.origin !== '') {
    return;
  }
  if (!event.data || typeof event.data !== 'object') {
    return;
  }
  const msg = event.data;
  switch (msg.type) {
    case 'fullStateUpdate':
      state.rootTree = msg.tree;
      if (state.rootTree) {
        computeAggregatedMessageCounts(state.rootTree);
      }
      updateConnectionStatus(msg.status, msg.broker);
      renderTopics();
      updateSelectedTopicDetails();
      break;
    case 'statusUpdate':
      updateConnectionStatus(msg.status, msg.broker);
      break;
    case 'historyUpdate':
      if (msg.topic === state.selectedTopic) {
        state.currentHistory = msg.history;
        renderHistoryTable();
      }
      break;
    default:
      break;
  }
});

initialiseEventListeners();
