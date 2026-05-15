var express = require("express");
var router = express.Router();

var zkController = require("../controllers/zk.controller");

// 生成零知识证明
router.post("/generate-proof", zkController.generateProof);

// 验证零知识证明
router.post("/verify-proof", zkController.verifyProof);

module.exports = router;
