export type MqttProtocol = 'mqtt://' | 'mqtts://' | 'ws://' | 'wss://';

export type MqttVersion = '3.1.1' | '5.0';

export interface BrokerProfile {
  id: string;
  name: string;
  protocol: MqttProtocol;
  host: string;
  port: number;
  clientId?: string;
  username?: string;
  // Note: Password and private certificates are stored in SecretStorage, not in plain config
  hasPassword?: boolean;
  cleanSession?: boolean;
  keepalive?: number;
  mqttVersion?: MqttVersion;
  rejectUnauthorized?: boolean;
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  subscriptions?: string[];
  createdAt: number;
  lastConnectedAt?: number;
}

export type ConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface BrokerConnectionStatus {
  brokerId: string;
  state: ConnectionState;
  errorMessage?: string;
  connectedAt?: number;
}
