"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  message,
  Pagination,
  Button,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  InputNumber,
  Input,
  Switch,
  Descriptions,
  Select,
} from "antd";
import {
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  SafetyOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ethers } from "ethers";

import { connectWallet } from "@/services/wallet";
import { getPartyOrgByAddress } from "@/services/partyOrgs";
import { listMembers, removeMember } from "@/services/partyUsers";
import { issueVC } from "@/services/vc";
import { MemberVCList } from "./MemberVCList";

const { Title, Text } = Typography;

// 用户角色标签
function userRoleTag(role) {
  if (role === 1) return <Tag color="blue">党员</Tag>;
  if (role === 2) return <Tag color="green">党组织管理员</Tag>;
  if (role === 9) return <Tag color="red">系统管理员</Tag>;
  return <Tag>未知</Tag>;
}

// 用户状态标签
function userStatusTag(status) {
  if (status === 1) return <Tag color="success">正常</Tag>;
  if (status === 0) return <Tag color="error">冻结</Tag>;
  if (status === 2) return <Tag color="warning">申请中</Tag>;
  return <Tag>未知</Tag>;
}

export function OrgMembers() {
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [orgInfo, setOrgInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [walletAddress, setWalletAddress] = useState("");

  // VC 颁发相关状态
  const [openIssueVC, setOpenIssueVC] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [issuingVC, setIssuingVC] = useState(false);
  const [form] = Form.useForm();

  // 视图切换状态
  const [viewMode, setViewMode] = useState("list"); // "list" 或 "vcList"
  const [selectedMemberForVC, setSelectedMemberForVC] = useState(null);

  // 获取党组织ID
  async function fetchOrgId() {
    try {
      var address = await connectWallet();
      if (!address) throw new Error("未获取到钱包地址");

      setWalletAddress(address);

      var orgData = await getPartyOrgByAddress(address);
      if (!orgData) {
        message.error("您不是党组织管理员");
        return;
      }

      setOrgId(orgData.org_id);
      setOrgInfo(orgData);
      return orgData.org_id;
    } catch (e) {
      console.error("获取党组织信息失败:", e);
      message.error(e.message || "获取党组织信息失败");
      return null;
    }
  }

  // 获取成员列表
  async function fetchMembers(currentOrgId = orgId) {
    if (!currentOrgId) return;

    try {
      setLoading(true);
      var data = await listMembers({
        org_id: currentOrgId,
        page: page,
        pageSize: pageSize,
      });

      setMembers(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error("获取成员列表失败:", e);
      message.error(e.message || "获取成员列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgId().then((id) => {
      if (id) fetchMembers(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // 打开颁发 VC 模态框
  function handleOpenIssueVC(member) {
    setSelectedMember(member);
    form.setFieldsValue({
      vcType: "PARTY_MEMBER",
      isFormalPartyMember: true,
      partyYears: 0,
      partyOrgCode: orgInfo?.org_code || "",
      partyStatus: 1,
      paidPartyFee: true,
      conflictFree: true,
    });
    setOpenIssueVC(true);
  }

  // 提交颁发 VC
  async function handleIssueVCSubmit() {
    try {
      const values = await form.validateFields();

      if (!selectedMember) {
        message.error("未选择成员");
        return;
      }

      if (!orgId || !orgInfo) {
        message.error("未获取到党组织信息");
        return;
      }

      setIssuingVC(true);

      // 重新连接钱包以确保地址可用
      const address = await connectWallet();
      if (!address) {
        throw new Error("未连接钱包");
      }
      setWalletAddress(address);

      // 验证当前连接的钱包地址是否是党组织管理员地址
      if (address.toLowerCase() !== orgInfo.orger_address.toLowerCase()) {
        throw new Error(`请使用党组织管理员地址 ${orgInfo.orger_address} 连接钱包`);
      }

      // 检查 MetaMask
      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      // 构建 VC 内容 - 使用固定的属性顺序以确保签名一致性
      const vcContent = {
        isFormalPartyMember: !!values.isFormalPartyMember,
        partyYears: parseInt(String(values.partyYears ?? 0), 10),
        partyOrgCode: String(values.partyOrgCode || "").trim(),
        partyStatus: values.partyStatus !== undefined && values.partyStatus !== null 
          ? parseInt(String(values.partyStatus), 10) 
          : 1,
        paidPartyFee: !!values.paidPartyFee,
        conflictFree: !!values.conflictFree,
      };
      
      // 确保属性顺序一致 - 按字母顺序排序
      const sortedVcContent = {
        conflictFree: vcContent.conflictFree,
        isFormalPartyMember: vcContent.isFormalPartyMember,
        partyOrgCode: vcContent.partyOrgCode,
        partyStatus: vcContent.partyStatus,
        partyYears: vcContent.partyYears,
        paidPartyFee: vcContent.paidPartyFee,
      };

      // 使用钱包签名 VC 内容
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // 获取 VC 类型
      const vcType = String(values.vcType || "PARTY_MEMBER").trim();
      
      // 构建完整的签名数据（包含 vc_content、vc_issuer_address、vc_status 和 vc_holder_wallet_hash）
      // 颁发时 VC 状态固定为有效（1）
      // 使用党组织管理员地址作为签发者地址
      const vcStatus = 1;
      const issuerAddress = orgInfo.orger_address;
      
      const signatureData = {
        vc_content: sortedVcContent,
        vc_issuer_address: issuerAddress,
        vc_holder_wallet_hash: selectedMember.wallet_address_hash,
        vc_status: vcStatus,
      };
      
      // 将签名数据转换为字符串进行签名
      const signatureDataString = JSON.stringify(signatureData);
      const signature = await signer.signMessage(signatureDataString);

      // 调用后端 API 颁发 VC
      const result = await issueVC({
        vc_issuer_org_id: orgId,
        vc_issuer_address: issuerAddress,
        vc_holder_user_id: selectedMember.partyuser_id,
        vc_holder_wallet_hash: selectedMember.wallet_address_hash,
        vc_type: vcType,
        vc_content: sortedVcContent,
        vc_signature_type: "ECDSA",
        vc_signature_value: signature,
        vc_status: vcStatus, // 颁发时固定为有效（1）
      });

      Modal.success({
        title: "身份凭证颁发成功",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="VC ID">{result.vc_id}</Descriptions.Item>
              <Descriptions.Item label="VC Hash">
                <Text code style={{ fontSize: "12px" }}>{result.vc_hash}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="持有人">{selectedMember.user_name}</Descriptions.Item>
            </Descriptions>
          </Space>
        ),
      });

      setOpenIssueVC(false);
      form.resetFields();
      setSelectedMember(null);
    } catch (e) {
      console.error("颁发 凭证 失败:", e);
      message.error(e.message || "颁发 凭证 失败");
    } finally {
      setIssuingVC(false);
    }
  }

  // 打开查看 VC 模态框
  async function handleViewVC(member) {
    setSelectedMemberForVC(member);
    setViewMode("vcList");
  }

  // 返回成员列表
  function handleBackToList() {
    setViewMode("list");
    setSelectedMemberForVC(null);
  }

  // 迁出党组织
  async function handleRemoveMember(member) {
    Modal.confirm({
      title: "确认迁出党组织",
      content: `确定要将 ${member.user_name} 迁出党组织吗？此操作不可恢复。`,
      okText: "确认迁出",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await removeMember({
            partyuser_id: member.partyuser_id,
            org_id: orgId,
          });
          message.success("成员已迁出党组织");
          fetchMembers();
        } catch (e) {
          console.error("迁出成员失败:", e);
          message.error(e.message || "迁出成员失败");
        }
      },
    });
  }

  // 如果在 VC 列表视图，显示 VC 列表组件
  if (viewMode === "vcList" && selectedMemberForVC) {
    return (
      <MemberVCList
        member={selectedMemberForVC}
        orgInfo={orgInfo}
        onBack={handleBackToList}
      />
    );
  }

  const columns = [
    {
      title: "姓名",
      dataIndex: "user_name",
      key: "user_name",
      width: 120,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "钱包地址哈希",
      dataIndex: "wallet_address_hash",
      key: "wallet_address_hash",
      width: 200,
      ellipsis: true,
      render: (text) => (
        <Text code style={{ fontSize: "12px" }} ellipsis>
          {text}
        </Text>
      ),
    },
    {
      title: "角色",
      dataIndex: "user_role",
      key: "user_role",
      width: 150,
      render: (role) => userRoleTag(role),
    },
    {
      title: "在籍",
      dataIndex: "user_status",
      key: "user_status",
      width: 100,
      render: (status) => userStatusTag(status),
    },
    {
      title: "加入时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (text) => dayjs(text).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "操作",
      key: "action",
      width: 280,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<SafetyCertificateOutlined />}
            onClick={() => handleOpenIssueVC(record)}
          >
            颁发 身份凭证
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewVC(record)}
          >
            查看 凭证
          </Button>
          <Button
            type="default"
            size="small"
            danger
            icon={<UserDeleteOutlined />}
            onClick={() => handleRemoveMember(record)}
          >
            迁出
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
          <Row gutter={24} align="middle">
            <Col flex="auto">
              <Space align="center" size={16}>
                <TeamOutlined style={{ fontSize: "48px", color: "#fff" }} />
                <div>
                  <Title level={2} style={{ margin: 0, color: "#fff" }}>
                    组织成员
                  </Title>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                    {orgInfo ? orgInfo.org_name : "查看党组织成员信息"}
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Statistic
                title={<span style={{ color: "rgba(255,255,255,0.85)" }}>成员总数</span>}
                value={total}
                suffix="人"
                valueStyle={{ color: "#fff" }}
                prefix={<UserOutlined />}
              />
            </Col>
          </Row>
        </Card>

        {/* 党组织信息卡片 */}
        {orgInfo && (
          <Card
            bordered={false}
            style={{
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: "#fafafa" }}>
                  <Statistic
                    title="党组织名称"
                    value={orgInfo.org_name}
                    valueStyle={{ fontSize: "16px" }}
                    prefix={<TeamOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: "#fafafa" }}>
                  <Statistic
                    title="党组织编码"
                    value={orgInfo.org_code}
                    valueStyle={{ fontSize: "16px" }}
                    prefix={<SafetyOutlined />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: "#fafafa" }}>
                  <Statistic
                    title="负责人"
                    value={orgInfo.leader_name || "-"}
                    valueStyle={{ fontSize: "16px" }}
                    prefix={<UserOutlined />}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        {/* 成员列表 */}
        <Card
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => fetchMembers()}>
              刷新
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={members}
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

        {/* 颁发 VC 模态框 */}
        <Modal
          title={`为 ${selectedMember?.user_name || "成员"} 颁发可验证凭证`}
          open={openIssueVC}
          onCancel={() => {
            if (issuingVC) return;
            setOpenIssueVC(false);
            form.resetFields();
            setSelectedMember(null);
          }}
          onOk={handleIssueVCSubmit}
          confirmLoading={issuingVC}
          okText="颁发 凭证"
          cancelText="取消"
          width={600}
        >
          {selectedMember && (
            <Space direction="vertical" size={16} style={{ width: "100%", marginBottom: "16px" }}>
              <Card size="small" style={{ background: "#fafafa" }}>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="成员姓名">{selectedMember.user_name}</Descriptions.Item>
                  <Descriptions.Item label="钱包地址哈希">
                    <Text code style={{ fontSize: "12px" }}>{selectedMember.wallet_address_hash}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="角色">{userRoleTag(selectedMember.user_role)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Space>
          )}

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              vcType: "PARTY_MEMBER",
              isFormalPartyMember: true,
              partyYears: 0,
              partyOrgCode: orgInfo?.org_code || "",
              partyStatus: 1,
              paidPartyFee: true,
              conflictFree: true,
            }}
          >
            <Form.Item
              label="VC 类型"
              name="vcType"
              rules={[{ required: true, message: "请输入 凭证 类型" }]}
              tooltip="可验证凭证的类型标识，例如：PARTY_MEMBER（党员）、PARTY_LEADER（党组织负责人）等"
            >
              <Input placeholder="例如：PARTY_MEMBER" />
            </Form.Item>

            <Form.Item
              label="是否正式党员"
              name="isFormalPartyMember"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>

            <Form.Item
              label="党龄（年）"
              name="partyYears"
              rules={[{ required: true, message: "请输入党龄" }]}
            >
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              label="党组织编码"
              name="partyOrgCode"
              rules={[{ required: true, message: "请输入党组织编码" }]}
            >
              <Input placeholder="例如：ORG001" />
            </Form.Item>

            <Form.Item
              label="党员状态"
              name="partyStatus"
              rules={[{ required: true, message: "请选择党员状态" }]}
            >
              <Select
                placeholder="请选择党员状态"
                options={[
                  { value: 0, label: "冻结" },
                  { value: 1, label: "正常" },
                  { value: 2, label: "受处分" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="是否已缴纳党费"
              name="paidPartyFee"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>

            <Form.Item
              label="是否无利益冲突"
              name="conflictFree"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  );
}
