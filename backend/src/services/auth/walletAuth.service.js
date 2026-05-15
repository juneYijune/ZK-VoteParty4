var crypto = require("crypto");
var { ethers } = require("ethers");
var { ensureRedisConnected, getRedisClient } = require("../../lib/redis");

var NONCE_PREFIX = "wallet_nonce:";
var NONCE_TTL_SECONDS = parseInt(process.env.WALLET_NONCE_TTL_SECONDS || "300", 10);

function buildNonceKey(address) {
  return NONCE_PREFIX + address.toLowerCase();
}

function generateRandomNonceHex32() {
  // 32 字节随机数，用于防重放攻击
  return "0x" + crypto.randomBytes(32).toString("hex");
}

async function createNonce(address) {
  // 中文说明：生成 nonce 并存入 Redis，设置 TTL
  await ensureRedisConnected();
  var redis = getRedisClient();

  var nonce = generateRandomNonceHex32();
  var key = buildNonceKey(address);

  await redis.set(key, nonce, { EX: NONCE_TTL_SECONDS });
  return nonce;
}

async function verifyLogin(address, signature) {
  // 中文说明：从 Redis 取出 nonce，校验签名，成功后删除 nonce
  await ensureRedisConnected();
  var redis = getRedisClient();

  var key = buildNonceKey(address);
  var nonce = await redis.get(key);

  if (!nonce) {
    var err = new Error("nonce not found or expired");
    err.status = 400;
    throw err;
  }

  var recovered;
  try {
    // 中文说明：MetaMask 的 personal_sign 如果传入的是 0x...，会按「十六进制 bytes」进行签名
    // ethers.verifyMessage 如果传入 string，会按 UTF-8 字符串处理。
    // 这里对 0x nonce 转为 bytes，避免签名校验地址不一致。
    var message = nonce;
    if (typeof nonce === "string" && nonce.startsWith("0x")) {
      message = ethers.getBytes(nonce);
    }
    recovered = ethers.verifyMessage(message, signature);
  } catch (e) {
    var err2 = new Error("invalid signature");
    err2.status = 400;
    throw err2;
  }

  var expected = ethers.getAddress(address);
  var actual = ethers.getAddress(recovered);

  if (expected !== actual) {
    var err3 = new Error("signature address mismatch");
    err3.status = 401;
    throw err3;
  }

  // 防重放：验证通过后立刻删除 nonce
  await redis.del(key);

  return { address: expected };
}

module.exports = {
  createNonce,
  verifyLogin,
};
