import * as vscode from 'vscode';

import { StorageService } from './services/storage-service';
import { ConnectionManager } from './services/connection-manager';
import { BrokerTreeProvider, BrokerTreeItem } from './views/broker-tree-provider';
import {
  SubscriptionTreeProvider,
  SubscriptionTreeItem,
  SubscriptionBrokerTreeItem,
} from './views/subscription-tree-provider';
import { ExplorerPanel } from './panels/explorer-panel';
import { BrokerFormPanel } from './panels/broker-form-panel';

export function activate(context: vscode.ExtensionContext) {
  // Initialise core services
  const storageService = new StorageService(context);
  const config = vscode.workspace.getConfiguration('mqttCode');
  const maxMessages = config.get<number>('maxMessagesPerTopic', 100);
  const connectionManager = new ConnectionManager(storageService, maxMessages);

  // Initialise Tree Data Providers
  const brokerTreeProvider = new BrokerTreeProvider(storageService, connectionManager);
  const subscriptionTreeProvider = new SubscriptionTreeProvider(connectionManager);

  vscode.window.registerTreeDataProvider('mqtt-code-brokers', brokerTreeProvider);
  vscode.window.registerTreeDataProvider('mqtt-code-subscriptions', subscriptionTreeProvider);

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'mqtt-code.open-explorer';
  updateStatusBar(statusBarItem, connectionManager);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  connectionManager.on('statusChange', () => {
    updateStatusBar(statusBarItem, connectionManager);
  });

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mqtt-code.refresh-brokers', () => {
      brokerTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('mqtt-code.open-explorer', async (item?: BrokerTreeItem) => {
      let brokerId = item?.profile.id;
      if (!brokerId) {
        const connectedBrokers = connectionManager.getConnectedBrokers();
        if (connectedBrokers.length === 0) {
          vscode.window.showInformationMessage('No active connections to open.');
          return;
        } else if (connectedBrokers.length === 1) {
          brokerId = connectedBrokers[0].id;
        } else {
          const picked = await vscode.window.showQuickPick(
            connectedBrokers.map((b) => ({
              label: b.name,
              description: `${b.host}:${b.port}`,
              brokerId: b.id,
            })),
            { placeHolder: 'Select active broker to open Explorer for' }
          );
          if (!picked) {
            return;
          }
          brokerId = picked.brokerId;
        }
      }
      ExplorerPanel.createOrShow(context.extensionUri, connectionManager, brokerId, storageService);
    }),

    vscode.commands.registerCommand('mqtt-code.add-broker', () => {
      BrokerFormPanel.createOrShow(context.extensionUri, storageService, brokerTreeProvider);
    }),

    vscode.commands.registerCommand('mqtt-code.edit-broker', async (item?: BrokerTreeItem) => {
      await handleEditBroker(item, context.extensionUri, storageService, brokerTreeProvider);
    }),

    vscode.commands.registerCommand('mqtt-code.delete-broker', async (item?: BrokerTreeItem) => {
      await handleDeleteBroker(item, storageService, brokerTreeProvider, connectionManager);
    }),

    vscode.commands.registerCommand('mqtt-code.connect-broker', async (item?: BrokerTreeItem) => {
      await handleConnectBroker(item, storageService, connectionManager, context.extensionUri);
    }),

    vscode.commands.registerCommand(
      'mqtt-code.disconnect-broker',
      async (item?: BrokerTreeItem) => {
        let brokerId = item?.profile.id;
        if (!brokerId) {
          const connectedBrokers = connectionManager.getConnectedBrokers();
          if (connectedBrokers.length === 0) {
            return;
          }
          if (connectedBrokers.length === 1) {
            brokerId = connectedBrokers[0].id;
          } else {
            const picked = await vscode.window.showQuickPick(
              connectedBrokers.map((b) => ({
                label: b.name,
                description: `${b.host}:${b.port}`,
                brokerId: b.id,
              })),
              { placeHolder: 'Select broker to disconnect' }
            );
            if (!picked) {
              return;
            }
            brokerId = picked.brokerId;
          }
        }
        await connectionManager.disconnect(brokerId);
        vscode.window.showInformationMessage('Disconnected from MQTT broker.');
      }
    ),

    vscode.commands.registerCommand(
      'mqtt-code.add-subscription',
      async (item?: SubscriptionBrokerTreeItem) => {
        await handleAddSubscription(item, connectionManager);
      }
    ),

    vscode.commands.registerCommand(
      'mqtt-code.edit-subscription',
      async (item?: SubscriptionTreeItem) => {
        await handleEditSubscription(item, connectionManager);
      }
    ),

    vscode.commands.registerCommand(
      'mqtt-code.remove-subscription',
      async (item?: SubscriptionTreeItem) => {
        await handleRemoveSubscription(item, connectionManager);
      }
    ),

    vscode.commands.registerCommand('mqtt-code.quick-publish', async () => {
      await handleQuickPublish(connectionManager);
    })
  );
}

function updateStatusBar(
  statusBarItem: vscode.StatusBarItem,
  connectionManager: ConnectionManager
) {
  const connectedBrokers = connectionManager.getConnectedBrokers();

  if (connectedBrokers.length === 1) {
    const broker = connectedBrokers[0];
    statusBarItem.text = `$(plug) MQTT: ${broker.name}`;
    statusBarItem.tooltip = `Connected to ${broker.host}:${broker.port} - Click to open Explorer`;
    statusBarItem.backgroundColor = undefined;
  } else if (connectedBrokers.length > 1) {
    statusBarItem.text = `$(plug) MQTT: ${connectedBrokers.length} Connected`;
    statusBarItem.tooltip =
      `Connected to:\n` +
      connectedBrokers.map((b) => `- ${b.name}`).join('\n') +
      `\nClick to select broker`;
    statusBarItem.backgroundColor = undefined;
  } else {
    // Check if any is connecting or error (we'll just take the first we find, if any)
    // For a robust implementation, we might not track error states globally in status bar if multi-broker,
    // but we can just say "Disconnected"
    statusBarItem.text = `$(circle-slash) MQTT: Disconnected`;
    statusBarItem.tooltip = 'Click to view connections';
    statusBarItem.backgroundColor = undefined;
  }
}

async function handleEditBroker(
  item: BrokerTreeItem | undefined,
  extensionUri: vscode.Uri,
  storageService: StorageService,
  brokerTreeProvider: BrokerTreeProvider
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      vscode.window.showInformationMessage('No broker profiles available to edit.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to edit' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  BrokerFormPanel.createOrShow(extensionUri, storageService, brokerTreeProvider, profile);
}

async function handleDeleteBroker(
  item: BrokerTreeItem | undefined,
  storageService: StorageService,
  brokerTreeProvider: BrokerTreeProvider,
  connectionManager: ConnectionManager
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      vscode.window.showInformationMessage('No broker profiles available to delete.');
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to delete' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete broker profile "${profile.name}"?`,
    { modal: true },
    'Delete'
  );
  if (confirm === 'Delete') {
    if (connectionManager.isConnected(profile.id)) {
      await connectionManager.disconnect(profile.id);
    }
    await storageService.deleteBroker(profile.id);
    brokerTreeProvider.refresh();
    vscode.window.showInformationMessage(`Deleted broker profile "${profile.name}".`);
  }
}

async function handleConnectBroker(
  item: BrokerTreeItem | undefined,
  storageService: StorageService,
  connectionManager: ConnectionManager,
  extensionUri: vscode.Uri
) {
  let profile = item?.profile;
  if (!profile) {
    const brokers = await storageService.getBrokers();
    if (brokers.length === 0) {
      const addOption = 'Add New Broker';
      const selected = await vscode.window.showInformationMessage(
        'No broker profiles found. Add one to connect.',
        addOption
      );
      if (selected === addOption) {
        vscode.commands.executeCommand('mqtt-code.add-broker');
      }
      return;
    }
    const picked = await vscode.window.showQuickPick(
      brokers.map((b) => ({
        label: b.name,
        description: `${b.protocol}${b.host}:${b.port}`,
        broker: b,
      })),
      { placeHolder: 'Select broker to connect' }
    );
    if (!picked) {
      return;
    }
    profile = picked.broker;
  }

  try {
    await connectionManager.connect(profile);
    const config = vscode.workspace.getConfiguration('mqttCode');
    if (config.get<boolean>('autoOpenExplorerOnConnect', true)) {
      ExplorerPanel.createOrShow(extensionUri, connectionManager, profile.id, storageService);
    }
    vscode.window.showInformationMessage(`Connected to MQTT broker "${profile.name}".`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to connect to "${profile.name}": ${msg}`);
  }
}

async function handleAddSubscription(
  item: SubscriptionBrokerTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  let brokerId = item?.brokerId;
  if (!brokerId) {
    const connectedBrokers = connectionManager.getConnectedBrokers();
    if (connectedBrokers.length === 0) {
      vscode.window.showWarningMessage(
        'Please connect to an MQTT broker before adding a subscription.'
      );
      return;
    } else if (connectedBrokers.length === 1) {
      brokerId = connectedBrokers[0].id;
    } else {
      const picked = await vscode.window.showQuickPick(
        connectedBrokers.map((b) => ({
          label: b.name,
          description: `${b.host}:${b.port}`,
          brokerId: b.id,
        })),
        { placeHolder: 'Select broker for subscription' }
      );
      if (!picked) {
        return;
      }
      brokerId = picked.brokerId;
    }
  }

  const filter = await vscode.window.showInputBox({
    prompt: 'Enter topic subscription filter (supports wildcards # and +)',
    placeHolder: 'e.g. # or sensors/+/temperature',
    value: '#',
    validateInput: (val) => (val.trim().length === 0 ? 'Topic filter cannot be empty' : null),
  });
  if (!filter) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select subscription QoS level' }
  );
  const qos = (qosPick ? Number.parseInt(qosPick.label, 10) : 0) as 0 | 1 | 2;

  try {
    await connectionManager.subscribe(brokerId, filter.trim(), qos);
    vscode.window.showInformationMessage(`Subscribed to topic filter: ${filter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to subscribe: ${msg}`);
  }
}

async function handleEditSubscription(
  item: SubscriptionTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  const topicFilter = item?.topicFilter;
  const brokerId = item?.brokerId;

  if (!topicFilter || !brokerId) {
    vscode.window.showInformationMessage(
      'Please edit subscriptions via the tree view inline action.'
    );
    return;
  }

  const newFilter = await vscode.window.showInputBox({
    prompt: 'Edit topic subscription filter',
    value: topicFilter,
    validateInput: (val) => (val.trim().length === 0 ? 'Topic filter cannot be empty' : null),
  });

  if (!newFilter || newFilter.trim() === topicFilter) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select subscription QoS level' }
  );
  if (!qosPick) {
    return;
  }
  const qos = Number.parseInt(qosPick.label, 10) as 0 | 1 | 2;

  try {
    await connectionManager.unsubscribe(brokerId, topicFilter);
    await connectionManager.subscribe(brokerId, newFilter.trim(), qos);
    vscode.window.showInformationMessage(`Updated subscription to: ${newFilter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to edit subscription: ${msg}`);
  }
}

async function handleRemoveSubscription(
  item: SubscriptionTreeItem | undefined,
  connectionManager: ConnectionManager
) {
  const topicFilter = item?.topicFilter;
  const brokerId = item?.brokerId;

  if (!topicFilter || !brokerId) {
    vscode.window.showInformationMessage(
      'Please remove subscriptions via the tree view inline action.'
    );
    return;
  }

  try {
    await connectionManager.unsubscribe(brokerId, topicFilter);
    vscode.window.showInformationMessage(`Unsubscribed from: ${topicFilter}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to unsubscribe: ${msg}`);
  }
}

async function handleQuickPublish(connectionManager: ConnectionManager) {
  const connectedBrokers = connectionManager.getConnectedBrokers();
  if (connectedBrokers.length === 0) {
    vscode.window.showWarningMessage('Please connect to an MQTT broker before publishing.');
    return;
  }

  let brokerId = connectedBrokers[0].id;
  if (connectedBrokers.length > 1) {
    const picked = await vscode.window.showQuickPick(
      connectedBrokers.map((b) => ({
        label: b.name,
        description: `${b.host}:${b.port}`,
        brokerId: b.id,
      })),
      { placeHolder: 'Select broker to publish to' }
    );
    if (!picked) {
      return;
    }
    brokerId = picked.brokerId;
  }

  const topic = await vscode.window.showInputBox({
    prompt: 'Enter destination topic for publishing',
    placeHolder: 'e.g. test/topic',
    validateInput: (val) => (val.trim().length === 0 ? 'Topic cannot be empty' : null),
  });
  if (!topic) {
    return;
  }

  const payload = await vscode.window.showInputBox({
    prompt: 'Enter message payload (text or JSON)',
    placeHolder: 'e.g. {"status": "ok"}',
    value: 'Hello from MQTT Code!',
  });
  if (payload === undefined) {
    return;
  }

  const qosPick = await vscode.window.showQuickPick(
    [
      { label: '0', description: 'At most once' },
      { label: '1', description: 'At least once' },
      { label: '2', description: 'Exactly once' },
    ],
    { placeHolder: 'Select publish QoS level' }
  );
  const qos = (qosPick ? Number.parseInt(qosPick.label, 10) : 0) as 0 | 1 | 2;

  const retainPick = await vscode.window.showQuickPick(
    [
      { label: 'No', description: 'Do not retain message' },
      { label: 'Yes', description: 'Retain message on broker' },
    ],
    { placeHolder: 'Retain message?' }
  );
  const retain = retainPick?.label === 'Yes';

  try {
    await connectionManager.publish(brokerId, {
      topic: topic.trim(),
      payload,
      qos,
      retain,
    });
    vscode.window.showInformationMessage(`Published message to ${topic}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to publish message: ${msg}`);
  }
}

export function deactivate() {
  // connectionManager handles its own disconnects and panels dispose themselves on extension close
}
