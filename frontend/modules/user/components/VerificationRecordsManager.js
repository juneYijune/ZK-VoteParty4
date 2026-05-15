"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  message,
  Empty,
  Popconfirm,
} from "antd";
import {
  DeleteOutlined,
  ClearOutlined,
  SafetyOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import {
  getAllVerifications,
  clearVerification,
  clearAllVerifications,
} from "@/utils/zkVerificationStorage";

const { Title, Text } = Typography;

/**
 * 验证记录管理组件
 * 用于显示和管理用户的ZK验证记录
 */
export function VerificationRecordsManager({ walletAddress }) {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载验证记录
  function loadVerifications() {
    if (!walletAddress) {
      setVerifications([]);
      return;
    }

    try {
      setLoading(true);
      const allVerifications = getAllVerifications(walletAddress);
      
      // 转换为数组格式
      const records = Object.values(allVerifications || {}).map((record) => ({
        key: record.vote_id,
        ...record,
      }));
      
      // 按验证时间倒序排序
      records.sort((a, b) => {
        const timeA = new Date(a.verified_at).getTime();
        const timeB = new Date(b.verified_at).getTime();
        return timeB - timeA;
      });
      
      setVerifications(records);
    } catch (error) {
      console.error("加载验证记录失败:", error);
      message.error("加载验证记录失败");
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }

  // 组件挂载时加载
  useEffect(() => {
    loadVerifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // 清除单个验证记录
  function handleClearSingle(voteId) {
    try {
      const success = clearVerification(walletAddress, voteId);
      if (success) {
        message.success("验证记录已清除");
        loadVerifications();
      } else {
        message.error("清除失败，请重试");
      }
    } catch (error) {
      console.error("清除验证记录失败:", error);
      message.error("清除失败");
    }
  }

  // 清除所有验证记录
  function handleClearAll() {
    Modal.confirm({
      title: "确认清除所有验证记录？",
      content: "此操作将清除您所有的投票资格验证记录，下次查看投票时需要重新验证。",
      okText: "确认清除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        try {
          const success = clearAllVerifications(walletAddress);
          if (success) {
            message.success("所有验证记录已清除");
            loadVerifications();
          } else {
            message.error("清除失败，请重试");
          }
        } catch (error) {
          console.error("清除所有验证记录失败:", error);
          message.error("清除失败");
        }
      },
    });
  }

  // 表格列定义
  const columns = [
    {
      title: "投票ID",
      dataIndex: "vote_id",
      key: "vote_id",
      width: 100,
    },
    {
      title: "验证状态",
      dataIndex: "is_verified",
      key: "is_verified",
      width: 120,
      render: (isVerified) => {
        if (isVerified) {
          return (
            <Tag icon={<SafetyOutlined />} color="success">
              已验证通过
            </Tag>
          );
        } else {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              不符合资格
            </Tag>
          );
        }
      },
    },
    {
      title: "使用的VC ID",
      dataIndex: "vc_id",
      key: "vc_id",
      width: 120,
    },
    {
      title: "验证时间",
      dataIndex: "verified_at",
      key: "verified_at",
      width: 180,
      render: (time) => {
        if (!time) return "-";
        return (
          <Space size={4}>
            <CalendarOutlined />
            <Text>{dayjs(time).format("YYYY-MM-DD HH:mm:ss")}</Text>
          </Space>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确认清除此验证记录？"
          description="清除后，下次查看该投票时需要重新验证。"
          onConfirm={() => handleClearSingle(record.vote_id)}
          okText="确认"
          cancelText="取消"
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            size="small"
          >
            清除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (!walletAddress) {
    return (
      <Card>
        <Empty description="请先连接钱包" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <SafetyOutlined />
          <span>验证记录管理</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ClearOutlined />}
            onClick={loadVerifications}
            loading={loading}
          >
            刷新
          </Button>
          {verifications.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleClearAll}
            >
              清除所有记录
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Text type="secondary">
          这里显示您的所有投票资格验证记录。验证记录存储在浏览器本地，清除后下次查看投票时需要重新验证。
        </Text>

        <Table
          columns={columns}
          dataSource={verifications}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无验证记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Space>
    </Card>
  );
}
