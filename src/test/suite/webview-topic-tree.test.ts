// Mock acquireVsCodeApi before importing any webview code
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).acquireVsCodeApi = () => ({
  postMessage: () => {},
  getState: () => undefined,
  setState: () => {},
});
import * as assert from 'assert';
import { buildTreeHTML } from '../../webview/views/topic-tree';
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

    const html = buildTreeHTML(rootNode, 'sys', 1);
    assert.ok(html, 'HTML should be built');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const label = wrapper.querySelector('.tree-node-label');
    assert.strictEqual(label?.textContent, 'sys/devices/gateway/status');
  });

  test('Un-squashes topics if a payload is published to an intermediate node', () => {
    // Construct mock tree: sys -> devices -> gateway -> status, but "gateway" gets a payload
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
              messageCount: 1,
              lastUpdated: 1,
              hasRetainedMessage: false,
              lastMessage: {
                id: 'msg-payload',
                topic: 'sys/devices/gateway',
                payload: 'offline',
                qos: 0,
                retain: false,
                sizeBytes: 7,
                timestamp: 1,
                isJson: false,
              },
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
                  },
                },
              },
            },
          },
        },
      },
    };

    const html = buildTreeHTML(rootNode, 'sys', 1);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // The root node 'sys' should only compress up to 'devices' -> 'sys/devices'
    // because 'gateway' has a payload and must become a selectable node.
    const rootLabel = wrapper.querySelector('.tree-node-label');
    assert.strictEqual(rootLabel?.textContent, 'sys/devices');

    // First node is sys/devices. We look for 'gateway' inside it.
    let foundGateway = false;
    let foundStatus = false;
    wrapper.querySelectorAll('.tree-node-label').forEach((el) => {
      if (el.textContent === 'gateway') {
        foundGateway = true;
      }
      if (el.textContent === 'status') {
        foundStatus = true;
      }
    });

    assert.ok(foundGateway, 'Gateway should not be squashed into sys/devices');
    assert.ok(foundStatus, 'Status should not be squashed into gateway');
  });
});
