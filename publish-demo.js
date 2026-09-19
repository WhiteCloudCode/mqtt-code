const mqtt = require('mqtt');

const brokerUrl = 'mqtt://broker.hivemq.com';
const client = mqtt.connect(brokerUrl);

// Using a consistent prefix so you can pre-subscribe in the tool
const prefix = 'mqtt-code-demo/test';

console.log(`\n=== MQTT Code Demo Publisher (FAST & NOISY) ===`);
console.log(`Broker: ${brokerUrl}`);
console.log(`Topic:  ${prefix}/#`);
console.log(`\nHint: Connect the MQTT Code tool and subscribe to '${prefix}/#' before starting the recording.\n`);

client.on('connect', () => {
    console.log('Connected to HiveMQ! Unleashing the noise for 9 seconds...\n');
    
    // 1. Initial burst to build out the tree instantly
    const initialBurst = [
        { topic: 'system/status', payload: 'ONLINE', retain: true },
        { topic: 'factory/line-1/status', payload: 'RUNNING', retain: true },
        { topic: 'factory/line-2/status', payload: 'IDLE', retain: true },
        { topic: 'sensors/living-room/lights', payload: JSON.stringify({ state: 'ON', brightness: 85, colour: '#FFA500' }), retain: true },
        { topic: 'sensors/kitchen/fridge/status', payload: 'CLOSED', retain: true }
    ];

    initialBurst.forEach(msg => {
        client.publish(`${prefix}/${msg.topic}`, msg.payload, { retain: msg.retain || false });
        console.log(`🚀 [0.0s] Burst -> ${msg.topic}`);
    });

    // 2. Continuous noisy data streams
    let timers = [];

    // Fast vibration metrics (every 200ms)
    timers.push(setInterval(() => {
        const val = (Math.random() * 2 + 1).toFixed(3);
        client.publish(`${prefix}/factory/line-1/metrics/vibration`, val);
        console.log(`⚡️ Publish -> factory/line-1/metrics/vibration: ${val}`);
    }, 200));

    // Fast power metrics (every 300ms)
    timers.push(setInterval(() => {
        const power = Math.floor(Math.random() * 500 + 4000);
        client.publish(`${prefix}/factory/line-1/metrics/power_w`, power.toString());
        console.log(`⚡️ Publish -> factory/line-1/metrics/power_w: ${power}`);
    }, 300));

    // Temperature changes (every 500ms)
    timers.push(setInterval(() => {
        const temp = (Math.random() * 5 + 20).toFixed(1);
        client.publish(`${prefix}/sensors/living-room/temperature`, JSON.stringify({ value: parseFloat(temp), unit: 'C' }));
        console.log(`🌡️ Publish -> sensors/living-room/temperature`);
    }, 500));

    // Occasional bursts of random alerts (every 1.2 seconds)
    timers.push(setInterval(() => {
        client.publish(`${prefix}/system/alerts/warnings`, JSON.stringify({ level: 'WARN', msg: 'Spike detected', code: Math.floor(Math.random() * 9999) }));
        console.log(`⚠️ Publish -> system/alerts/warnings`);
    }, 1200));

    // 3. Stop everything gracefully after 9.5 seconds to fit in a 10s recording
    setTimeout(() => {
        timers.forEach(t => clearInterval(t));
        
        client.publish(`${prefix}/system/status`, 'OFFLINE', { retain: true }, () => {
            console.log('\nAll done making noise. Closing connection.');
            client.end();
        });
    }, 9500);
});

client.on('error', (err) => {
    console.error('Connection error:', err);
    client.end();
});

