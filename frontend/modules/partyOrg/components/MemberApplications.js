"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Modal,
  Pagination,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { connectWallet } from "@/services/wallet";
import { getPartyOrgByAddress } from "@/services/partyOrgs";
import { listApplications, approveApplication } from "@/services/partyUsers";

const { Title, Text } = Typography;

export function MemberApplications() {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [processing, setProcessing] = useState(false);

  // 获取党组织ID
  async function fetchOrgId() {
    try {
      var address = await connectWallet();
      if (!address) throw new Error("未获取到钱包地址");

      var orgData = await getPartyOrgByAddress(address);
      if (!orgData) {
        message.error("您不是党组织管理员");
        return;
      }

      setOrgId(orgData.org_id);
      return orgData.org_id;
    } catch (e) {
      console.error("获取党组织信息失败:", e);
      message.error(e.message || "获取党组织信息失败");
      return null;
    }
  }

  // 获取申请列表
  async function fetchApplications(currentOrgId = orgId) {
    if (!currentOrgId) return;

    try {
      setLoading(true);
      var data = await listApplications({
        org_id: currentOrgId,
        page: page,
        pageSize: pageSize,
      });

      setApplications(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error("获取申请列表失败:", e);
      message.error(e.message || "获取申请列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgId().then((id) => {
      if (id) fetchApplications(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // 审批申请
  async function handleApprove(partyuserId, approve) {
    try {
      var actionText = approve ? "同意" : "拒绝";
      
      Modal.confirm({
        title: `确认${actionText}申请？`,
        content: `您确定要${actionText}该党员的入党申请吗？`,
        okText: "确认",
        cancelText: "取消",
        onOk: async () => {
          setProcessing(true);
          try {
            var payload = {
              partyuser_id: partyuserId,
              user_status: approve ? 1 : 0,
            };
            console.log("审批申请参数:", payload);
            
            await approveApplication(payload);
            message.success(`${actionText}成功`);
            fetchApplications();
          } catch (e) {
            console.error(`${actionText}失败:`, e);
            message.error(e.message || `${actionText}失败`);
          } finally {
            setProcessing(false);
          }
        },
      });
    } catch (e) {
      console.error("操作失败:", e);
    }
  }

  const columns = [
    {
      title: "申请人",
      dataIndex: "user_name",
      key: "user_name",
      width: 120,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "钱包地址",
      dataIndex: "wallet_address",
      key: "wallet_address",
      width: 180,
      render: (text) => <Text code style={{ fontSize: "12px" }}>{text}</Text>,
    },
    {
      title: "申请时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (text) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "状态",
      dataIndex: "user_status",
      key: "user_status",
      width: 100,
      render: (status) => (
        <Tag color="warning">待审批</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record.partyuser_id, true)}
            loading={processing}
          >
            同意
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleApprove(record.partyuser_id, false)}
            loading={processing}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* 页面标题 */}
        <Card
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <Space align="center" size={16}>
            <UserAddOutlined style={{ fontSize: "48px", color: "#fff" }} />
            <div>
              <Title level={2} style={{ margin: 0, color: "#fff" }}>
                入党申请审批
              </Title>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                审批党员入党申请
              </Text>
            </div>
          </Space>
        </Card>

        {/* 申请列表 */}
        <Card
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => fetchApplications()}>
              刷新
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={applications}
            rowKey="partyuser_id"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
          />

          {total > 0 && (
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条`}
                onChange={(p, ps) => {
                  setPage(p);
                  if (ps !== pageSize) setPageSize(ps);
                }}
              />
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
}
