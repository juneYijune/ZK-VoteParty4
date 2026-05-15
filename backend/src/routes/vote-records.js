var express = require("express");
var router = express.Router();

var voteRecordsController = require("../controllers/voteRecords.controller");

router.post("/record", voteRecordsController.record);
router.get("/my-list", voteRecordsController.myList);
router.get("/voted", voteRecordsController.votedStatus);
router.get("/detail/:record_id", voteRecordsController.getDetail);

module.exports = router;
