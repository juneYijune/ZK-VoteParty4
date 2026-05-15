var express = require("express");
var router = express.Router();

var walletController = require("../../controllers/auth/wallet.controller");

router.post("/nonce", walletController.postNonce);
router.post("/login", walletController.postLogin);

module.exports = router;
