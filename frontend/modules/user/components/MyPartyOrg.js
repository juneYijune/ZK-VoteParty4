"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Descriptions,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Alert,
} from "antd";
import {
  TeamOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";

import { connectWallet } from "@/services/wallet";
import { getMyPartyOrg, applyToJoinPartyOrg } from "@/services/partyUsers";
import { listPartyOrgs } from "@/services/partyOrgs";

const { Title, Text } = Typography;

// 用户状态标签
function userStatusTag(status) {
  if (status === 1) return <Tag icon={<CheckCircleOutlined />} color="success">已加入</Tag>;
  if (status === 2) return <Tag icon={<ClockCircleOutlined />} color="warning">申请中</Tag>;
  if (status === 0) return <Tag icon={<CloseCircleOutlined />} color="error">已拒绝</Tag>;
  return <Tag>未知</Tag>;
}

export function MyPartyOrg() {
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [partyOrgInfo, setPartyOrgInfo] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);

  // 申请模态框
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applyForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 党组织列表
  const [orgList, setOrgList] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgKeyword, setOrgKeyword] = useState("");

  // 获取用户党组织信息
  async function fetchMyPartyOrg() {
    try {
      setLoading(true);
      var address = await connectWallet();
      if (!address) throw new Error("未获取到钱包地址");

      setWalletAddress(address);

      var data = await getMyPartyOrg(address);
      setHasApplied(data.hasApplied);
      if (data.hasApplied) {
        setPartyOrgInfo(data);
      }
    } catch (e) {
      console.error("获取党组织信息失败:", e);
      message.error(e.message || "获取党组织信息失败");
    } finally {
      setLoading(false);
    }
  }

  // 获取党组织列表
  async function fetchOrgList(keyword = "") {
    try {
      setOrgLoading(true);
      var data = await listPartyOrgs({
        keyword: keyword,
        status: 1, // 只显示启用的党组织
        page: 1,
        pageSize: 50,
      });
      setOrgList(data.items || []);
    } catch (e) {
      console.error("获取党组织列表失败:", e);
      message.error(e.message || "获取党组织列表失败");
    } finally {
      setOrgLoading(false);
    }
  }

  useEffect(() => {
    fetchMyPartyOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开申请模态框
  function handleOpenApplyModal() {
    setApplyModalVisible(true);
    fetchOrgList();
    applyForm.resetFields();
  }

  // 关闭申请模态框
  function handleCloseApplyModal() {
    setApplyModalVisible(false);
    applyForm.resetFields();
  }

  // 搜索党组织
  function handleSearchOrg() {
    fetchOrgList(orgKeyword);
  }

  // 提交申请
  async function handleSubmitApply() {
    try {
      var values = await applyForm.validateFields();
      setSubmitting(true);

      var payload = {
        user_name: values.user_name,
        id_number: values.id_number,
        wallet_address: walletAddress,
        party_org_id: values.party_org_id,
      };

      await applyToJoinPartyOrg(payload);
      message.success("申请提交成功，请等待党组织管理员审批");
      handleCloseApplyModal();
      fetchMyPartyOrg();
    } catch (e) {
      console.error("提交申请失败:", e);
      if (e.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(e.message || "提交申请失败");
    } finally {
      setSubmitting(false);
    }
  }

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
            <TeamOutlined style={{ fontSize: "48px", color: "#fff" }} />
            <div>
              <Title level={2} style={{ margin: 0, color: "#fff" }}>
                我的党组织
              </Title>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                查看或申请加入党组织
              </Text>
            </div>
          </Space>
        </Card>

        {/* 党组织信息卡片 */}
        <Card
          loading={loading}
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchMyPartyOrg}>
                刷新
              </Button>
              {!hasApplied && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenApplyModal}>
                  申请加入党组织
                </Button>
              )}
            </Space>
          }
        >
          {!hasApplied ? (
            <Empty
              description="您还未加入任何党组织"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenApplyModal}>
                申请加入党组织
              </Button>
            </Empty>
          ) : (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {/* 申请状态提示 */}
              {partyOrgInfo.user_status === 2 && (
                <Alert
                  message="申请审核中"
                  description="您的入党申请正在审核中，请耐心等待党组织管理员审批。"
                  type="info"
                  showIcon
                  icon={<ClockCircleOutlined />}
                />
              )}
              {partyOrgInfo.user_status === 0 && (
                <Alert
                  message="申请已被拒绝"
                  description="您的入党申请已被拒绝，如有疑问请联系党组织管理员。"
                  type="error"
                  showIcon
                  icon={<CloseCircleOutlined />}
                />
              )}
              {partyOrgInfo.user_status === 1 && (
                <Alert
                  message="已成功加入党组织"
                  description="您已成功加入党组织，可以参与党组织的各项活动。"
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                />
              )}

              {/* 用户信息 */}
              <Descriptions title="个人信息" column={2} bordered>
                <Descriptions.Item label="姓名">
                  {partyOrgInfo.user_name}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  {userStatusTag(partyOrgInfo.user_status)}
                </Descriptions.Item>
                <Descriptions.Item label="钱包地址" span={2}>
                  <Text code style={{ fontSize: "12px" }}>{walletAddress}</Text>
                </Descriptions.Item>
              </Descriptions>

              {/* 党组织信息 */}
              {partyOrgInfo.party_org_id && (
                <Descriptions title="所属党组织" column={2} bordered>
                  <Descriptions.Item label="党组织名称" span={2}>
                    <Text strong>{partyOrgInfo.org_name || "-"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="党组织编码">
                    {partyOrgInfo.org_code || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="负责人">
                    {partyOrgInfo.leader_name || "-"}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Space>
          )}
        </Card>
      </Space>

      {/* 申请加入党组织模态框 */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>申请加入党组织</span>
          </Space>
        }
        open={applyModalVisible}
        onCancel={handleCloseApplyModal}
        onOk={handleSubmitApply}
        confirmLoading={submitting}
        width={600}
        okText="提交申请"
        cancelText="取消"
      >
        <Form
          form={applyForm}
          layout="vertical"
          style={{ marginTop: "24px" }}
        >
          <Form.Item
            label="姓名"
            name="user_name"
            rules={[
              { required: true, message: "请输入姓名" },
              { max: 50, message: "姓名不能超过50个字符" },
            ]}
          >
            <Input placeholder="请输入您的真实姓名" />
          </Form.Item>

          <Form.Item
            label="身份证号"
            name="id_number"
            rules={[
              { required: true, message: "请输入身份证号" },
              { pattern: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/, message: "请输入有效的身份证号" },
            ]}
            extra="身份证号将使用SHA-256加密存储，不会保存明文"
          >
            <Input placeholder="请输入18位身份证号" maxLength={18} />
          </Form.Item>

          <Form.Item
            label="选择党组织"
            name="party_org_id"
            rules={[{ required: true, message: "请选择要加入的党组织" }]}
          >
            <Select
              placeholder="请选择党组织"
              loading={orgLoading}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = option?.label || "";
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              notFoundContent={orgLoading ? <Spin size="small" /> : <Empty description="暂无党组织" />}
              options={orgList.map((org) => ({
                value: org.org_id,
                label: org.org_name,
                org: org,
              }))}
              optionRender={(option) => (
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Text strong>{option.data.org.org_name}</Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    编码：{option.data.org.org_code} | 负责人：{option.data.org.leader_name || "-"}
                  </Text>
                </Space>
              )}
            />
          </Form.Item>

          <Form.Item label="搜索党组织" style={{ marginBottom: "8px" }}>
            <Space style={{ width: "100%" }}>
              <Input
                placeholder="输入党组织名称搜索"
                value={orgKeyword}
                onChange={(e) => setOrgKeyword(e.target.value)}
                onPressEnter={handleSearchOrg}
                style={{ flex: 1 }}
              />
              <Button icon={<SearchOutlined />} onClick={handleSearchOrg} loading={orgLoading}>
                搜索
              </Button>
            </Space>
          </Form.Item>

          <Alert
            message="提示"
            description="提交申请后，需要等待党组织管理员审批通过才能正式加入。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
}
