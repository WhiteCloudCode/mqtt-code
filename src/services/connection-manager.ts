import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import * as mqtt from 'mqtt';
import { EventEmitter } from 'node:events';
import { BrokerProfile, BrokerConnectionStatus, ConnectionState } from '../models/broker-profile';
import { PublishRequest } from '../models/mqtt-message';
import { StorageService } from './storage-service';
import { TopicTreeManager } from './topic-tree-manager';
import { LogService } from './log-service';

export class ConnectionManager extends EventEmitter {
  private clients: Map<string, mqtt.MqttClient> = new Map();
  private brokers: Map<string, BrokerProfile> = new Map();
  private statuses: Map<string, BrokerConnectionStatus> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private topicTreeManagers: Map<string, TopicTreeManager> = new Map();

  private readonly storageService: StorageService;
  private readonly maxMessagesPerTopic: number;
  private readonly logService: LogService;

  constructor(storageService: StorageService, maxMessagesPerTopic: number = 100) {
    super();
    this.storageService = storageService;
    this.maxMessagesPerTopic = maxMessagesPerTopic;
    this.logService = LogService.getInstance();
  }

  public getActiveBroker(brokerId: string): BrokerProfile | undefined {
    return this.brokers.get(brokerId);
  }

  public getConnectedBrokers(): BrokerProfile[] {
    return Array.from(this.brokers.values()).filter((b) => this.isConnected(b.id));
  }

  public getConnectionStatus(brokerId: string): BrokerConnectionStatus {
    return this.statuses.get(brokerId) || { brokerId, state: 'disconnected' };
  }

  public getSubscriptions(brokerId: string): string[] {
    const subs = this.subscriptions.get(brokerId);
    return subs ? Array.from(subs) : [];
  }

  public getAllSubscriptions(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const [brokerId, subs] of this.subscriptions.entries()) {
      map.set(brokerId, Array.from(subs));
    }
    return map;
  }

  public isConnected(brokerId: string): boolean {
    const status = this.statuses.get(brokerId);
    return status?.state === 'connected' && this.clients.has(brokerId);
  }

  public getTopicTreeManager(brokerId: string): TopicTreeManager | undefined {
    return this.topicTreeManagers.get(brokerId);
  }

  public async connect(broker: BrokerProfile): Promise<void> {
    this.logService.info(
      `Attempting connection to broker "${broker.name}" (${broker.host}:${broker.port})...`
    );

    // If already connected/connecting, disconnect first
    if (this.clients.has(broker.id)) {
      this.logService.info(
        `Cleaning up existing client for "${broker.name}" before reconnecting...`
      );
      await this.disconnect(broker.id);
    }

    this.brokers.set(broker.id, broker);
    this.updateStatus(broker.id, 'connecting');

    // Initialise or clear TopicTreeManager for this broker
    let ttm = this.topicTreeManagers.get(broker.id);
    if (!ttm) {
      ttm = new TopicTreeManager(this.maxMessagesPerTopic);
      this.topicTreeManagers.set(broker.id, ttm);
    } else {
      ttm.clear();
    }

    this.subscriptions.set(broker.id, new Set());

    const password = await this.storageService.getBrokerPassword(broker.id);
    const protocol = broker.protocol || 'mqtt://';
    const brokerUrl = `${protocol}${broker.host}:${broker.port}`;
    const options = this.buildClientOptions(broker, password);

    try {
      const client = mqtt.connect(brokerUrl, options);
      this.clients.set(broker.id, client);
      this.bindClientEvents(client, broker, ttm);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logService.error(
        `Failed to initialise MQTT connection to "${broker.name}": ${errorMsg}`,
        err
      );
      this.updateStatus(broker.id, 'error', errorMsg);
      throw err;
    }
  }

  private buildClientOptions(broker: BrokerProfile, password?: string): mqtt.IClientOptions {
    const options: mqtt.IClientOptions = {
      clientId: broker.clientId || `mqtt_code_${crypto.randomUUID().substring(0, 8)}`,
      clean: broker.cleanSession ?? true,
      keepalive: broker.keepalive ?? 60,
      protocolVersion: broker.mqttVersion === '5.0' ? 5 : 4,
      reconnectPeriod: 4000,
      connectTimeout: 10000,
      rejectUnauthorized: broker.rejectUnauthorized ?? true,
    };

    if (broker.username) {
      options.username = broker.username;
    }
    if (password) {
      options.password = password;
    }

    this.attachTlsCertificates(broker, options);
    return options;
  }

  private attachTlsCertificates(broker: BrokerProfile, options: mqtt.IClientOptions): void {
    if (broker.caCertPath && fs.existsSync(broker.caCertPath)) {
      try {
        options.ca = fs.readFileSync(broker.caCertPath);
      } catch (err) {
        this.logService.error(`Failed to read CA certificate at "${broker.caCertPath}":`, err);
      }
    }
    if (broker.clientCertPath && fs.existsSync(broker.clientCertPath)) {
      try {
        options.cert = fs.readFileSync(broker.clientCertPath);
      } catch (err) {
        this.logService.error(
          `Failed to read client certificate at "${broker.clientCertPath}":`,
          err
        );
      }
    }
    if (broker.clientKeyPath && fs.existsSync(broker.clientKeyPath)) {
      try {
        options.key = fs.readFileSync(broker.clientKeyPath);
      } catch (err) {
        this.logService.error(
          `Failed to read client private key at "${broker.clientKeyPath}":`,
          err
        );
      }
    }
  }

  private bindClientEvents(
    client: mqtt.MqttClient,
    broker: BrokerProfile,
    ttm: TopicTreeManager
  ): void {
    client.on('connect', () => {
      this.logService.info(`Successfully connected to broker "${broker.name}".`);
      this.updateStatus(broker.id, 'connected');
      broker.lastConnectedAt = Date.now();
      this.storageService.saveBroker(broker).catch((err) => {
        this.logService.warn(
          `Failed to update lastConnectedAt for "${broker.name}": ${String(err)}`
        );
      });

      const initialSubscriptions =
        broker.subscriptions && broker.subscriptions.length > 0 ? broker.subscriptions : ['#'];
      for (const sub of initialSubscriptions) {
        this.subscribe(broker.id, sub).catch((err) => {
          this.logService.warn(
            `Initial subscription to "${sub}" on "${broker.name}" failed: ${String(err)}`
          );
        });
      }
    });

    client.on('reconnect', () => {
      this.logService.info(`Reconnecting to broker "${broker.name}"...`);
      this.updateStatus(broker.id, 'reconnecting');
    });

    client.on('close', () => {
      this.logService.info(`Connection closed for broker "${broker.name}".`);
      const status = this.statuses.get(broker.id);
      if (status && status.state !== 'disconnected') {
        this.updateStatus(broker.id, 'disconnected');
      }
    });

    client.on('error', (err: Error) => {
      this.logService.error(`Broker error on "${broker.name}": ${err.message}`, err);
      this.updateStatus(broker.id, 'error', err.message);
    });

    client.on('message', (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
      const userProps = packet.properties?.userProperties as
        Record<string, string | string[]> | undefined;
      ttm.addMessage(topic, payload, packet.qos, packet.retain, userProps);
    });
  }

  public async disconnect(brokerId?: string): Promise<void> {
    if (brokerId) {
      await this.disconnectSingle(brokerId);
    } else {
      const promises = Array.from(this.clients.keys()).map((id) => this.disconnectSingle(id));
      await Promise.all(promises);
    }
  }

  private async disconnectSingle(brokerId: string): Promise<void> {
    const client = this.clients.get(brokerId);
    const broker = this.brokers.get(brokerId);
    const brokerName = broker ? broker.name : 'unknown broker';

    if (client) {
      this.logService.info(`Disconnecting from "${brokerName}"...`);
      this.clients.delete(brokerId);

      // Remove all listeners to avoid state updates during teardown
      client.removeAllListeners();

      await new Promise<void>((resolve) => {
        try {
          client.end(true, {}, () => {
            resolve();
          });
        } catch {
          resolve();
        }
      });
    }

    this.finishDisconnect(brokerId);
  }

  private finishDisconnect(brokerId: string): void {
    this.updateStatus(brokerId, 'disconnected');
    this.brokers.delete(brokerId);
    this.subscriptions.delete(brokerId);
    // Note: We keep the TopicTreeManager around so if the tab is still open, it shows the old data,
    // or if they reconnect, it clears it then.
  }

  public async subscribe(brokerId: string, topicFilter: string, qos: 0 | 1 | 2 = 0): Promise<void> {
    const client = this.clients.get(brokerId);
    if (!client || !this.isConnected(brokerId)) {
      throw new Error(`No active connection for broker ID ${brokerId}.`);
    }

    return new Promise<void>((resolve, reject) => {
      client.subscribe(topicFilter, { qos }, (err) => {
        if (err) {
          this.logService.error(
            `Failed to subscribe to topic "${topicFilter}": ${err.message}`,
            err
          );
          reject(err);
        } else {
          this.logService.info(`Subscribed to topic "${topicFilter}" (QoS ${qos}).`);
          let subs = this.subscriptions.get(brokerId);
          if (!subs) {
            subs = new Set();
            this.subscriptions.set(brokerId, subs);
          }
          subs.add(topicFilter);

          const broker = this.brokers.get(brokerId);
          if (broker) {
            this.storageService.saveBrokerSubscriptions(brokerId, Array.from(subs)).catch(() => {});
          }
          this.emit('subscriptionChange', brokerId, Array.from(subs));
          resolve();
        }
      });
    });
  }

  public async unsubscribe(brokerId: string, topicFilter: string): Promise<void> {
    const client = this.clients.get(brokerId);
    if (!client || !this.isConnected(brokerId)) {
      throw new Error(`No active connection for broker ID ${brokerId}.`);
    }

    return new Promise<void>((resolve, reject) => {
      client.unsubscribe(topicFilter, undefined, (err) => {
        if (err) {
          this.logService.error(
            `Failed to unsubscribe from topic "${topicFilter}": ${err.message}`,
            err
          );
          reject(err);
        } else {
          this.logService.info(`Unsubscribed from topic "${topicFilter}".`);
          const subs = this.subscriptions.get(brokerId);
          if (subs) {
            subs.delete(topicFilter);
            const broker = this.brokers.get(brokerId);
            if (broker) {
              this.storageService
                .saveBrokerSubscriptions(brokerId, Array.from(subs))
                .catch(() => {});
            }
            this.emit('subscriptionChange', brokerId, Array.from(subs));
          }
          resolve();
        }
      });
    });
  }

  public async publish(brokerId: string, request: PublishRequest): Promise<void> {
    const client = this.clients.get(brokerId);
    if (!client || !this.isConnected(brokerId)) {
      throw new Error(`No active connection for broker ID ${brokerId}.`);
    }

    const broker = this.brokers.get(brokerId);
    const publishOptions: mqtt.IClientPublishOptions = {
      qos: request.qos,
      retain: request.retain,
    };

    if (request.userProperties && broker?.mqttVersion === '5.0') {
      publishOptions.properties = {
        userProperties: request.userProperties,
      };
    }

    return new Promise<void>((resolve, reject) => {
      client.publish(request.topic, request.payload, publishOptions, (err) => {
        if (err) {
          this.logService.error(
            `Failed to publish message to "${request.topic}": ${err.message}`,
            err
          );
          reject(err);
        } else {
          this.logService.info(
            `Published message to "${request.topic}" (QoS ${request.qos}, Retain ${request.retain}).`
          );
          resolve();
        }
      });
    });
  }

  private updateStatus(brokerId: string, state: ConnectionState, errorMessage?: string): void {
    const status: BrokerConnectionStatus = {
      brokerId,
      state,
      errorMessage,
      connectedAt: state === 'connected' ? Date.now() : undefined,
    };
    this.statuses.set(brokerId, status);
    try {
      this.emit('statusChange', status);
    } catch (err) {
      this.logService.error('Error emitted in statusChange listener:', err);
    }
  }
}
