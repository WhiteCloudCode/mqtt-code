import { PublishRequest } from '../models/mqtt-message';
import { BrokerProfile } from '../models/broker-profile';

// Messages sent from Webview to Extension
export type WebviewToExtensionMessage =
  | { type: 'requestState' }
  | { type: 'requestHistory'; topic: string }
  | { type: 'publish'; data: PublishRequest }
  | { type: 'subscribe'; topic: string; qos: 0 | 1 | 2 }
  | { type: 'unsubscribe'; topic: string }
  | { type: 'clearTree' }
  | { type: 'savePublisherState'; data: boolean }
  | { type: 'saveLayoutState'; data: { topicPaneWidth?: string } }
  | { type: 'executeCommand'; command: string; args?: unknown[] };

// Messages sent from Extension to Webview
export type ExtensionToWebviewMessage =
  | {
      type: 'fullStateUpdate';
      tree: unknown;
      broker: BrokerProfile | undefined;
      status: string;
      subscriptions: string[];
      layoutState?: unknown;
    }
  | { type: 'statusUpdate'; status: string; broker: BrokerProfile | undefined }
  | { type: 'historyUpdate'; topic: string; history: unknown[] }
  | { type: 'subscriptionsUpdate'; subscriptions: string[] };
