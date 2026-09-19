import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';
import { MqttMessage } from '../models/mqtt-message';
import { TopicNode, SerialisedTopicNode, serialiseTopicNode } from '../models/topic-node';

export class TopicTreeManager extends EventEmitter {
  private root: TopicNode;
  private readonly messageHistory: Map<string, MqttMessage[]> = new Map();
  private maxMessagesPerTopic: number;

  constructor(maxMessagesPerTopic: number = 100) {
    super();
    this.maxMessagesPerTopic = maxMessagesPerTopic;
    this.root = this.createEmptyNode('', '');
  }

  private createEmptyNode(name: string, fullTopic: string): TopicNode {
    return {
      name,
      fullTopic,
      children: new Map<string, TopicNode>(),
      messageCount: 0,
      lastUpdated: Date.now(),
      hasRetainedMessage: false,
    };
  }

  public setMaxMessagesPerTopic(limit: number): void {
    this.maxMessagesPerTopic = Math.max(1, limit);
  }

  public clear(): void {
    this.root = this.createEmptyNode('', '');
    this.messageHistory.clear();
    this.emit('cleared');
    this.emit('change');
  }

  public addMessage(
    rawTopic: string,
    rawPayload: Buffer,
    qos: 0 | 1 | 2,
    retain: boolean,
    userProperties?: Record<string, string | string[]>
  ): MqttMessage {
    const payloadString = rawPayload.toString('utf8');
    const sizeBytes = rawPayload.byteLength;
    const timestamp = Date.now();
    const id = `${timestamp}-${crypto.randomUUID().substring(0, 8)}`;

    let isJson = false;
    let formattedJson: string | undefined;

    const trimmed = payloadString.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        formattedJson = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {
        isJson = false;
      }
    }

    const message: MqttMessage = {
      id,
      topic: rawTopic,
      payload: payloadString,
      payloadBuffer: rawPayload.toString('base64'),
      sizeBytes,
      qos,
      retain,
      timestamp,
      userProperties,
      isJson,
      formattedJson,
    };

    // Store in message history
    let history = this.messageHistory.get(rawTopic);
    if (!history) {
      history = [];
      this.messageHistory.set(rawTopic, history);
    }
    history.unshift(message);
    if (history.length > this.maxMessagesPerTopic) {
      history.pop();
    }

    // Insert into topic hierarchy
    const segments = rawTopic.split('/').filter((s) => s.length > 0);
    let currentNode = this.root;
    let accumulatedTopic = '';

    for (const segment of segments) {
      accumulatedTopic = accumulatedTopic ? `${accumulatedTopic}/${segment}` : segment;

      let childNode = currentNode.children.get(segment);
      if (!childNode) {
        childNode = this.createEmptyNode(segment, accumulatedTopic);
        currentNode.children.set(segment, childNode);
      }

      currentNode = childNode;
    }

    currentNode.messageCount += 1;
    currentNode.lastMessage = message;
    currentNode.lastUpdated = timestamp;
    if (retain) {
      currentNode.hasRetainedMessage = true;
    }

    this.emit('message', message);
    this.emit('change');

    return message;
  }

  public getRootNode(): TopicNode {
    return this.root;
  }

  public getSerialisedRoot(): SerialisedTopicNode {
    return serialiseTopicNode(this.root);
  }

  public getNodeByTopic(topic: string): TopicNode | undefined {
    if (!topic || topic === '/') {
      return this.root;
    }

    const segments = topic.split('/').filter((s) => s.length > 0);
    let currentNode: TopicNode | undefined = this.root;

    for (const segment of segments) {
      if (!currentNode) {
        return undefined;
      }
      currentNode = currentNode.children.get(segment);
    }

    return currentNode;
  }

  public getMessageHistory(topic: string): MqttMessage[] {
    return this.messageHistory.get(topic) || [];
  }

  public getTotalTopicCount(): number {
    let count = 0;
    const countNodes = (node: TopicNode) => {
      if (node !== this.root && node.messageCount > 0) {
        count++;
      }
      for (const child of node.children.values()) {
        countNodes(child);
      }
    };
    countNodes(this.root);
    return count;
  }
}
