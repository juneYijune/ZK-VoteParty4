// 同步历史区块链事件到 system_logs 表
const { ethers } = require('ethers');
const systemLogsService = require('./src/services/systemLogs.service');
require('dotenv').config();

// 合约 ABI
const contractABI = [
  "event PartyOrgAdded(address indexed partyOrg, address indexed operator, uint256 timestamp)",
  "event PartyOrgRemoved(address indexed partyOrg, address indexed operator, uint256 timestamp)",
  "event VoteCreated(uint256 voteId, string title, uint256 startTime, uint256 endTime, address operator, uint256 timestamp, bytes32 eligibilityRuleHash)",
  "event Voted(uint256 voteId, address operator, uint256 timestamp)",
  "event startVoted(uint256 voteId, address operator, uint256 timestamp)",
  "event endVoted(uint256 voteId, address operator, uint256 timestamp)",
];

async function syncHistoricalEvents() {
  console.log('=== 开始同步历史事件 ===\n');

  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error('❌ CONTRACT_ADDRESS 未配置');
    process.exit(1);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // 获取当前区块高度
    const currentBlock = await provider.getBlockNumber();
    console.log(`当前区块高度: ${currentBlock}`);

    // 获取合约部署区块（从区块 0 开始查询，实际应用中可以优化）
    const fromBlock = 0;
    const toBlock = currentBlock;

    console.log(`查询区块范围: ${fromBlock} - ${toBlock}\n`);

    let totalEvents = 0;

    // 1. 同步 PartyOrgAdded 事件
    console.log('1. 同步 PartyOrgAdded 事件...');
    const partyOrgAddedFilter = contract.filters.PartyOrgAdded();
    const partyOrgAddedEvents = await contract.queryFilter(partyOrgAddedFilter, fromBlock, toBlock);
    console.log(`   找到 ${partyOrgAddedEvents.length} 个事件`);

    for (const event of partyOrgAddedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'PARTY_ORG_ADD',
            operator_address: event.args.operator,
            target_address: event.args.partyOrg,
            vote_id: null,
            action_desc: '添加党组织管理员',
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: ${event.args.partyOrg}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    // 2. 同步 PartyOrgRemoved 事件
    console.log('\n2. 同步 PartyOrgRemoved 事件...');
    const partyOrgRemovedFilter = contract.filters.PartyOrgRemoved();
    const partyOrgRemovedEvents = await contract.queryFilter(partyOrgRemovedFilter, fromBlock, toBlock);
    console.log(`   找到 ${partyOrgRemovedEvents.length} 个事件`);

    for (const event of partyOrgRemovedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'PARTY_ORG_REMOVE',
            operator_address: event.args.operator,
            target_address: event.args.partyOrg,
            vote_id: null,
            action_desc: '撤销党组织管理员',
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: ${event.args.partyOrg}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    // 3. 同步 VoteCreated 事件
    console.log('\n3. 同步 VoteCreated 事件...');
    const voteCreatedFilter = contract.filters.VoteCreated();
    const voteCreatedEvents = await contract.queryFilter(voteCreatedFilter, fromBlock, toBlock);
    console.log(`   找到 ${voteCreatedEvents.length} 个事件`);

    for (const event of voteCreatedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'VOTE_CREATE',
            operator_address: event.args.operator,
            target_address: null,
            vote_id: Number(event.args.voteId),
            action_desc: `创建投票: ${event.args.title}`,
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: 投票 ID ${event.args.voteId}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    // 4. 同步 Voted 事件
    console.log('\n4. 同步 Voted 事件...');
    const votedFilter = contract.filters.Voted();
    const votedEvents = await contract.queryFilter(votedFilter, fromBlock, toBlock);
    console.log(`   找到 ${votedEvents.length} 个事件`);

    for (const event of votedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'VOTE_CAST',
            operator_address: event.args.operator,
            target_address: null,
            vote_id: Number(event.args.voteId),
            action_desc: `投票 ID: ${event.args.voteId}`,
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: 投票 ID ${event.args.voteId}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    // 5. 同步 startVoted 事件
    console.log('\n5. 同步 startVoted 事件...');
    const startVotedFilter = contract.filters.startVoted();
    const startVotedEvents = await contract.queryFilter(startVotedFilter, fromBlock, toBlock);
    console.log(`   找到 ${startVotedEvents.length} 个事件`);

    for (const event of startVotedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'START_VOTE',
            operator_address: event.args.operator,
            target_address: null,
            vote_id: Number(event.args.voteId),
            action_desc: `开始投票 ID: ${event.args.voteId}`,
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: 投票 ID ${event.args.voteId}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    // 6. 同步 endVoted 事件
    console.log('\n6. 同步 endVoted 事件...');
    const endVotedFilter = contract.filters.endVoted();
    const endVotedEvents = await contract.queryFilter(endVotedFilter, fromBlock, toBlock);
    console.log(`   找到 ${endVotedEvents.length} 个事件`);

    for (const event of endVotedEvents) {
      try {
        const block = await event.getBlock();
        const existing = await systemLogsService.getLogByTxHash(event.transactionHash);
        
        if (!existing) {
          await systemLogsService.createSystemLog({
            log_type: 'END_VOTE',
            operator_address: event.args.operator,
            target_address: null,
            vote_id: Number(event.args.voteId),
            action_desc: `结束投票 ID: ${event.args.voteId}`,
            logs_status: 1,
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            block_timestamp: block.timestamp,
          });
          console.log(`   ✅ 记录事件: 投票 ID ${event.args.voteId}`);
          totalEvents++;
        }
      } catch (e) {
        console.error(`   ❌ 处理事件失败:`, e.message);
      }
    }

    console.log(`\n=== 同步完成 ===`);
    console.log(`总共同步了 ${totalEvents} 个事件到 system_logs 表`);

  } catch (e) {
    console.error('❌ 同步失败:', e);
    process.exit(1);
  }

  process.exit(0);
}

syncHistoricalEvents();
