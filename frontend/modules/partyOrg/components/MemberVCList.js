"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Space,
  Typography,
  Tag,
  message,
  Button,
  Row,
  Col,
  Descriptions,
  Modal,
  Form,
  InputNumber,
  Input,
  Switch,
  Select,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  ReloadOutlined,
  StopOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ethers } from "ethers";

import { connectWallet } from "@/services/wallet";
import { listVCs, updateVC, revokeVC, verifyVCSignature } from "@/services/vc";

const { Title, Text } = Typography;

// 渲染 VC 状态标签
function renderVCStatusTag(status) {
  if (status === 1) return <Tag color="success">有效</Tag>;
  if (status === 0) return <Tag color="error">已撤销</Tag>;
  return <Tag>未知</Tag>;
}

// 渲染党员状态标签
function renderPartyStatusTag(status) {
  if (status === 0) return <Tag color="error">冻结</Tag>;
  if (status === 1) return <Tag color="success">正常</Tag>;
  if (status === 2) return <Tag color="warning">受处分</Tag>;
  return <Tag>未知</Tag>;
}

// 用户角色标签
function userRoleTag(role) {
  if (role === 1) return <Tag color="blue">党员</Tag>;
  if (role === 2) return <Tag color="green">党组织管理员</Tag>;
  if (role === 9) return <Tag color="red">系统管理员</Tag>;
  return <Tag>未知</Tag>;
}

export function MemberVCList({ member, orgInfo, onBack }) {
  const [vcs, setVCs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openEditVC, setOpenEditVC] = useState(false);
  const [selectedVC, setSelectedVC] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [verifying, setVerifying] = useState({});
  const [form] = Form.useForm();

  // 加载 VC 列表
  async function loadVCs() {
    if (!member) return;

    try {
      setLoading(true);
      
      const data = await listVCs({
        holder_user_id: member.partyuser_id,
        page: 1,
        pageSize: 100,
      });

      setVCs(data.items || []);
    } catch (e) {
      console.error("获取 VC 列表失败:", e);
      message.error(e.message || "获取 VC 列表失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVCs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  // 打开编辑 VC 模态框
  function handleOpenEditVC(vc) {
    setSelectedVC(vc);
    form.setFieldsValue({
      isFormalPartyMember: vc.vc_content.isFormalPartyMember,
      partyYears: vc.vc_content.partyYears,
      partyOrgCode: vc.vc_content.partyOrgCode,
      partyStatus: vc.vc_content.partyStatus,
      paidPartyFee: vc.vc_content.paidPartyFee,
      conflictFree: vc.vc_content.conflictFree,
      vcStatus: vc.vc_status,
    });
    setOpenEditVC(true);
  }

  // 提交更新 VC
  async function handleUpdateVCSubmit() {
    try {
      const values = await form.validateFields();

      if (!selectedVC) {
        message.error("未选择 VC");
        return;
      }

      setUpdating(true);

      // 重新连接钱包以确保地址可用
      const address = await connectWallet();
      if (!address) {
        throw new Error("未连接钱包");
      }

      // 验证当前连接的钱包地址是否是党组织管理员地址
      if (!orgInfo || !orgInfo.orger_address) {
        throw new Error("未获取到党组织管理员地址");
      }
      
      if (address.toLowerCase() !== orgInfo.orger_address.toLowerCase()) {
        throw new Error(`请使用党组织管理员地址 ${orgInfo.orger_address} 连接钱包`);
      }

      // 检查 MetaMask
      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      // 确保数值类型正确处理（包括 0 值）
      const partyStatus = values.partyStatus !== undefined && values.partyStatus !== null 
        ? parseInt(String(values.partyStatus), 10) 
        : 1;
      
      const vcStatus = values.vcStatus !== undefined && values.vcStatus !== null 
        ? parseInt(String(values.vcStatus), 10) 
        : 1;

      // 构建 VC 内容 - 使用固定的属性顺序以确保签名一致性
      const vcContent = {
        isFormalPartyMember: !!values.isFormalPartyMember,
        partyYears: parseInt(String(values.partyYears ?? 0), 10),
        partyOrgCode: String(values.partyOrgCode || "").trim(),
        partyStatus: partyStatus,
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

      // 构建完整的签名数据
      // 使用党组织管理员地址作为签发者地址
      const issuerAddress = orgInfo.orger_address;
      const signatureData = {
        vc_content: sortedVcContent,
        vc_issuer_address: issuerAddress,
        vc_holder_wallet_hash: member.wallet_address_hash,
        vc_status: vcStatus,
      };

      // 将签名数据转换为字符串进行签名
      const signatureDataString = JSON.stringify(signatureData);
      const signature = await signer.signMessage(signatureDataString);

      // 调用后端 API 更新 VC
      const result = await updateVC(selectedVC.vc_id, {
        vc_content: sortedVcContent,
        vc_signature_value: signature,
        vc_status: vcStatus,
      });

      message.success("VC 更新成功");
      setOpenEditVC(false);
      form.resetFields();
      setSelectedVC(null);

      // 重新加载 VC 列表
      await loadVCs();
    } catch (e) {
      console.error("更新 VC 失败:", e);
      message.error(e.message || "更新 VC 失败");
    } finally {
      setUpdating(false);
    }
  }

  // 快捷撤销 VC
  async function handleRevokeVC(vc) {
    Modal.confirm({
      title: "确认撤销 凭证",
      content: `确定要撤销 凭证 ID: ${vc.vc_id} 吗？此操作不可恢复。`,
      okText: "确认撤销",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await revokeVC(vc.vc_id);
          message.success("VC 已撤销");
          await loadVCs();
        } catch (e) {
          console.error("撤销 VC 失败:", e);
          message.error(e.message || "撤销 VC 失败");
        }
      },
    });
  }

  // 验证 VC
  async function handleVerifyVC(vc) {
    try {
      setVerifying(prev => ({ ...prev, [vc.vc_id]: true }));
      
      const result = await verifyVCSignature(vc.vc_id);
      
      const modalContent = (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div style={{ 
            padding: "16px", 
            borderRadius: "8px",
            background: result.isValid ? "#f6ffed" : "#fff2e8",
            border: `1px solid ${result.isValid ? "#b7eb8f" : "#ffbb96"}`
          }}>
            <Space>
              {result.isValid ? (
                <CheckCircleOutlined style={{ fontSize: "24px", color: "#52c41a" }} />
              ) : (
                <SafetyOutlined style={{ fontSize: "24px", color: "#fa8c16" }} />
              )}
              <div>
                <Text strong style={{ fontSize: "16px", color: result.isValid ? "#52c41a" : "#fa8c16" }}>
                  {result.isValid ? "✓ VC 验证通过" : "✗ VC 验证失败"}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  {result.isValid ? "该 VC 是由合法党组织签发的有效凭证" : "该 VC 存在问题，请谨慎使用"}
                </Text>
              </div>
            </Space>
          </div>

          <Card size="small" title="验证详情">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">签名验证:</Text>
                <Tag color={result.isSignatureValid ? "success" : "error"}>
                  {result.isSignatureValid ? "✓ 有效" : "✗ 无效"}
                </Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">合法签发者:</Text>
                <Tag color={result.isLegalIssuer ? "success" : "error"}>
                  {result.isLegalIssuer ? "✓ 是" : "✗ 否"}
                </Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">VC 状态:</Text>
                <Tag color={result.isVCActive ? "success" : "default"}>
                  {result.isVCActive ? "✓ 有效" : "已撤销"}
                </Tag>
              </div>
            </Space>
          </Card>

          {result.details && result.details.issuer_org && (
            <Card size="small" title="签发机构信息">
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">党组织名称:</Text>
                  <Text strong>{result.details.issuer_org.org_name}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text type="secondary">党组织编码:</Text>
                  <Text code>{result.details.issuer_org.org_code}</Text>
                </div>
              </Space>
            </Card>
          )}

          <Card size="small" title="技术信息">
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <div>
                <Text type="secondary" style={{ fontSize: "12px" }}>签发地址:</Text>
                <br />
                <Text code style={{ fontSize: "11px", wordBreak: "break-all" }}>
                  {result.details.vc_issuer_address}
                </Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: "12px" }}>恢复地址:</Text>
                <br />
                <Text code style={{ fontSize: "11px", wordBreak: "break-all" }}>
                  {result.details.recovered_address}
                </Text>
              </div>
            </Space>
          </Card>
        </Space>
      );

      Modal.info({
        title: `VC 验证结果 (ID: ${vc.vc_id})`,
        content: modalContent,
        width: 600,
        okText: "关闭",
      });
    } catch (e) {
      console.error("验证 VC 失败:", e);
      message.error(e.message || "验证 VC 失败");
    } finally {
      setVerifying(prev => ({ ...prev, [vc.vc_id]: false }));
    }
  }

  if (!member) {
    return null;
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
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space size={12}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                size="large"
                style={{ 
                  color: "#fff", 
                  borderColor: "#fff",
                  background: "rgba(255,255,255,0.2)"
                }}
              >
                返回成员列表
              </Button>
            </Space>
            <div>
              <Title level={2} style={{ margin: 0, color: "#fff" }}>
                {member.user_name} 的可验证凭证
              </Title>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                查看和管理该成员的所有 凭证
              </Text>
            </div>
          </Space>
        </Card>

        {/* 成员信息卡片 */}
        <Card
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          title="成员信息"
        >
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="成员姓名">{member.user_name}</Descriptions.Item>
            <Descriptions.Item label="角色">{userRoleTag(member.user_role)}</Descriptions.Item>
            <Descriptions.Item label="钱包地址哈希" span={2}>
              <Text code style={{ fontSize: "12px" }}>
                {member.wallet_address_hash}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* VC 列表 */}
        <Card
          bordered={false}
          style={{
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          title={`VC 列表 (${vcs.length})`}
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadVCs} loading={loading}>
              刷新
            </Button>
          }
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">加载中...</Text>
              </div>
            </div>
          ) : vcs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Text type="secondary" style={{ fontSize: "16px" }}>该成员暂无可验证凭证</Text>
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {vcs.map((vc) => (
                <Col key={vc.vc_id} xs={24} sm={24} md={12} lg={12} xl={8}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: "12px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      border: "1px solid #f0f0f0",
                      height: "100%",
                      transition: "all 0.3s ease",
                      background: vc.vc_status === 1 
                        ? "linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)" 
                        : "#fafafa",
                    }}
                  >
                    {/* 卡片头部 */}
                    <div style={{ 
                      marginBottom: 16, 
                      paddingBottom: 12, 
                      borderBottom: "2px solid #f0f0f0" 
                    }}>
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Space>
                            <SafetyCertificateOutlined 
                              style={{ 
                                fontSize: "24px", 
                                color: vc.vc_status === 1 ? "#1890ff" : "#999" 
                              }} 
                            />
                            <Text strong style={{ fontSize: "16px" }}>
                              凭证 ID: {vc.vc_id}
                            </Text>
                          </Space>
                          {renderVCStatusTag(vc.vc_status)}
                        </div>
                        <Tag color="blue" style={{ fontSize: "12px" }}>
                          {vc.vc_type}
                        </Tag>
                      </Space>
                    </div>

                    {/* VC Hash */}
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: "12px", display: "block", marginBottom: 4 }}>
                        VC Hash
                      </Text>
                      <Text 
                        code 
                        style={{ 
                          fontSize: "10px", 
                          wordBreak: "break-all",
                          background: "#f5f5f5",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          display: "block"
                        }}
                      >
                        {vc.vc_hash}
                      </Text>
                    </div>

                    {/* 时间信息 */}
                    <Space direction="vertical" size={4} style={{ width: "100%", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary" style={{ fontSize: "12px" }}>颁发时间</Text>
                        <Text style={{ fontSize: "12px" }}>
                          {dayjs(vc.vc_issued_at).format("YYYY-MM-DD HH:mm")}
                        </Text>
                      </div>
                      {vc.vc_revoked_at && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text type="secondary" style={{ fontSize: "12px" }}>撤销时间</Text>
                          <Text type="danger" style={{ fontSize: "12px" }}>
                            {dayjs(vc.vc_revoked_at).format("YYYY-MM-DD HH:mm")}
                          </Text>
                        </div>
                      )}
                    </Space>

                    {/* VC 内容 */}
                    {vc.vc_content && (
                      <div 
                        style={{ 
                          background: "rgba(24, 144, 255, 0.05)",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(24, 144, 255, 0.1)",
                          marginBottom: 12
                        }}
                      >
                        <Text 
                          strong 
                          style={{ 
                            fontSize: "13px", 
                            marginBottom: "8px", 
                            display: "block",
                            color: "#1890ff"
                          }}
                        >
                          凭证信息
                        </Text>
                        <Row gutter={[8, 8]}>
                          <Col span={12}>
                            <Tag 
                              color={vc.vc_content.isFormalPartyMember ? "success" : "error"}
                              style={{ width: "100%", textAlign: "center" }}
                            >
                              {vc.vc_content.isFormalPartyMember ? "✓" : "✗"} 正式党员
                            </Tag>
                          </Col>
                          <Col span={12}>
                            <Tag 
                              color="blue"
                              style={{ width: "100%", textAlign: "center" }}
                            >
                              党龄 {vc.vc_content.partyYears} 年
                            </Tag>
                          </Col>
                          <Col span={24}>
                            <Tag 
                              color="purple"
                              style={{ width: "100%", textAlign: "center" }}
                            >
                              所属党组织编码: {vc.vc_content.partyOrgCode}
                            </Tag>
                          </Col>
                          <Col span={24}>
                            <div style={{ textAlign: "center" }}>
                              <Text style={{ fontSize: "12px" }}>党员状态: </Text>
                              {renderPartyStatusTag(vc.vc_content.partyStatus)}
                            </div>
                          </Col>
                          <Col span={12}>
                            <Tag 
                              color={vc.vc_content.paidPartyFee ? "success" : "error"}
                              style={{ width: "100%", textAlign: "center", fontSize: "11px" }}
                            >
                              {vc.vc_content.paidPartyFee ? "✓" : "✗"} 党费
                            </Tag>
                          </Col>
                          <Col span={12}>
                            <Tag 
                              color={vc.vc_content.conflictFree ? "success" : "error"}
                              style={{ width: "100%", textAlign: "center", fontSize: "11px" }}
                            >
                              {vc.vc_content.conflictFree ? "✓" : "✗"} 无冲突
                            </Tag>
                          </Col>
                        </Row>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <Space size="small" style={{ width: "100%", display: "flex" }} direction="vertical">
                      <Space size="small" style={{ width: "100%" }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenEditVC(vc)}
                          style={{ flex: 1 }}
                        >
                          修改
                        </Button>
                        {vc.vc_status === 1 && (
                          <Button
                            type="default"
                            size="small"
                            danger
                            icon={<StopOutlined />}
                            onClick={() => handleRevokeVC(vc)}
                            style={{ flex: 1 }}
                          >
                            撤销
                          </Button>
                        )}
                      </Space>
                      <Button
                        type="default"
                        size="small"
                        icon={<SafetyOutlined />}
                        onClick={() => handleVerifyVC(vc)}
                        loading={verifying[vc.vc_id]}
                        style={{ width: "100%" }}
                      >
                        验证 凭证 真伪
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        {/* 编辑 VC 模态框 */}
        <Modal
          title={`修改 凭证 (ID: ${selectedVC?.vc_id || ""})`}
          open={openEditVC}
          onCancel={() => {
            if (updating) return;
            setOpenEditVC(false);
            form.resetFields();
            setSelectedVC(null);
          }}
          onOk={handleUpdateVCSubmit}
          confirmLoading={updating}
          okText="保存修改"
          cancelText="取消"
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
          >
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

            <Form.Item
              label="VC 状态"
              name="vcStatus"
              rules={[{ required: true, message: "请选择 VC 状态" }]}
            >
              <Select
                placeholder="请选择 VC 状态"
                options={[
                  { value: 0, label: "已撤销" },
                  { value: 1, label: "有效" },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  );
}
