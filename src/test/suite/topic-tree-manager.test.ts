import * as assert from 'assert';
import { TopicTreeManager } from '../../services/topic-tree-manager';

describe('TopicTreeManager Unit Tests', () => {
  let manager: TopicTreeManager;

  beforeEach(() => {
    manager = new TopicTreeManager(5);
  });

  it('should initialise with an empty root node', () => {
    const root = manager.getRootNode();
    assert.strictEqual(root.children.size, 0);
    assert.strictEqual(root.messageCount, 0);
    assert.strictEqual(manager.getTotalTopicCount(), 0);
  });

  it('should insert single and nested topics correctly', () => {
    manager.addMessage('home/kitchen/temp', Buffer.from('22.5'), 0, false);
    manager.addMessage('home/kitchen/humidity', Buffer.from('45%'), 1, false);
    manager.addMessage('home/living-room/temp', Buffer.from('21.0'), 0, false);

    const root = manager.getRootNode();
    const homeNode = root.children.get('home');
    assert.ok(homeNode, 'home node should exist');
    assert.strictEqual(
      homeNode!.children.size,
      2,
      'home node should have 2 children (kitchen, living-room)'
    );

    const kitchenNode = homeNode!.children.get('kitchen');
    assert.ok(kitchenNode, 'kitchen node should exist');
    assert.strictEqual(
      kitchenNode!.children.size,
      2,
      'kitchen node should have 2 children (temp, humidity)'
    );

    const tempNode = kitchenNode!.children.get('temp');
    assert.ok(tempNode, 'temp node should exist');
    assert.strictEqual(tempNode!.messageCount, 1);
    assert.strictEqual(tempNode!.lastMessage?.payload, '22.5');
  });

  it('should detect and format valid JSON payloads', () => {
    const jsonPayload = JSON.stringify({ device: 'sensor-1', value: 42 });
    const msg = manager.addMessage('telemetry/data', Buffer.from(jsonPayload), 0, false);

    assert.strictEqual(msg.isJson, true);
    assert.ok(msg.formattedJson?.includes('"device": "sensor-1"'));
    assert.ok(msg.formattedJson?.includes('"value": 42'));
  });

  it('should handle non-JSON plain text payloads gracefully', () => {
    const plainText = 'RAW_SENSOR_READING_OK';
    const msg = manager.addMessage('telemetry/raw', Buffer.from(plainText), 0, false);

    assert.strictEqual(msg.isJson, false);
    assert.strictEqual(msg.formattedJson, undefined);
    assert.strictEqual(msg.payload, plainText);
  });

  it('should track retained messages', () => {
    manager.addMessage('status/power', Buffer.from('ON'), 1, true);
    const node = manager.getNodeByTopic('status/power');
    assert.ok(node);
    assert.strictEqual(node!.hasRetainedMessage, true);
  });

  it('should respect maximum message history capacity', () => {
    for (let i = 1; i <= 10; i++) {
      manager.addMessage('stream/test', Buffer.from(`msg-${i}`), 0, false);
    }

    const history = manager.getMessageHistory('stream/test');
    assert.strictEqual(history.length, 5, 'History should be capped at maxMessagesPerTopic (5)');
    assert.strictEqual(
      history[0].payload,
      'msg-10',
      'First item in history should be the newest message'
    );
    assert.strictEqual(
      history[4].payload,
      'msg-6',
      'Last item in history should be the 5th newest message'
    );
  });

  it('should clear all nodes and history when cleared', () => {
    manager.addMessage('test/topic', Buffer.from('sample'), 0, false);
    assert.strictEqual(manager.getTotalTopicCount(), 1);

    manager.clear();
    assert.strictEqual(manager.getTotalTopicCount(), 0);
    assert.strictEqual(manager.getMessageHistory('test/topic').length, 0);
  });

  it('should store and retrieve MQTT 5.0 user properties', () => {
    const userProperties = {
      traceId: '1234-abcd',
      environment: 'production',
    };

    const msg = manager.addMessage('telemetry/v2', Buffer.from('data'), 1, false, userProperties);
    assert.deepStrictEqual(msg.userProperties, userProperties);

    const history = manager.getMessageHistory('telemetry/v2');
    assert.strictEqual(history[0].userProperties?.traceId, '1234-abcd');
  });

  it('should return undefined for non-existent topic nodes', () => {
    manager.addMessage('a/b/c', Buffer.from('val'), 0, false);
    assert.strictEqual(manager.getNodeByTopic('a/b/nonexistent'), undefined);
    assert.ok(manager.getNodeByTopic('a/b/c'));
  });
});
