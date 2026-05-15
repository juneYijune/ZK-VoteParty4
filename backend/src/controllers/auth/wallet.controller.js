var { ethers } = require("ethers");
var walletAuthService = require("../../services/auth/walletAuth.service");

async function postNonce(req, res) {
  try {
    var address = req.body && req.body.address;

    if (!address || typeof address !== "string" || !ethers.isAddress(address)) {
      return res.status(400).json({ message: "invalid address" });
    }

    var nonce = await walletAuthService.createNonce(address);
    return res.json({ nonce: nonce });
  } catch (e) {
    console.error("[auth] postNonce error", e);
    return res.status(500).json({ message: "server error" });
  }
}

async function postLogin(req, res) {
  try {
    var address = req.body && req.body.address;
    var signature = req.body && req.body.signature;

    if (!address || typeof address !== "string" || !ethers.isAddress(address)) {
      return res.status(400).json({ message: "invalid address" });
    }

    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ message: "invalid signature" });
    }

    var result = await walletAuthService.verifyLogin(address, signature);
    return res.json({ ok: true, address: result.address });
  } catch (e) {
    console.error("[auth] postLogin error", e);
    var status = e.status || 500;
    return res.status(status).json({ message: e.message || "server error" });
  }
}

module.exports = {
  postNonce,
  postLogin,
};
