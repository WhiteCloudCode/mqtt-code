const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const mqtt = require('mqtt');

server.listen(1883, () => {
  const client = mqtt.connect('mqtt://localhost:1883');
  
  client.on('connect', () => {
    client.subscribe('test/retain', (err) => {
      client.publish('test/retain', 'hello', { retain: true }, () => {
      });
    });
  });

  let messageCount = 0;
  client.on('message', (topic, message, packet) => {
    console.log('Client1 (already subscribed) received packet retain flag:', packet.retain);
    messageCount++;
    if (messageCount === 1) {
      const client2 = mqtt.connect('mqtt://localhost:1883');
      client2.on('connect', () => {
        client2.subscribe('test/retain');
      });
      client2.on('message', (topic, message, packet) => {
        console.log('Client2 (new subscriber) received packet retain flag:', packet.retain);
        client.end();
        client2.end();
        server.close();
      });
    }
  });
});
