import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

  async function connect() {
    if (openConnectModal) {
      openConnectModal();
    }
    return address || "";
  }

  return { 
    account: address || "", 
    isConnected,
    connect,
    disconnect
  };
}
