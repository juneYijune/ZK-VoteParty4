var { ethers } = require("ethers");
var systemLogsService = require("./systemLogs.service");

// 合约 ABI（只需要事件相关的部分）
var contractABI = [
  "event PartyOrgAdded(address indexed partyOrg, address indexed operator, uint256 timestamp)",
  "event PartyOrgRemoved(address indexed partyOrg, address indexed operator, uint256 timestamp)",
  "event VoteCreated(uint256 voteId, string title, uint256 startTime, uint256 endTime, address operator, uint256 timestamp, bytes32 eligibilityRuleHash)",
  "event Voted(uint256 voteId, address operator, uint256 timestamp)",
  "event startVoted(uint256 voteId, address operator, uint256 timestamp)",
  "event endVoted(uint256 voteId, address operator, uint256 timestamp)",
];

var provider = null;
var contract = null;
var isListening = false;
var isPaused = false; // 添加暂停状态
var pauseTimeout = null; // 暂停定时器

// 内存缓存：防止短时间内重复处理同一事件
var processedEvents = new Map(); // key: txHash, value: timestamp
var CACHE_DURATION = 60000; // 缓存 60 秒

// 定期清理过期缓存
setInterval(() => {
  var now = Date.now();
  for (var [txHash, timestamp] of processedEvents.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      processedEvents.delete(txHash);
    }
  }
}, 30000); // 每 30 秒清理一次

// 暂停事件监听
function pauseEventListener(duration = 300000) { // 默认5分钟
  if (isPaused) return;
  
  isPaused = true;
  console.log(`⏸️ 暂停事件监听 ${duration / 60000} 分钟...`);
  
  // 停止当前的轮询
  if (provider) {
    provider.polling = false;
  }
  
  // 移除所有事件监听器
  if (contract) {
    contract.removeAllListeners();
  }
  
  // 清除之前的暂停定时器
  if (pauseTimeout) {
    clearTimeout(pauseTimeout);
  }
  
  // 设置恢复定时器
  pauseTimeout = setTimeout(() => {
    resumeEventListener();
  }, duration);
}

// 恢复事件监听
function resumeEventListener() {
  if (!isPaused) return;
  
  isPaused = false;
  console.log("▶️ 恢复事件监听");
  
  // 清除暂停定时器
  if (pauseTimeout) {
    clearTimeout(pauseTimeout);
    pauseTimeout = null;
  }
  
  // 重新启动轮询
  if (provider) {
    provider.polling = true;
  }
  
  // 重新添加事件监听器
  if (contract) {
    setupEventListeners();
  }
}

// 初始化事件监听器
async function initEventListener(rpcUrl, contractAddress) {
  try {
    if (!rpcUrl || !contractAddress) {
      throw new Error("缺少 RPC URL 或合约地址");
    }

    // 如果已经在监听，先停止
    if (isListening) {
      stopEventListener();
    }

    console.log("🔄 初始化事件监听器...");
    console.log("  RPC URL:", rpcUrl);
    console.log("  合约地址:", contractAddress);

    // 创建 provider 和 contract
    provider = new ethers.JsonRpcProvider(rpcUrl);
    contract = new ethers.Contract(contractAddress, contractABI, provider);

    // 设置轮询间隔为5分钟（300秒）
    provider.pollingInterval = 300000; // 5分钟

    // 添加 provider 错误处理
    provider.on("error", (error) => {
      console.error("Provider 错误:", error.message);
      
      // 检查是否是速率限制错误
      if (error.message.includes("Too Many Requests") || 
          error.message.includes("rate limit") ||
          error.code === -32005) {
        console.log("  检测到速率限制，暂停事件监听 5 分钟...");
        pauseEventListener(300000); // 暂停5分钟
      } else {
        console.log("  RPC 轮询错误（已处理）:", error.message);
      }
    });

    // 设置事件监听器
    setupEventListeners();

    console.log("✅ 事件监听器初始化完成");
    return true;
  } catch (error) {
    console.error("❌ 初始化事件监听器失败:", error.message);
    throw error;
  }
}

// 设置事件监听器（提取为独立函数）
function setupEventListeners() {
  try {
    // 如果处于暂停状态，不设置监听器
    if (isPaused) {
      console.log("⏸️ 事件监听器处于暂停状态，跳过设置");
      return;
    }

    // 清除之前的监听器
    if (contract) {
      contract.removeAllListeners();
    }

    contract.on("PartyOrgAdded", async (partyOrg, operator, timestamp, event) => {
      var txHash = event.log.transactionHash;
      
      // 立即检查并设置缓存，防止并发处理
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 PartyOrgAdded 事件)");
        return;
      }
      
      // 立即标记为正在处理，这是关键！
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 PartyOrgAdded 事件:", partyOrg);
        
        // 检查数据库是否已存在（去重）
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "PARTY_ORG_ADD",
          operator_address: operator,
          target_address: partyOrg,
          vote_id: null,
          action_desc: "添加党组织管理员",
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 PartyOrgAdded 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 PartyOrgAdded 事件失败:", e.message);
        // 处理失败时移除缓存，允许重试
        processedEvents.delete(txHash);
      }
    });

    // 监听 PartyOrgRemoved 事件
    contract.on("PartyOrgRemoved", async (partyOrg, operator, timestamp, event) => {
      var txHash = event.log.transactionHash;
      
      // 立即检查并设置缓存，防止并发处理
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 PartyOrgRemoved 事件)");
        return;
      }
      
      // 立即标记为正在处理，这是关键！
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 PartyOrgRemoved 事件:", partyOrg);
        
        // 检查数据库是否已存在（去重）
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "PARTY_ORG_REMOVE",
          operator_address: operator,
          target_address: partyOrg,
          vote_id: null,
          action_desc: "撤销党组织管理员",
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 PartyOrgRemoved 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 PartyOrgRemoved 事件失败:", e.message);
        // 处理失败时移除缓存，允许重试
        processedEvents.delete(txHash);
      }
    });

    // 监听 VoteCreated 事件
    contract.on("VoteCreated", async (voteId, title, startTime, endTime, operator, timestamp, eligibilityRuleHash, event) => {
      var txHash = event.log.transactionHash;
      
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 VoteCreated 事件)");
        return;
      }
      
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 VoteCreated 事件, 投票ID:", voteId.toString());
        
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "VOTE_CREATE",
          operator_address: operator,
          target_address: null,
          vote_id: Number(voteId),
          action_desc: `创建投票: ${title}`,
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 VoteCreated 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 VoteCreated 事件失败:", e.message);
        processedEvents.delete(txHash);
      }
    });

    // 监听 Voted 事件
    contract.on("Voted", async (voteId, operator, timestamp, event) => {
      var txHash = event.log.transactionHash;
      
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 Voted 事件)");
        return;
      }
      
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 Voted 事件, 投票ID:", voteId.toString());
        
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "VOTE_CAST",
          operator_address: operator,
          target_address: null,
          vote_id: Number(voteId),
          action_desc: `投票 ID: ${voteId}`,
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 Voted 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 Voted 事件失败:", e.message);
        processedEvents.delete(txHash);
      }
    });

    // 监听 startVoted 事件
    contract.on("startVoted", async (voteId, operator, timestamp, event) => {
      var txHash = event.log.transactionHash;
      
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 startVoted 事件)");
        return;
      }
      
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 startVoted 事件, 投票ID:", voteId.toString());
        
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "START_VOTE",
          operator_address: operator,
          target_address: null,
          vote_id: Number(voteId),
          action_desc: `开始投票 ID: ${voteId}`,
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 startVoted 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 startVoted 事件失败:", e.message);
        processedEvents.delete(txHash);
      }
    });

    // 监听 endVoted 事件
    contract.on("endVoted", async (voteId, operator, timestamp, event) => {
      var txHash = event.log.transactionHash;
      
      if (processedEvents.has(txHash)) {
        console.log("  (内存缓存命中，跳过重复 endVoted 事件)");
        return;
      }
      
      processedEvents.set(txHash, Date.now());
      
      try {
        console.log("✓ 捕获到 endVoted 事件, 投票ID:", voteId.toString());
        
        var existing = await systemLogsService.getLogByTxHash(txHash);
        if (existing) {
          console.log("  (数据库已存在，跳过)");
          return;
        }
        
        var block = await event.getBlock();
        await systemLogsService.createSystemLog({
          log_type: "END_VOTE",
          operator_address: operator,
          target_address: null,
          vote_id: Number(voteId),
          action_desc: `结束投票 ID: ${voteId}`,
          logs_status: 1,
          tx_hash: txHash,
          block_number: event.log.blockNumber,
          block_timestamp: block.timestamp,
        });
        console.log("✓ 已记录 endVoted 事件到数据库");
      } catch (e) {
        console.error("✗ 处理 endVoted 事件失败:", e.message);
        processedEvents.delete(txHash);
      }
    });

    isListening = true;
    console.log("✅ 事件监听器已启动，开始监听区块链事件");
  } catch (e) {
    console.error("❌ 初始化事件监听器失败:", e.message);
  }
}

// 停止事件监听
function stopEventListener() {
  isPaused = false; // 重置暂停状态
  
  if (pauseTimeout) {
    clearTimeout(pauseTimeout);
    pauseTimeout = null;
  }
  
  if (contract) {
    contract.removeAllListeners();
    console.log("事件监听器已停止");
  }
  if (provider) {
    provider.removeAllListeners();
    provider.polling = false; // 停止轮询
    provider.destroy();
  }
  isListening = false;
}

// 同步历史事件
async function syncHistoricalEvents(rpcUrl, contractAddress) {
  if (!rpcUrl || !contractAddress) {
    throw new Error("缺少 RPC URL 或合约地址");
  }

  var tempProvider = new ethers.JsonRpcProvider(rpcUrl);
  var tempContract = new ethers.Contract(contractAddress, contractABI, tempProvider);

  // 获取当前区块高度
  var currentBlock = await tempProvider.getBlockNumber();
  var fromBlock = currentBlock - 3;
  var toBlock = currentBlock;

  console.log(`  查询区块范围: ${fromBlock} - ${toBlock}`);

  var totalEvents = 0;

  // 同步所有事件类型
  var eventConfigs = [
    {
      name: "PartyOrgAdded",
      logType: "PARTY_ORG_ADD",
      desc: "添加党组织管理员",
      handler: (event) => ({
        log_type: "PARTY_ORG_ADD",
        operator_address: event.args.operator,
        target_address: event.args.partyOrg,
        vote_id: null,
        action_desc: "添加党组织管理员",
      }),
    },
    {
      name: "PartyOrgRemoved",
      logType: "PARTY_ORG_REMOVE",
      desc: "撤销党组织管理员",
      handler: (event) => ({
        log_type: "PARTY_ORG_REMOVE",
        operator_address: event.args.operator,
        target_address: event.args.partyOrg,
        vote_id: null,
        action_desc: "撤销党组织管理员",
      }),
    },
    {
      name: "VoteCreated",
      logType: "VOTE_CREATE",
      desc: "创建投票",
      handler: (event) => ({
        log_type: "VOTE_CREATE",
        operator_address: event.args.operator,
        target_address: null,
        vote_id: Number(event.args.voteId),
        action_desc: `创建投票: ${event.args.title}`,
        // eligibilityRuleHash 参数已包含在事件中，但不需要存储到 system_logs 表
      }),
    },
    {
      name: "Voted",
      logType: "VOTE_CAST",
      desc: "投票",
      handler: (event) => ({
        log_type: "VOTE_CAST",
        operator_address: event.args.operator,
        target_address: null,
        vote_id: Number(event.args.voteId),
        action_desc: `投票 ID: ${event.args.voteId}`,
      }),
    },
    {
      name: "startVoted",
      logType: "START_VOTE",
      desc: "开始投票",
      handler: (event) => ({
        log_type: "START_VOTE",
        operator_address: event.args.operator,
        target_address: null,
        vote_id: Number(event.args.voteId),
        action_desc: `开始投票 ID: ${event.args.voteId}`,
      }),
    },
    {
      name: "endVoted",
      logType: "END_VOTE",
      desc: "结束投票",
      handler: (event) => ({
        log_type: "END_VOTE",
        operator_address: event.args.operator,
        target_address: null,
        vote_id: Number(event.args.voteId),
        action_desc: `结束投票 ID: ${event.args.voteId}`,
      }),
    },
  ];

  for (var config of eventConfigs) {
    try {
      var filter = tempContract.filters[config.name]();
      var events = await tempContract.queryFilter(filter, fromBlock, toBlock);

      if (events.length > 0) {
        console.log(`  同步 ${config.name}: ${events.length} 个事件`);
      }

      for (var event of events) {
        try {
          // 检查是否已存在
          var existing = await systemLogsService.getLogByTxHash(event.transactionHash);
          if (existing) {
            continue;
          }

          var block = await event.getBlock();
          var logData = config.handler(event);

          await systemLogsService.createSystemLog({
            ...logData,
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });

          totalEvents++;
        } catch (e) {
          console.error(`  处理 ${config.name} 事件失败:`, e.message);
        }
      }
    } catch (e) {
      console.error(`  查询 ${config.name} 事件失败:`, e.message);
    }
  }

  if (totalEvents > 0) {
    console.log(`  成功同步 ${totalEvents} 个历史事件`);
  }

  return totalEvents;
}

module.exports = {
  initEventListener,
  stopEventListener,
  syncHistoricalEvents,
  pauseEventListener,
  resumeEventListener,
};
