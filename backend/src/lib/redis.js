var { createClient } = require("redis");

var client;
var connecting;

function getRedisClient() {
  if (client) return client;

  var url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL not set");
  }

  client = createClient({ url: url });

  client.on("error", function (err) {
    // 这里不抛异常，避免 Redis 短暂不可用导致进程直接退出
    console.error("[redis] error", err);
  });

  // 避免并发 connect
  connecting = client.connect();
  return client;
}

async function ensureRedisConnected() {
  if (!client) getRedisClient();
  if (connecting) await connecting;
}

module.exports = {
  getRedisClient,
  ensureRedisConnected,
};
