"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import { AuthProvider } from "@/contexts/AuthContext";
import { RouteGuard } from "@/components/RouteGuard";
import { RainbowKitProvider } from "./RainbowKitProvider";

export function AppProviders({ children }) {
  return (
    <RainbowKitProvider>
      <ConfigProvider>
        <App>
          <AuthProvider>
            <RouteGuard>{children}</RouteGuard>
          </AuthProvider>
        </App>
      </ConfigProvider>
    </RainbowKitProvider>
  );
}
