# RainbowKit 多钱包支持集成指南

## 概述

系统已集成 RainbowKit，支持多种以太坊钱包连接，包括：

- ✅ **MetaMask** - 最流行的浏览器钱包
- ✅ **Coinbase Wallet** - Coinbase 官方钱包
- ✅ **Rainbow Wallet** - 现代化的以太坊钱包
- ✅ **WalletConnect** - 支持移动端钱包扫码连接
- ✅ **Trust Wallet** - 移动端多链钱包
- ✅ **其他 EVM 兼容钱包**

## 已完成的修改

### 1. 安装的依赖

```bash
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### 2. 新增文件

- `frontend/lib/wagmi.js` - Wagmi 配置
- `frontend/providers/RainbowKitProvider.js` - RainbowKit Provider
- `frontend/RAINBOWKIT_INTEGRATION.md` - 本文档

### 3. 修改的文件

- `frontend/providers/AppProviders.js` - 添加 RainbowKit Provider
- `frontend/hooks/useWallet.js` - 使用 Wagmi hooks
- `frontend/.env.local` - 添加 WalletConnect Project ID 配置

## 使用方法

### 连接钱包

系统会自动显示 RainbowKit 的钱包选择界面，用户可以选择任何支持的钱包进行连接。

### 在组件中使用

```javascript
import { useWallet } from "@/hooks/useWallet";

function MyComponent() {
  const { account, isConnected, connect, disconnect } = useWallet();

  return (
    <div>
      {isConnected ? (
        <>
          <p>已连接: {account}</p>
          <button onClick={disconnect}>断开连接</button>
        </>
      ) : (
        <button onClick={connect}>连接钱包</button>
      )}
    </div>
  );
}
```

### 使用 RainbowKit 的连接按钮

RainbowKit 提供了一个美观的连接按钮组件：

```javascript
import { ConnectButton } from '@rainbow-me/rainbowkit';

function Header() {
  return (
    <header>
      <ConnectButton />
    </header>
  );
}
```

## 配置 WalletConnect (可选)

如果需要支持移动端钱包扫码连接，需要配置 WalletConnect Project ID：

1. 访问 https://cloud.walletconnect.com/
2. 创建一个新项目
3. 复制 Project ID
4. 在 `.env.local` 中设置：

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## 自定义配置

### 添加更多链

编辑 `frontend/lib/wagmi.js`：

```javascript
import { mainnet, sepolia, hardhat, localhost } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'ZK Party Voting',
  projectId: projectId,
  chains: [
    localhost,      // 本地开发
    hardhat,        // Hardhat 网络
    sepolia,        // 测试网
    // mainnet,     // 主网（生产环境）
  ],
  ssr: true,
});
```

### 自定义钱包列表

```javascript
import { getDefaultConfig, connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

const connectors = connectorsForWallets(
  [
    {
      groupName: '推荐',
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet],
    },
    {
      groupName: '其他',
      wallets: [walletConnectWallet],
    },
  ],
  {
    appName: 'ZK Party Voting',
    projectId,
  }
);
```

## 兼容性说明

### 与现有代码的兼容性

- ✅ `useWallet` hook 保持相同的 API
- ✅ 所有使用 `window.ethereum` 的代码仍然可以工作
- ✅ ethers.js 代码无需修改

### 签名和交易

RainbowKit 使用 Wagmi，它与 ethers.js 完全兼容：

```javascript
import { useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';

function MyComponent() {
  const { data: walletClient } = useWalletClient();

  async function signMessage() {
    if (!walletClient) return;
    
    // 转换为 ethers.js provider
    const provider = new BrowserProvider(walletClient);
    const signer = await provider.getSigner();
    
    // 使用 ethers.js API
    const signature = await signer.signMessage("Hello");
    return signature;
  }
}
```

## 故障排除

### 问题：钱包连接后页面没有更新

**解决方案**：确保组件使用了 `useWallet` hook 或 Wagmi 的 hooks。

### 问题：WalletConnect 无法连接

**解决方案**：
1. 检查是否配置了 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
2. 确保 Project ID 有效
3. 检查网络连接

### 问题：某些钱包不显示

**解决方案**：某些钱包需要特定的浏览器扩展或移动应用。确保用户已安装相应的钱包。

## 测试

### 本地测试

1. 启动前端：`npm run dev`
2. 点击连接钱包按钮
3. 选择一个钱包（如 MetaMask）
4. 确认连接
5. 验证地址显示正确

### 测试不同钱包

- **MetaMask**: 浏览器扩展
- **Coinbase Wallet**: 浏览器扩展或移动应用
- **Rainbow**: 移动应用 + WalletConnect
- **Trust Wallet**: 移动应用 + WalletConnect

## 参考资料

- [RainbowKit 文档](https://www.rainbowkit.com/docs/introduction)
- [Wagmi 文档](https://wagmi.sh/)
- [WalletConnect 文档](https://docs.walletconnect.com/)
