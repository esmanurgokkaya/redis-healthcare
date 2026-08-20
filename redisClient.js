const { createClient } = require('redis');

const redisClient = createClient({
  url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Hatası:', err));

async function connectRedis() {
  await redisClient.connect();
  console.log('Redis bağlandı');
}

module.exports = { redisClient, connectRedis };