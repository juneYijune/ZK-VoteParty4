var express = require("express");
var router = express.Router();

var partyUsersController = require("../controllers/partyUsers.controller");

// 获取当前用户的党组织信息
router.get("/my-party-org", partyUsersController.getMyPartyOrg);

// 计算钱包地址的 Poseidon Hash
router.post("/hash-wallet-address", partyUsersController.hashWalletAddress);

// 申请加入党组织
router.post("/apply", partyUsersController.applyToJoin);

// 获取申请列表（党组织管理员）
router.get("/applications", partyUsersController.listApplications);

// 获取成员列表（党组织管理员）
router.get("/members", partyUsersController.listMembers);

// 审批申请
router.post("/approve", partyUsersController.approveApplication);

// 迁出党组织（删除成员）
router.post("/remove-member", partyUsersController.removeMember);

module.exports = router;
