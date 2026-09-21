# MQTT Code - Granular Feature Checklist

This document lists every piece of functionality in the **MQTT Code** extension at a highly granular level. This serves as a definitive checklist for AI agents and contributors to ensure no existing functionality is unintentionally broken, removed, or degraded when introducing changes.

## 1. Broker Profiles Management
- **Activity Bar View**: "Brokers" (`mqtt-code-brokers`) tree view.
- **Add Broker** (`mqtt-code.add-broker`): Opens the webview form to create a new profile.
- **Edit Broker** (`mqtt-code.edit-broker`): Available via inline action or command palette; opens the form populated with existing data.
- **Delete Broker** (`mqtt-code.delete-broker`): Prompts for confirmation, disconnects if active, and deletes the profile.
- **Connect to Broker** (`mqtt-code.connect-broker`): Initiates connection.
- **Disconnect from Broker** (`mqtt-code.disconnect-broker`): Closes the active connection.
- **Refresh Brokers** (`mqtt-code.refresh-brokers`): Refreshes the tree view.
- **Open Explorer** (`mqtt-code.open-explorer`): Opens the Live Topic Explorer webview for the connected broker.

## 2. Broker Configuration Form (Webview Panel)
- **Dedicated Webview Panel**: For adding/editing configurations safely.
- **Connection Test**: "Test Connection" button tests the broker parameters (timeout 5s) before saving.
- **Fields Configurable**:
  - Broker Name
  - Protocol (`mqtt://`, `mqtts://`, `ws://`, `wss://`)
  - Host and Port
  - Client ID (includes auto-generate button)
  - Username & Password
  - MQTT Version (`3.1.1` or `5.0`)
  - Clean Session toggle
  - Keepalive interval (seconds)
  - Reject Unauthorized (SSL/TLS validation toggle)
  - CA Certificate (File picker integration)
  - Client Certificate (File picker integration)
  - Client Key (File picker integration)
- **Secure Storage**: Passwords and private keys/certs are saved using VS Code's `SecretStorage` (never in plain text).

## 3. Active Subscriptions Management
- **Activity Bar View**: "Active Subscriptions" (`mqtt-code-subscriptions`) tree view.
- **Grouping**: Subscriptions are grouped under their respective connected broker.
- **Add Subscription** (`mqtt-code.add-subscription`): Prompts for topic filter (supports wildcards `#` and `+`) and QoS (`0`, `1`, `2`).
- **Edit Subscription** (`mqtt-code.edit-subscription`): Inline action to change topic filter or QoS. Unsubscribes from old, subscribes to new.
- **Remove Subscription** (`mqtt-code.remove-subscription`): Inline action to unsubscribe and remove from the list.

## 4. Live Topic Explorer (Webview Dashboard)
### General Layout & Mechanics
- **Auto-open**: Opens automatically on connection (configurable).
- **Resizable Sidebar**: Draggable pane resizer between the topic tree and payload inspector. Width state is preserved (`saveLayoutState`).
- **Global Actions**: "Clear Tree" (flushes all received topics) and "Refresh State" buttons.

### Topic Navigation (Sidebar)
- **Tree View Mode**:
  - Hierarchical rendering of incoming topic segments.
  - **Path Compression**: Auto-squashes single-child nodes with no direct payloads into a single path (e.g., `dt/gtl/heartbeat/s`) to reduce UI clutter.
  - Expand/Collapse twisties (state preserved per node).
  - Message count badges (colour-coded by node depth).
  - "Expand All" and "Collapse All" actions.
- **List View Mode**: Flat list view alternative to the tree view.
- **Search/Filter**: Live text input filtering topics by string match; includes a "Clear Search" button.

### Topic Metadata & Payload Inspector (Main View)
- **Dynamic Tab Visibility**: Only relevant tabs are shown.
  - *Leaf Node* (Payload only): Payload, History, Properties tabs.
  - *Intermediate Node* (Children, no payload): Traffic tab only.
  - *Hybrid Node* (Children AND payload): All 4 tabs.
- **Metadata Header**:
  - Shows selected topic path (resolves squashed paths) with individual segments rendered as selectable badges to easily select and copy partial paths.
  - Displays QoS, Retained status, Message Size (formatted bytes), Last Received Time, and Message Count (aggregated for intermediate nodes).
  - "Copy Topic" button.
  - "Copy Payload" button.
- **Payload Tab**:
  - Displays the payload of the last received message.
  - **Format Toggles**: Auto (Syntax highlighted JSON or raw text), Text, Hex Dump, Base64.
- **History Tab**:
  - Table of historical messages for the node (configured by `mqttCode.maxMessagesPerTopic`).
  - Columns: Time, QoS, Retained, Size, Payload Snippet.
  - **History Modal**: Clicking a row opens a modal showing full payload with format toggles, utilizing a secondary read-only Monaco Editor instance.
- **Properties Tab**:
  - Displays MQTT 5.0 User Properties associated with the message.
- **Traffic Tab (For Intermediate Nodes)**:
  - **Firehose View**: Real-time scrolling list of the last 50 messages traversing the selected branch. Clickable to open History Modal.
  - **Sankey View**: ECharts-based Sankey diagram visualising message volume flow across sub-topics.

### Publishing Suite (Bottom Drawer)
- **Collapsible Drawer**: State is remembered (`savePublisherState`).
- **Input Fields**:
  - Topic (Auto-fills with currently selected topic).
  - QoS dropdown (0, 1, 2).
  - Retain toggle (Yes/No).
  - Payload textarea (JSON or Text).
  - **User Properties**: Dynamic key-value pairs to attach MQTT 5.0 User Properties to outgoing messages.
- **Helpers**:
  - "Format JSON": Validates and pretty-prints JSON payloads.
  - "Sample JSON": Injects a mock telemetry JSON payload.
- **Validation**: Enforces non-empty topic strings.

## 5. Quick Publish (Command Palette)
- **Command**: `mqtt-code.quick-publish`
- Walks the user through VS Code QuickPicks and InputBoxes to publish a message without opening the Webview.
- Prompts: Select Broker (if multiple) -> Topic -> Payload -> QoS -> Retain.

## 6. Status Bar Integration
- Right-aligned status bar item.
- Displays: "Disconnected", "MQTT: [Broker Name]", or "MQTT: X Connected".
- Hover tooltip shows a list of active connections.
- Click action defaults to opening the Live Topic Explorer.

## 7. Extension Settings (Configuration)
- `mqttCode.maxMessagesPerTopic`: (Integer) Maximum number of historical messages retained per topic in memory (default: 100).
- `mqttCode.autoOpenExplorerOnConnect`: (Boolean) Automatically open the interactive Live Topic Explorer panel when connecting to a broker (default: true).
- `mqttCode.defaultQoS`: (Integer) Default Quality of Service level for new subscriptions and publications (default: 0).

