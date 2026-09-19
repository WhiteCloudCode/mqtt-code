import { SerialisedTopicNode } from '../../models/topic-node';
import { MqttMessage } from '../../models/mqtt-message';

export function computeAggregatedMessageCounts(node: SerialisedTopicNode): number {
  let total = node.messageCount;
  for (const childKey of Object.keys(node.children)) {
    total += computeAggregatedMessageCounts(node.children[childKey]);
  }
  (node as SerialisedTopicNode & { aggregatedMessageCount?: number }).aggregatedMessageCount =
    total;
  return total;
}

export function getDescendantMessages(
  node: SerialisedTopicNode,
  msgs: MqttMessage[] = []
): MqttMessage[] {
  if (node.lastMessage) {
    msgs.push(node.lastMessage);
  }
  for (const childKey of Object.keys(node.children)) {
    getDescendantMessages(node.children[childKey], msgs);
  }
  return msgs;
}

export function findNode(
  tree: SerialisedTopicNode | null,
  targetTopic: string
): SerialisedTopicNode | null {
  if (!tree) {
    return null;
  }
  if (targetTopic === '#' || targetTopic === '') {
    return tree;
  }

  const parts = targetTopic.split('/');
  let current: SerialisedTopicNode | null = tree;

  for (const segment of parts) {
    if (!current || !current.children[segment]) {
      return null;
    }
    current = current.children[segment];
  }

  return current || null;
}
