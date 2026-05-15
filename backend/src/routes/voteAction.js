var express = require("express");
var router = express.Router();

var voteActionController = require("../controllers/voteAction.controller");

router.get("/list", voteActionController.list);
router.get("/detail/:vote_id", voteActionController.detail);
router.post("/add", voteActionController.add);
router.post("/update-status", voteActionController.updateStatus);
router.post("/calculate-hash", voteActionController.calculateHash);

module.exports = router;
