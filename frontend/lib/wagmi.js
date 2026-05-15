import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { hardhat, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// 定义 Geth 本地私链
const gethLocal = defineChain({
  id: 1337,
  name: 'Geth Local',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8558'] },
    public: { http: ['http://127.0.0.1:8558'] },
  },
  blockExplorers: {
    default: { name: 'Local', url: 'http://127.0.0.1:8558' },
  },
  testnet: true,
});

// 从环境变量获取配置
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// 配置支持的链
// 注意: hardhat (Chain ID 31337), gethLocal (Chain ID 1337), sepolia (Chain ID 11155111)
export const config = getDefaultConfig({
  appName: 'ZK Party Voting',
  projectId: projectId,
  chains: [
    hardhat,      // Chain ID: 31337, Port: 8545
    gethLocal,    // Chain ID: 1337, Port: 8558
    sepolia,      // Chain ID: 11155111, Sepolia 测试网
  ],
  ssr: true, // 启用服务端渲染支持
});
