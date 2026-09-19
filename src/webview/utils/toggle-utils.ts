import { SerialisedTopicNode } from '../../models/topic-node';
import { state } from '../state';

export function setAllNodesToggledState(node: SerialisedTopicNode | null, isCollapsed: boolean) {
  if (!node) {
    return;
  }

  if (Object.keys(node.children).length > 0) {
    state.userToggledNodes.set(node.fullTopic, isCollapsed);
  }

  for (const childKey of Object.keys(node.children)) {
    setAllNodesToggledState(node.children[childKey], isCollapsed);
  }
}
