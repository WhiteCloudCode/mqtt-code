export type BrokerFormToExtensionMessage =
  | { type: 'saveBroker'; data: unknown }
  | { type: 'testConnection'; data: unknown }
  | { type: 'cancel' }
  | { type: 'selectFile'; fileType: 'ca' | 'cert' | 'key' }
  | { type: 'requestInitData' };

export type ExtensionToBrokerFormMessage =
  | { type: 'initData'; broker?: unknown; title: string }
  | { type: 'fileSelected'; fileType: 'ca' | 'cert' | 'key'; filePath: string }
  | { type: 'testResult'; success: boolean; error?: string };
