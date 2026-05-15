// 检查事件监听器状态
const { ethers } = require('ethers');
require('dotenv').config();

async function checkEventListenerStatus() {
  console.log('=== 检查事件监听器状态 ===\n');

  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const contractAddress = process.env.CONTRACT_ADDRESS;

  console.log('配置信息:');
  console.log(`  RPC_URL: ${rpcUrl}`);
  console.log(`  CONTRACT_ADDRESS: ${contractAddress}\n`);

  if (!contractAddress) {
    console.log('❌ CONTRACT_ADDRESS 未配置，事件监听器无法启动');
    process.exit(1);
  }

  try {
    // 连接到区块链
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // 检查连接
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ 区块链连接成功`);
    console.log(`   当前区块高度: ${blockNumber}\n`);

    // 检查合约
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      console.log(`❌ 合约地址 ${contractAddress} 上没有部署合约`);
      process.exit(1);
    }
    console.log(`✅ 合约已部署\n`);

    // 查询最近的事件
    console.log('查询最近 10 个区块的事件...');
    const fromBlock = Math.max(0, blockNumber - 10);
    
    const contractABI = [
      "event PartyOrgAdded(address indexed partyOrg, address indexed operator, uint256 timestamp)",
      "event PartyOrgRemoved(address indexed partyOrg, address indexed operator, uint256 timestamp)",
      "event VoteCreated(uint256 voteId, string title, uint256 startTime, uint256 endTime, address operator, uint256 timestamp)",
      "event Voted(uint256 voteId, address operator, uint256 timestamp)",
      "event startVoted(uint256 voteId, address operator, uint256 timestamp)",
      "event endVoted(uint256 voteId, address operator, uint256 timestamp)",
    ];

    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    let totalEvents = 0;
    const eventTypes = [
      'PartyOrgAdded',
      'PartyOrgRemoved', 
      'VoteCreated',
      'Voted',
      'startVoted',
      'endVoted'
    ];

    for (const eventType of eventTypes) {
      const filter = contract.filters[eventType]();
      const events = await contract.queryFilter(filter, fromBlock, blockNumber);
      if (events.length > 0) {
        console.log(`  ${eventType}: ${events.length} 个事件`);
        totalEvents += events.length;
      }
    }

    if (totalEvents === 0) {
      console.log('  未找到任何事件\n');
      console.log('💡 提示:');
      console.log('   - 如果你刚启动后端，事件监听器只会记录新事件');
      console.log('   - 启动前的操作不会被自动记录');
      console.log('   - 需要同步历史事件，请运行: node sync-historical-events.js');
    } else {
      console.log(`\n✅ 找到 ${totalEvents} 个事件`);
      console.log('\n💡 如果这些事件没有出现在 system_logs 表中:');
      console.log('   1. 检查后端控制台是否有错误信息');
      console.log('   2. 确认事件监听器已启动（查看启动日志）');
      console.log('   3. 运行同步脚本: node sync-historical-events.js');
    }

  } catch (e) {
    console.error('❌ 检查失败:', e.message);
    process.exit(1);
  }

  process.exit(0);
}

checkEventListenerStatus();
