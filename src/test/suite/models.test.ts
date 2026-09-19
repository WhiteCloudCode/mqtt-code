import * as assert from 'assert';
import { TopicNode, serialiseTopicNode } from '../../models/topic-node';

describe('TopicNode and Serialisation Tests', () => {
  it('should recursively serialise TopicNode Map to plain JSON object', () => {
    const root: TopicNode = {
      name: '',
      fullTopic: '',
      children: new Map(),
      messageCount: 0,
      lastUpdated: 1000,
      hasRetainedMessage: false,
    };

    const child: TopicNode = {
      name: 'sensors',
      fullTopic: 'sensors',
      children: new Map(),
      messageCount: 1,
      lastUpdated: 2000,
      hasRetainedMessage: true,
    };

    root.children.set('sensors', child);

    const serialised = serialiseTopicNode(root);
    assert.strictEqual(typeof serialised.children, 'object');
    assert.ok(serialised.children['sensors']);
    assert.strictEqual(serialised.children['sensors'].fullTopic, 'sensors');
    assert.strictEqual(serialised.children['sensors'].hasRetainedMessage, true);
  });
});
