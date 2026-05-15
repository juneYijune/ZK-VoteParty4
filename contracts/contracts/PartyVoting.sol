// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// 定义智能合约
contract PartyVoting {
    // 角色定义：系统管理员、党员、党组织
    address public admin; // 系统管理员地址
    address[] public partyOrgs; // 存储所有党组织地址
    mapping(address => bool) public isPartyOrg; // 判断是否为党组织

    // 初始化系统管理员地址，党组织可以通过系统管理员创建
    constructor() {
        admin = msg.sender; // 部署合约的账户为系统管理员
    }

    // 定义投票类型
    enum VoteType {
        ELECTION, // 差额选举
        RESOLUTION, // 决议表决
        EVALUATION // 评议评价
    }

    // 定义投票状态
    enum VoteStatus {
        PENDING, // 待投票
        IN_PROGRESS, // 投票中
        ENDED // 投票结束
    }

    // 定义投票活动结构
    struct Vote {
        uint256 id; // 投票ID
        string title; // 投票标题
        VoteType voteType; // 投票类型
        VoteStatus status; // 投票状态
        uint256 startTime; // 投票开始时间
        uint256 endTime; // 投票结束时间
        uint256 maxChoices; // 最多选择数
        address partyOrg; // 记录哪个党组织发起的投票
        mapping(address => bool) hasVoted; // 记录党员是否已经投票
        mapping(uint256 => uint256) voteCounts; // 记录每个选项的票数
        uint256 totalVotes; // 投票总数
        string[] options; // 投票选项
         bytes32 eligibilityRuleHash;
    }

    // 定义所有投票的映射
    mapping(uint256 => Vote) public votes;
    uint256 public voteCount;

    // 定义事件，方便前端监听投票创建、投票操作等
    event VoteCreated(
        uint256 voteId,
        string title,
        uint256 startTime,
        uint256 endTime,
        address operator,
        uint256 timestamp,
        bytes32 eligibilityRuleHash
    );
    event Voted(uint256 voteId, address operator, uint256 timestamp);

    event PartyOrgAdded(address indexed partyOrg,address indexed operator,uint256 timestamp);
    event PartyOrgRemoved(address indexed partyOrg,address indexed operator, uint256 timestamp);
    event startVoted (uint256 voteId, address operator,uint256 timestamp);
     event endVoted (uint256 voteId, address operator,uint256 timestamp);
    // 党组织创建投票
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the admin can perform this action");
        _;
    }

    // 系统管理员添加党组织
    function addPartyOrg(address _partyOrg) public onlyAdmin {
        require(
            !isPartyOrg[_partyOrg],
            "This address is already a party organization."
        );
        isPartyOrg[_partyOrg] = true;
        partyOrgs.push(_partyOrg);
        emit PartyOrgAdded(_partyOrg,msg.sender,block.timestamp);
    }
    // 系统管理员撤销党组织管理员权限
    function removePartyOrg(address _partyOrg) external onlyAdmin {
        require(isPartyOrg[_partyOrg], "Address is not a party organization");

        isPartyOrg[_partyOrg] = false;

        // 从 partyOrgs 数组中移除
        for (uint256 i = 0; i < partyOrgs.length; i++) {
            if (partyOrgs[i] == _partyOrg) {
                partyOrgs[i] = partyOrgs[partyOrgs.length - 1];
                partyOrgs.pop();
                break;
            }
        }
        emit PartyOrgRemoved(_partyOrg,msg.sender,block.timestamp);
    }

    // 党组织发起投票
    modifier onlyPartyOrg() {
        require(
            isPartyOrg[msg.sender],
            "Only registered party organizations can create votes"
        );
        _;
    }

    // 党组织创建投票
    function createVote(
        string memory _title,
        VoteType _voteType,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _maxChoices,
        string[] memory _options,
        bytes32 _eligibilityRuleHash
    ) public onlyPartyOrg {
        require(
            _startTime < _endTime,
            "Start time must be earlier than end time"
        );

        voteCount++;
        Vote storage newVote = votes[voteCount];
        newVote.id = voteCount;
        newVote.title = _title;
        newVote.voteType = _voteType;
        newVote.status = VoteStatus.PENDING;
        newVote.startTime = _startTime;
        newVote.endTime = _endTime;
        newVote.maxChoices = _maxChoices;
        newVote.options = _options;
        newVote.partyOrg = msg.sender; // 记录创建投票的党组织地址
        newVote.eligibilityRuleHash = _eligibilityRuleHash;
        emit VoteCreated(voteCount, _title, _startTime, _endTime, msg.sender,block.timestamp,_eligibilityRuleHash);
    }

    // 党员投票
    function castVote(uint256 _voteId, uint256[] memory _optionIndexes) public {
        Vote storage vote = votes[_voteId];

        // 检查投票是否有效
        require(
            block.timestamp >= vote.startTime,
            "Voting has not started yet"
        );
        require(block.timestamp <= vote.endTime, "Voting has ended");
        require(
            vote.status == VoteStatus.IN_PROGRESS,
            "Voting is not in progress"
        );
        require(!vote.hasVoted[msg.sender], "You have already voted");

        // 检查选择的选项是否有效
        require(
            _optionIndexes.length <= vote.maxChoices,
            "You cannot select more options than allowed"
        );

        for (uint256 i = 0; i < _optionIndexes.length; i++) {
            require(
                _optionIndexes[i] < vote.options.length,
                "Invalid option index"
            );
            vote.voteCounts[_optionIndexes[i]]++;
        }

        // 记录投票
        vote.totalVotes += _optionIndexes.length;
        vote.hasVoted[msg.sender] = true;

        emit Voted(_voteId, msg.sender, block.timestamp);
    }

    // 党组织开始投票
    function startVote(uint256 _voteId) public onlyPartyOrg {
        Vote storage vote = votes[_voteId];
        require(
            vote.partyOrg == msg.sender,
            "Only the party organization that created this vote can start it"
        );
        require(
            vote.status == VoteStatus.PENDING,
            "Vote is already in progress or ended"
        );
        vote.status = VoteStatus.IN_PROGRESS;
         emit startVoted(_voteId, msg.sender, block.timestamp);
    }

    // 党组织结束投票
    function endVote(uint256 _voteId) public onlyPartyOrg {
        Vote storage vote = votes[_voteId];
        require(
            vote.partyOrg == msg.sender,
            "Only the party organization that created this vote can end it"
        );
        require(
            vote.status == VoteStatus.IN_PROGRESS,
            "Vote is not in progress"
        );
        vote.status = VoteStatus.ENDED;
          emit endVoted(_voteId, msg.sender, block.timestamp);
    }

    // 查询投票结果
    function getVoteResult(
        uint256 _voteId
    )
        public
        view
        returns (
            string memory title,
            VoteType voteType,
            string[] memory options,
            uint256[] memory voteCounts,
            uint256 totalVotes,
            address partyOrg
        )
    {
        Vote storage vote = votes[_voteId];
        uint256[] memory counts = new uint256[](vote.options.length);

        for (uint256 i = 0; i < vote.options.length; i++) {
            counts[i] = vote.voteCounts[i];
        }

        return (
            vote.title,
            vote.voteType,
            vote.options,
            counts,
            vote.totalVotes,
            vote.partyOrg
        );
    }

    // 查询管理员地址
    function getAdmin() public view returns (address) {
        return admin;
    }

    // 查询某个地址是否是党组织管理员
    function getisPartyOrgAdmin(address _org) public view returns (bool) {
        return isPartyOrg[_org];
    }

    // 获取所有党组织管理员地址
    function getAllPartyOrgs() public view returns (address[] memory) {
        return partyOrgs;
    }
    // 获取所有投票的 ID 列表
    function getAllVoteIds() public view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](voteCount);
        for (uint256 i = 0; i < voteCount; i++) {
            ids[i] = i + 1;
        }
        return ids;
    }

    // 查询单个投票的基本信息（不包含投票人信息）
    function getVoteInfo(
        uint256 _voteId
    )
        public
        view
        returns (
            uint256 id,
            string memory title,
            VoteType voteType,
            VoteStatus status,
            uint256 startTime,
            uint256 endTime,
            uint256 maxChoices,
            address partyOrg,
            string[] memory options,
             bytes32 eligibilityRuleHash
        )
    {
        Vote storage vote = votes[_voteId];

        return (
            vote.id,
            vote.title,
            vote.voteType,
            vote.status,
            vote.startTime,
            vote.endTime,
            vote.maxChoices,
            vote.partyOrg,
            vote.options,
            vote.eligibilityRuleHash
        );
    }
    // 根据党组织地址查询其创建的投票 ID 列表
    function getVotesByPartyOrg(
        address _partyOrg
    ) public view returns (uint256[] memory) {
        uint256 count = 0;

        // 先统计数量
        for (uint256 i = 1; i <= voteCount; i++) {
            if (votes[i].partyOrg == _partyOrg) {
                count++;
            }
        }

        // 再创建数组
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= voteCount; i++) {
            if (votes[i].partyOrg == _partyOrg) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }
    function getCanVote(uint256 _voteId) external view returns (bool) {
        Vote storage vote = votes[_voteId];
        return (vote.status == VoteStatus.IN_PROGRESS &&
            block.timestamp >= vote.startTime &&
            block.timestamp <= vote.endTime);
    }

    // 获取当前区块时间戳（用于检查投票时间）
    function getCurrentBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }
}
