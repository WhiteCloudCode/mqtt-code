import * as assert from 'assert';
import { buildTreeDOM } from '../../webview/views/topic-tree';
import { SerialisedTopicNode } from '../../models/topic-node';

suite('Webview Topic Tree DOM', () => {
  setup(() => {
    // Setup necessary DOM elements expected by imported modules
    document.body.innerHTML = `
      <div id="topic-tree-container"></div>
      <input id="pub-topic" />
    `;
  });

  test('Compresses single-child topics (e.g. sys/devices/gateway/status)', () => {
    // Construct mock tree: sys -> devices -> gateway -> status
    const rootNode: SerialisedTopicNode = {
      name: 'sys',
      fullTopic: 'sys',
      messageCount: 0,
      lastUpdated: 0,
      hasRetainedMessage: false,
      children: {
        devices: {
          name: 'devices',
          fullTopic: 'sys/devices',
          messageCount: 0,
          lastUpdated: 0,
          hasRetainedMessage: false,
          children: {
            gateway: {
              name: 'gateway',
              fullTopic: 'sys/devices/gateway',
              messageCount: 0,
              lastUpdated: 0,
              hasRetainedMessage: false,
              children: {
                status: {
                  name: 'status',
                  fullTopic: 'sys/devices/gateway/status',
                  messageCount: 0,
                  lastUpdated: 0,
                  hasRetainedMessage: false,
                  children: {
                    f412fad4e6e4: {
                      name: 'f412fad4e6e4',
                      fullTopic: 'sys/devices/gateway/status/f412fad4e6e4',
                      messageCount: 1,
                      lastUpdated: 1,
                      hasRetainedMessage: false,
                      lastMessage: {
                        id: 'msg-1',
                        topic: 'sys/devices/gateway/status/f412fad4e6e4',
                        payload: '1',
                        qos: 0,
                        retain: false,
                        sizeBytes: 1,
                        timestamp: 1,
                        isJson: false,
                      },
                      children: {},
                    },
                    f412fad4e710: {
                      name: 'f412fad4e710',
                      fullTopic: 'sys/devices/gateway/status/f412fad4e710',
                      messageCount: 1,
                      lastUpdated: 1,
                      hasRetainedMessage: false,
                      lastMessage: {
                        id: 'msg-2',
                        topic: 'sys/devices/gateway/status/f412fad4e710',
                        payload: '1',
                        qos: 0,
                        retain: false,
                        sizeBytes: 1,
                        timestamp: 1,
                        isJson: false,
                      },
                      children: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const dom = buildTreeDOM(rootNode, 'sys', 1);
    assert.ok(dom, 'DOM should be built');

    const label = dom?.querySelector('.tree-node-label');
    assert.strictEqual(label?.textContent, 'sys/devices/gateway/status');
  });
});
