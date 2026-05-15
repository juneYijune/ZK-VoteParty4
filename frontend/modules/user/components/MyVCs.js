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
  Spin,
  Empty,
  Modal,
} from "antd";
import {
  SafetyCertificateOutlined,
  ReloadOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { connectWallet } from "@/services/wallet";
import { listVCs, verifyVCSignature } from "@/services/vc";
import { hashWalletAddress } from "@/services/partyUsers";

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

export function MyVCs() {
  const [vcs, setVCs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletHash, setWalletHash] = useState("");
  const [verifying, setVerifying] = useState({});

  // 连接钱包并加载 VC 列表
  async function loadMyVCs() {
    try {
      setLoading(true);

      // 连接钱包
      const address = await connectWallet();
      if (!address) {
        throw new Error("未连接钱包");
      }

      setWalletAddress(address);

      // 调用后端 API 计算钱包地址的 Poseidon Hash
      const hashResult = await hashWalletAddress(address);
      const hash = hashResult.wallet_address_hash;
      setWalletHash(hash);

      // 查询 VC 列表
      const data = await listVCs({
        holder_wallet_hash: hash,
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
    loadMyVCs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* 页面标题 */}
      <div>
        <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
          <WalletOutlined style={{ marginRight: "12px" }} />
          我的可验证凭证
        </Title>
        <Text type="secondary" style={{ fontSize: "14px" }}>
          查看您的所有 VC
        </Text>
      </div>

      {/* 钱包信息卡片 */}
      {walletAddress && (
        <Card
          size="small"
          title="钱包信息"
          style={{
            borderRadius: "8px",
          }}
        >
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="钱包地址">
              <Text code style={{ fontSize: "12px" }}>
                {walletAddress}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="钱包地址哈希">
              <Text code style={{ fontSize: "12px", wordBreak: "break-all" }}>
                {walletHash}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 操作栏 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title level={4} style={{ margin: 0 }}>
          我的凭证列表 ({vcs.length})
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadMyVCs} loading={loading}>
          刷新
        </Button>
      </div>

      {/* VC 列表 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </div>
      ) : vcs.length === 0 ? (
        <Card style={{ borderRadius: "12px", textAlign: "center" }}>
          <Empty
            description="暂无可验证凭证"
            style={{ padding: "40px 0" }}
          />
        </Card>
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
                          身份凭证编号: {vc.vc_id}
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
                      border: "1px solid rgba(24, 144, 255, 0.1)"
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

                {/* 验证按钮 */}
                <Button
                  type="primary"
                  size="small"
                  icon={<SafetyOutlined />}
                  onClick={() => handleVerifyVC(vc)}
                  loading={verifying[vc.vc_id]}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  验证 凭证 真伪
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
