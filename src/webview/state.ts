import { MqttMessage } from '../models/mqtt-message';
import { SerialisedTopicNode } from '../models/topic-node';
import * as echarts from 'echarts';

import { WebviewToExtensionMessage } from '../types/webview-messages';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;
export const vscode = acquireVsCodeApi();

// Global State
export const state = {
  rootTree: null as SerialisedTopicNode | null,
  selectedTopic: null as string | null,
  previousSelectedTopic: null as string | null,
  currentFormat: 'auto' as 'auto' | 'text' | 'hex' | 'base64',
  userToggledNodes: new Map<string, boolean>(),
  currentViewMode: 'tree' as 'tree' | 'list',
  filterQuery: '',
  currentHistory: [] as MqttMessage[],
  historyFormat: 'auto' as 'auto' | 'text' | 'hex' | 'base64',
  currentHistoryMessage: null as MqttMessage | null,
  intermediateViewMode: 'firehose' as 'firehose' | 'sankey',
  sankeyChartInstance: null as echarts.ECharts | null,
};
