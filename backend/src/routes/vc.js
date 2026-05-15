var express = require("express");
var router = express.Router();

var vcController = require("../controllers/vc.controller");

// 颁发 VC
router.post("/issue", vcController.issue);

// 查询 VC 列表
router.get("/list", vcController.list);

// 获取 VC 详情
router.get("/detail/:vc_id", vcController.detail);

// 更新 VC
router.put("/update/:vc_id", vcController.update);

// 撤销 VC
router.post("/revoke/:vc_id", vcController.revoke);

// 验证 VC 签名
router.get("/verify/:vc_id", vcController.verifySignature);

// 获取用户的有效VC列表
router.get("/my-valid-vcs", vcController.getMyValidVCs);

module.exports = router;
