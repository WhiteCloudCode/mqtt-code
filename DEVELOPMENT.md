# MQTT Code - Development Guide

## Architecture & Integration Flow

The extension adopts a hybrid architecture designed to combine lightweight native sidebar views with an interactive editor panel:

```mermaid
flowchart TD
    subgraph VSCodeHost["VS Code Extension Host"]
        ActivityBar["Activity Bar: MQTT Code"]
        BrokerTree["Broker Profiles TreeView"]
        SubTree["Active Subscriptions TreeView"]
        ConnMgr["Connection Manager (MQTT.js)"]
        SecretStore["SecretStorage & GlobalState"]
        TopicMgr["Topic Tree Manager (In-Memory)"]
        PanelMgr["Explorer Webview Panel Manager"]
    end

    subgraph WebviewUI["Interactive Explorer Dashboard (Webview)"]
        TopicTreeView["Hierarchical Topic Tree"]
        MsgInspector["Payload Inspector (JSON / Text / Hex)"]
        PubTool["Message Publishing Suite"]
        SearchFilter["Filter & Search Bar"]
    end

    subgraph RemoteBroker["Remote MQTT Broker(s)"]
        Broker["MQTT 3.1.1 / 5.0 (TCP, TLS, WS, WSS)"]
    end

    ActivityBar --> BrokerTree
    ActivityBar --> SubTree
    BrokerTree -->|Connect / Disconnect| ConnMgr
    ConnMgr <-->|Store / Retrieve Credentials| SecretStore
    ConnMgr <-->|Publish / Subscribe / Stream| Broker
    ConnMgr -->|Raw Packets| TopicMgr
    TopicMgr -->|Aggregated Topic Delta| PanelMgr
    PanelMgr <-->|Bi-directional postMessage| WebviewUI
    PubTool -->|Publish Request| PanelMgr
    PanelMgr -->|Publish Action| ConnMgr
```

## Setup & Building from Source

### Prerequisites
- Node.js (v18 or newer recommended)
- Visual Studio Code v1.90.0 or higher

### Building

1. Navigate to the extension source directory:
   ```bash
   cd mqtt-code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension and webview bundle:
   ```bash
   npm run compile
   ```

4. Launch the Extension in Debug Mode:
   - Open this workspace in VS Code.
   - Press `F5` (or select **Run MQTT Code Extension** from the Run & Debug view).
   - An Extension Development Host window will launch.

## Testing

Run unit tests:
```bash
npm run test:unit
```

