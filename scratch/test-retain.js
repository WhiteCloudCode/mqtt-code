const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log('connected');
  
  // Subscribe first
  client.subscribe('test/mqtt-code/retain-test', (err) => {
    if (err) throw err;
    
    // Publish with retain
    client.publish('test/mqtt-code/retain-test', 'hello', { retain: true }, (err) => {
      if (err) throw err;
      console.log('published');
    });
  });
});

client.on('message', (topic, message, packet) => {
  console.log('Received packet retain flag:', packet.retain);
  client.end();
});
