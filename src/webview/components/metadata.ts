import { BrokerConnectionStatus, BrokerProfile } from '../../models/broker-profile';
import { brokerStatusBadge, brokerEndpointLabel, setTextContentIfChanged } from '../dom';

export function updateConnectionStatus(status: BrokerConnectionStatus, broker?: BrokerProfile) {
  if (!brokerStatusBadge || !brokerEndpointLabel) {
    return;
  }

  brokerStatusBadge.className = `badge badge-${status.state}`;
  setTextContentIfChanged(brokerStatusBadge, status.state);

  if (broker) {
    setTextContentIfChanged(
      brokerEndpointLabel,
      `${broker.name} (${broker.protocol}${broker.host}:${broker.port})`
    );
  } else {
    setTextContentIfChanged(
      brokerEndpointLabel,
      status.errorMessage ? `Error: ${status.errorMessage}` : 'No active connection'
    );
  }
}
