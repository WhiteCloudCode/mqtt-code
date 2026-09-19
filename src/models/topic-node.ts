import { MqttMessage } from './mqtt-message';

export interface TopicNode {
  name: string;
  fullTopic: string;
  children: Map<string, TopicNode>;
  messageCount: number;
  lastMessage?: MqttMessage;
  lastUpdated: number;
  hasRetainedMessage: boolean;
}

export interface SerialisedTopicNode {
  name: string;
  fullTopic: string;
  children: { [key: string]: SerialisedTopicNode };
  messageCount: number;
  lastMessage?: MqttMessage;
  lastUpdated: number;
  hasRetainedMessage: boolean;
}

export function serialiseTopicNode(node: TopicNode): SerialisedTopicNode {
  const childrenObj: { [key: string]: SerialisedTopicNode } = {};
  for (const [key, child] of node.children.entries()) {
    childrenObj[key] = serialiseTopicNode(child);
  }

  return {
    name: node.name,
    fullTopic: node.fullTopic,
    children: childrenObj,
    messageCount: node.messageCount,
    lastMessage: node.lastMessage,
    lastUpdated: node.lastUpdated,
    hasRetainedMessage: node.hasRetainedMessage,
  };
}
