var express = require("express");
var router = express.Router();

var partyOrgsController = require("../controllers/partyOrgs.controller");

router.get("/list", partyOrgsController.list);
router.get("/by-address/:address", partyOrgsController.detailByAddress);
router.get("/:org_id", partyOrgsController.detail);
router.post("/add", partyOrgsController.create);
router.post("/update", partyOrgsController.update);
router.post("/update-admin", partyOrgsController.updateAdmin);
router.post("/revoke-admin", partyOrgsController.revokeAdmin);

module.exports = router;
