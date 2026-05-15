var express = require("express");
var router = express.Router();

var walletRouter = require("./wallet");

router.use("/wallet", walletRouter);

module.exports = router;
