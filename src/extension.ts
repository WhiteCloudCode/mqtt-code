import * as vscode from 'vscode';

import { StorageService } from './services/storage-service';
import { ConnectionManager } from './services/connection-manager';
import { BrokerTreeProvider, BrokerTreeItem } from './views/broker-tree-provider';
import {
  SubscriptionTreeProvider,
  SubscriptionTreeItem,
  SubscriptionBrokerTreeItem,
} from './views/subscription-tree-provider';
import { BrokerFormPanel } from './panels/broker-form-panel';
import {
  handleOpenExplorer,
  handleDisconnectBroker,
  handleEditBroker,
  handleDeleteBroker,
  handleConnectBroker,
} from './commands/broker-commands';
import {
  handleAddSubscription,
  handleEditSubscription,
  handleRemoveSubscription,
} from './commands/subscription-commands';
import { handleQuickPublish } from './commands/publish-commands';

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

  let statusBarDebounceTimer: NodeJS.Timeout | undefined;
  connectionManager.on('statusChange', () => {
    if (statusBarDebounceTimer) {
      clearTimeout(statusBarDebounceTimer);
    }
    statusBarDebounceTimer = setTimeout(() => {
      updateStatusBar(statusBarItem, connectionManager);
    }, 100);
  });

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('mqtt-code.refresh-brokers', () => {
      brokerTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('mqtt-code.open-explorer', async (item?: BrokerTreeItem) => {
      await handleOpenExplorer(item, connectionManager, context.extensionUri, storageService);
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
        await handleDisconnectBroker(item, connectionManager);
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

export function deactivate() {
  // connectionManager handles its own disconnects and panels dispose themselves on extension close
}
