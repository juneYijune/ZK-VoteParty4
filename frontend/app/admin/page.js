"use client";

import { Space } from "antd";
import { AdminLayout } from "@/components";
import { AdminDashboard, CheckPartyOrgAdmin } from "@/modules/admin";

export default function AdminPage() {
  return (
    <AdminLayout>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <CheckPartyOrgAdmin />
        <AdminDashboard />
      </Space>
    </AdminLayout>
  );
}
