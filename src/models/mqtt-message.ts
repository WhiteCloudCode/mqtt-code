export interface UserPropertyMap {
  [key: string]: string | string[];
}

export interface MqttMessage {
  id: string;
  topic: string;
  payload: string; // UTF-8 representation or hex representation
  payloadBuffer?: string; // Base64 encoded raw bytes
  sizeBytes: number;
  qos: 0 | 1 | 2;
  retain: boolean;
  dup?: boolean;
  timestamp: number;
  userProperties?: UserPropertyMap;
  isJson: boolean;
  formattedJson?: string;
}

export interface PublishRequest {
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  userProperties?: UserPropertyMap;
}
