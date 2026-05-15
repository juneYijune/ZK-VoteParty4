"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Steps,
  Space,
  Typography,
  Button,
  Card,
  Tag,
  Alert,
  Spin,
  Empty,
  Descriptions,
  Row,
  Col,
  message,
  Radio,
  Input,
} from "antd";
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  FileProtectOutlined,
  VerifiedOutlined,
  EditOutlined,
} from "@ant-design/icons";

import { verifyVCSignature, getMyValidVCs } from "@/services/vc";
import { generateProof, verifyProof, verifyProofOnChain } from "@/services/zk";
import { saveVerification } from "@/utils/zkVerificationStorage";

/**
 * 本模块：投票资格验证弹窗（VC 凭证 + 零知识证明）。
 *
 * 数据流概览：
 * - getMyValidVCs / verifyVCSignature：与后端交互，确认凭证列表与签名、签发者、撤销状态。
 * - generateProof / verifyProof / verifyProofOnChain：本地或链上校验 ZK 证明是否满足 voteId 对应规则。
 * - saveVerification：将本次验证摘要写入本地存储，供投票页判断是否已验过。
 */
const { Title, Text } = Typography;

/**
 * 资格验证对话框组件
 * 
 * 实现完整的零知识证明投票资格验证流程：
 * 1. select_vc - 选择VC
 * 2. verifying_signature - 验证VC签名
 * 3. generating_proof - 生成零知识证明
 * 4. verifying_proof - 验证零知识证明
 * 5. complete - 完成
 * 
 * @param {object} props - 组件属性
 * @param {boolean} props.visible - 对话框是否可见
 * @param {number} props.voteId - 投票ID
 * @param {object} props.eligibilityRule - 资格规则对象
 * @param {string} props.walletAddress - 钱包地址
 * @param {function} props.onVerificationComplete - 验证完成回调 (success: boolean) => void
 * @param {function} props.onClose - 关闭对话框回调
 */
export function EligibilityVerificationDialog({
  visible,
  voteId,
  eligibilityRule,
  walletAddress,
  onVerificationComplete,
  onClose,
}) {
  // 步骤状态
  const [step, setStep] = useState("select_vc"); // select_vc | verifying_signature | generating_proof | verifying_proof | complete
  
  // VC相关状态
  const [validVCs, setValidVCs] = useState([]);
  const [selectedVcId, setSelectedVcId] = useState(null);
  const [loadingVCs, setLoadingVCs] = useState(false);
  
  // 验证流程状态
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  
  // 每个步骤的结果状态
  const [stepResults, setStepResults] = useState({
    signature: null, // { success: boolean, message: string }
    proof: null,     // { success: boolean, message: string, data: { proof, publicSignals } }
    verify: null,    // { success: boolean, message: string, data: { isValid, isEligible } }
  });
  
  // 验证方式选择：'offchain' 或 'onchain'
  const [verificationMethod, setVerificationMethod] = useState("offchain");
  
  // 可编辑的证明数据
  const [editableProof, setEditableProof] = useState("");
  const [editablePublicSignals, setEditablePublicSignals] = useState("");
  const [isEditingProof, setIsEditingProof] = useState(false);
  
  // 步骤配置
  const steps = [
    {
      key: "select_vc",
      title: "选择凭证",
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: "verifying_signature",
      title: "验证签名",
      icon: <SafetyOutlined />,
    },
    {
      key: "generating_proof",
      title: "生成证明",
      icon: <FileProtectOutlined />,
    },
    {
      key: "verifying_proof",
      title: "验证证明",
      icon: <VerifiedOutlined />,
    },
    {
      key: "complete",
      title: "完成",
      icon: <CheckCircleOutlined />,
    },
  ];
  
  /** 与 Steps 组件联动：用当前 `step` 在 `steps` 中的下标作为 current。 */
  const getCurrentStepIndex = () => {
    return steps.findIndex(s => s.key === step);
  };
  
  /** 拉取当前钱包下仍有效的 VC，供用户选择；失败时写入 `error`。 */
  async function loadValidVCs() {
    try {
      setLoadingVCs(true);
      setError(null);
      
      // 调用API获取用户的有效VC列表
      const vcs = await getMyValidVCs(walletAddress);
      
      setValidVCs(vcs || []);
      
      // 处理空VC列表情况
      if (!vcs || vcs.length === 0) {
        setError("您没有有效的可验证凭证，请先申请VC");
      }
    } catch (e) {
      console.error("加载VC列表失败:", e);
      setError(e.message || "加载VC列表失败，请重试");
    } finally {
      setLoadingVCs(false);
    }
  }
  
  // 当对话框打开时加载VC列表
  useEffect(() => {
    if (visible && walletAddress) {
      loadValidVCs();
      // 重置状态
      setStep("select_vc");
      setSelectedVcId(null);
      setError(null);
      setVerificationResult(null);
      setStepResults({
        signature: null,
        proof: null,
        verify: null,
      });
      setEditableProof("");
      setEditablePublicSignals("");
      setIsEditingProof(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, walletAddress]);
  
  // 处理VC选择
  function handleVCSelect(vcId) {
    setSelectedVcId(vcId);
    setError(null);
  }
  
  /**
   * 步骤1：校验所选 VC 的密码学签名、签发者白名单与撤销状态。
   * 任一失败则停留在本步并写入 `stepResults.signature`；全部通过才可进入「生成证明」。
   */
  async function handleVerifySignature() {
    if (!selectedVcId) {
      message.warning("请先选择一个可验证凭证");
      return;
    }
    
    try {
      setVerifying(true);
      setError(null);
      setStep("verifying_signature");
      
      const result = await verifyVCSignature(selectedVcId);
      
      // 检查验证结果
      if (!result.isSignatureValid) {
        // 签名验证失败
        setStepResults(prev => ({
          ...prev,
          signature: {
            success: false,
            message: "身份凭证签名验证失败！该凭证可能已被篡改或使用了错误的签名。"
          }
        }));
        message.error("身份凭证签名验证失败");
        return;
      }
      
      if (!result.isLegalIssuer) {
        // 签发者不合法
        setStepResults(prev => ({
          ...prev,
          signature: {
            success: false,
            message: "身份凭证签发者不合法！该凭证不是由合法党组织签发的。"
          }
        }));
        message.error("身份凭证签发者不合法");
        return;
      }
      
      if (!result.isVCActive) {
        // VC已被撤销
        setStepResults(prev => ({
          ...prev,
          signature: {
            success: false,
            message: "身份凭证已被撤销！该凭证已失效，无法使用。"
          }
        }));
        message.error("身份凭证已被撤销");
        return;
      }
      
      // 所有验证都通过
      setStepResults(prev => ({
        ...prev,
        signature: {
          success: true,
          message: "身份凭证签名验证成功！凭证有效且未被篡改。"
        }
      }));
      
      message.success("身份凭证签名验证成功");
    } catch (e) {
      console.error("签名验证失败:", e);
      setStepResults(prev => ({
        ...prev,
        signature: {
          success: false,
          message: e.message || "身份凭证签名验证失败，请检查凭证是否有效"
        }
      }));
      setError(e.message || "身份凭证签名验证失败");
    } finally {
      setVerifying(false);
    }
  }
  
  /**
   * 步骤2：基于选中 VC、voteId、钱包地址调用 `generateProof`，
   * 结果写入 `stepResults.proof` 并同步到可编辑 JSON 文本框（便于调试或手动改数据）。
   */
  async function handleGenerateProof() {
    if (!walletAddress || !walletAddress.trim()) {
      message.error("请先连接钱包");
      setError("请先连接钱包后再进行验证");
      return;
    }
    
    try {
      setVerifying(true);
      setError(null);
      setStep("generating_proof");
      
      const { proof, publicSignals } = await generateProof(
        selectedVcId,
        voteId,
        walletAddress
      );
      
      // 证明生成成功
      setStepResults(prev => ({
        ...prev,
        proof: {
          success: true,
          message: "零知识证明生成成功！已生成加密证明数据。",
          data: { proof, publicSignals }
        }
      }));
      
      // 初始化可编辑的证明数据
      setEditableProof(JSON.stringify(proof, null, 2));
      setEditablePublicSignals(JSON.stringify(publicSignals, null, 2));
      setIsEditingProof(false);
      
      message.success("零知识证明生成成功");
    } catch (e) {
      console.error("证明生成失败:", e);
      setStepResults(prev => ({
        ...prev,
        proof: {
          success: false,
          message: e.message || "证明生成失败，请重试"
        }
      }));
      setError(e.message || "证明生成失败");
    } finally {
      setVerifying(false);
    }
  }
  
  /**
   * 步骤3：从可编辑区解析 proof / publicSignals，按 `verificationMethod` 调用
   * `verifyProof`（链下）或 `verifyProofOnChain`（链上），结果写入 `stepResults.verify`。
   */
  async function handleVerifyProof() {
    const proofData = stepResults.proof?.data;
    if (!proofData) {
      message.error("请先生成证明");
      return;
    }
    
    try {
      setVerifying(true);
      setError(null);
      setStep("verifying_proof");
      
      // 使用可编辑的证明数据（如果用户修改了）
      let proof, publicSignals;
      
      try {
        proof = JSON.parse(editableProof);
        publicSignals = JSON.parse(editablePublicSignals);
      } catch (parseError) {
        message.error("证明数据格式错误，请检查 JSON 格式");
        setVerifying(false);
        setStep("generating_proof");
        return;
      }
      
      let verifyResult;
      
      // 根据选择的验证方式进行验证
      if (verificationMethod === "onchain") {
        // 链上验证
        verifyResult = await verifyProofOnChain(
          proof,
          publicSignals,
          voteId,
          walletAddress
        );
      } else {
        // 链下验证（原有方式）
        verifyResult = await verifyProof(
          proof,
          publicSignals,
          voteId
        );
      }
      
      // 证明验证完成
      const isSuccess = verifyResult.isValid && verifyResult.isEligible;
      const verificationMethodText = verificationMethod === "onchain" ? "链上" : "链下";
      
      setStepResults(prev => ({
        ...prev,
        verify: {
          success: isSuccess,
          message: isSuccess 
            ? `${verificationMethodText}验证成功！您满足该投票的资格要求。${verificationMethod === "onchain" ? " 验证已记录在区块链上。" : ""}` 
            : `${verificationMethodText}验证失败，您不满足该投票的资格要求。`,
          data: { ...verifyResult, method: verificationMethod }
        }
      }));
      
      if (isSuccess) {
        message.success(`${verificationMethodText}验证成功`);
      } else {
        message.error(`${verificationMethodText}验证失败`);
      }
    } catch (e) {
      console.error("证明验证失败:", e);
      setStepResults(prev => ({
        ...prev,
        verify: {
          success: false,
          message: e.message || "证明验证失败，请重试",
          data: { isValid: false, isEligible: false }
        }
      }));
      setError(e.message || "证明验证失败");
    } finally {
      setVerifying(false);
    }
  }
  
  /**
   * 步骤4：持久化本次验证（优先使用可编辑区 JSON；解析失败则回退到生成步骤的原始 proof）。
   * 然后 `setStep("complete")` 并回调 `onVerificationComplete(is_verified)`。
   */
  function handleComplete() {
    const verifyData = stepResults.verify?.data;
    const proofData = stepResults.proof?.data;
    
    if (!verifyData || !proofData) {
      message.error("验证数据不完整");
      return;
    }
    
    // 使用可编辑的证明数据（如果用户修改了）
    let proof, publicSignals;
    
    try {
      proof = JSON.parse(editableProof);
      publicSignals = JSON.parse(editablePublicSignals);
    } catch (parseError) {
      // 用户未改或 JSON 损坏时回退到生成证明时缓存的原始对象，避免完成流程卡死
      proof = proofData.proof;
      publicSignals = proofData.publicSignals;
    }
    
    // 保存验证记录
    const verificationData = {
      vote_id: voteId,
      wallet_address: walletAddress,
      vc_id: selectedVcId,
      proof: proof,
      publicSignals: publicSignals,
      is_verified: verifyData.isValid && verifyData.isEligible,
      verified_at: new Date().toISOString(),
    };
    
    saveVerification(walletAddress, voteId, verificationData);
    
    setStep("complete");
    setVerificationResult(verificationData);
    
    // 通知父组件验证完成
    if (onVerificationComplete) {
      onVerificationComplete(verificationData.is_verified);
    }
    
    message.success("验证流程已完成");
  }
  
  // 关闭对话框
  function handleClose() {
    if (onClose) {
      onClose();
    }
  }
  
  /** 将 `eligibilityRule` 渲染为标签列表（正式党员、党龄、组织编码等）。 */
  function renderEligibilityRule() {
    if (!eligibilityRule) {
      return <Empty description="暂无资格规则" />;
    }
    
    // 仅当 require_org_code 有非 0 真值时展示组织编码要求（上方曾用字符串判断，已简化为数值）
    const hasValidOrgCode = eligibilityRule.require_org_code && 
                            // String(eligibilityRule.require_org_code).trim() !== "" && 
                            // String(eligibilityRule.require_org_code) !== "0" && 
                            eligibilityRule.require_org_code !== 0;
    
    return (
      <Card size="small" title="投票资格要求" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {eligibilityRule.require_formal_member ? (
            <Tag color="blue" icon={<CheckCircleOutlined />}>
              要求正式党员
            </Tag>
          ) : null}
          {eligibilityRule.require_active_status ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              要求党员状态正常
            </Tag>
          ) : null}
          {eligibilityRule.require_fee_paid ? (
            <Tag color="cyan" icon={<CheckCircleOutlined />}>
              要求已缴纳党费
            </Tag>
          ) : null}
          {eligibilityRule.require_no_conflict ? (
            <Tag color="purple" icon={<CheckCircleOutlined />}>
              要求无利益冲突
            </Tag>
          ) : null}
          {eligibilityRule.min_party_years > 0 ? (
            <Tag color="orange" icon={<CheckCircleOutlined />}>
              要求党龄 ≥ {eligibilityRule.min_party_years} 年
            </Tag>
          ) : null}
          {hasValidOrgCode ? (
            <Tag color="magenta" icon={<CheckCircleOutlined />}>
              要求党组织编码: {eligibilityRule.require_org_code}
            </Tag>
          ) : null}
        </Space>
      </Card>
    );
  }
  
  /** 加载中 / 空列表 / 卡片列表；点击卡片更新 `selectedVcId`。 */
  function renderVCList() {
    if (loadingVCs) {
      return (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </div>
      );
    }
    
    if (validVCs.length === 0) {
      return (
        <Empty
          description="您没有有效的可验证凭证"
          style={{ padding: "40px 0" }}
        />
      );
    }
    
    return (
      <Row gutter={[16, 16]}>
        {validVCs.map((vc) => (
          <Col key={vc.vc_id} span={24}>
            <Card
              hoverable
              onClick={() => handleVCSelect(vc.vc_id)}
              style={{
                border: selectedVcId === vc.vc_id ? "2px solid #1890ff" : "1px solid #f0f0f0",
                background: selectedVcId === vc.vc_id ? "#e6f7ff" : "#fff",
                cursor: "pointer",
              }}
            >
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Space>
                    <SafetyCertificateOutlined style={{ fontSize: "20px", color: "#1890ff" }} />
                    <Text strong>身份凭证编号: {vc.vc_id}</Text>
                  </Space>
                  {selectedVcId === vc.vc_id && (
                    <CheckCircleOutlined style={{ fontSize: "20px", color: "#52c41a" }} />
                  )}
                </div>
                
                {vc.vc_content && (
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label="正式党员">
                      {vc.vc_content.isFormalPartyMember ? (
                        <Tag color="success">是</Tag>
                      ) : (
                        <Tag color="error">否</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="党龄">
                      {vc.vc_content.partyYears} 年
                    </Descriptions.Item>
                    <Descriptions.Item label="党组织编码">
                      {vc.vc_content.partyOrgCode}
                    </Descriptions.Item>
                    <Descriptions.Item label="党员状态">
                      {vc.vc_content.partyStatus === 1 ? (
                        <Tag color="success">正常</Tag>
                      ) : (
                        <Tag color="error">异常</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="党费">
                      {vc.vc_content.paidPartyFee ? (
                        <Tag color="success">已缴纳</Tag>
                      ) : (
                        <Tag color="error">未缴纳</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="冲突记录">
                      {vc.vc_content.conflictFree ? (
                        <Tag color="success">无</Tag>
                      ) : (
                        <Tag color="error">有</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }
  
  /**
   * 展示某子步骤的结果卡片或 Alert。
   * @param {"signature"|"proof"|"verify"} stepKey — 对应 `stepResults` 的键（非 Ant Steps 的 key 字符串）
   * @param {string} stepName — 界面展示用中文名称
   */
  function renderStepResult(stepKey, stepName) {
    const result = stepResults[stepKey];
    
    if (!result) {
      return null;
    }
    
    // 如果是证明生成步骤且成功，显示证明详情
    if (stepKey === "proof" && result.success && result.data) {
      return (
        <Card 
          title={
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <span>{stepName}成功</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          type="inner"
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Alert
              message={result.message}
              type="success"
              showIcon
            />
            
            <Card 
              size="small" 
              title={
                <Space>
                  <span>生成的证明数据</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setIsEditingProof(!isEditingProof)}
                  >
                    {isEditingProof ? "取消编辑" : "编辑证明"}
                  </Button>
                </Space>
              }
              type="inner"
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div>
                  <Text strong>证明对象 (Proof):</Text>
                  {isEditingProof ? (
                    <Input.TextArea
                      value={editableProof}
                      onChange={(e) => setEditableProof(e.target.value)}
                      rows={8}
                      style={{ 
                        marginTop: 8,
                        fontFamily: "monospace",
                        fontSize: 12
                      }}
                      placeholder="请输入有效的 JSON 格式证明数据"
                    />
                  ) : (
                    <div style={{ 
                      marginTop: 8, 
                      padding: 12, 
                      background: "#f5f5f5", 
                      borderRadius: 4,
                      maxHeight: 200,
                      overflow: "auto",
                      fontFamily: "monospace",
                      fontSize: 12
                    }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {editableProof}
                      </pre>
                    </div>
                  )}
                </div>
                
                <div>
                  <Text strong>公共信号 (Public Signals):</Text>
                  {isEditingProof ? (
                    <Input.TextArea
                      value={editablePublicSignals}
                      onChange={(e) => setEditablePublicSignals(e.target.value)}
                      rows={6}
                      style={{ 
                        marginTop: 8,
                        fontFamily: "monospace",
                        fontSize: 12
                      }}
                      placeholder="请输入有效的 JSON 格式公共信号数据"
                    />
                  ) : (
                    <div style={{ 
                      marginTop: 8, 
                      padding: 12, 
                      background: "#f5f5f5", 
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: 12
                    }}>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {editablePublicSignals}
                      </pre>
                    </div>
                  )}
                </div>
                
                <Alert
                  message="说明"
                  description={isEditingProof 
                    ? "您可以手动修改证明数据和公共信号进行测试。请确保输入的是有效的 JSON 格式。修改后的数据将用于下一步验证。" 
                    : "证明数据已加密，包含您的资格信息但不会泄露具体内容。公共信号用于验证证明的有效性。"}
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              </Space>
            </Card>
          </Space>
        </Card>
      );
    }
    
    // 如果是验证步骤且成功，显示验证详情（包括链上交易信息）
    if (stepKey === "verify" && result.success && result.data) {
      const isOnchain = result.data.method === "onchain";
      
      return (
        <Card 
          title={
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <span>{stepName}成功</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          type="inner"
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Alert
              message={result.message}
              type="success"
              showIcon
            />
            
            {isOnchain && result.data.txHash && (
              <Card size="small" title="链上交易信息" type="inner">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="交易哈希">
                    <Text copyable style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {result.data.txHash}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="区块号">
                    <Tag color="blue">{result.data.blockNumber}</Tag>
                  </Descriptions.Item>
                  {result.data.timestamp && (
                    <Descriptions.Item label="交易时间">
                      {new Date(result.data.timestamp * 1000).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <Alert
                  message="验证记录已永久保存在区块链上"
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              </Card>
            )}
          </Space>
        </Card>
      );
    }
    
    // 其他步骤显示简单的提示
    return (
      <Alert
        message={`${stepName}${result.success ? "成功" : "失败"}`}
        description={result.message}
        type={result.success ? "success" : "error"}
        showIcon
        icon={result.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        style={{ marginBottom: 16 }}
      />
    );
  }
  
  /** 异步请求进行中时全屏 Spin；`step` 决定提示文案（验签 / 生成证明 / 验证明）。 */
  function renderVerificationProgress() {
    if (verifying) {
      const stepMessages = {
        verifying_signature: "正在验证VC签名...",
        generating_proof: "正在生成零知识证明...",
        verifying_proof: "正在验证零知识证明...",
      };
      
      return (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <div style={{ marginTop: 24 }}>
            <Text strong style={{ fontSize: "16px" }}>
              {stepMessages[step]}
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              请稍候，这可能需要几秒钟时间
            </Text>
          </div>
        </div>
      );
    }
    
    return null;
  }
  
  /** `complete` 步骤：根据 `verificationResult.is_verified` 显示成功或失败大图标与说明。 */
  function renderComplete() {
    if (!verificationResult) {
      return null;
    }
    
    const isSuccess = verificationResult.is_verified;
    
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        {isSuccess ? (
          <>
            <CheckCircleOutlined style={{ fontSize: 64, color: "#52c41a" }} />
            <div style={{ marginTop: 24 }}>
              <Title level={3} style={{ color: "#52c41a", margin: 0 }}>
                验证成功！
              </Title>
            </div>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                您满足该投票的资格要求，即将跳转到投票详情页面...
              </Text>
            </div>
          </>
        ) : (
          <>
            <CloseCircleOutlined style={{ fontSize: 64, color: "#ff4d4f" }} />
            <div style={{ marginTop: 24 }}>
              <Title level={3} style={{ color: "#ff4d4f", margin: 0 }}>
                验证失败
              </Title>
            </div>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                您不满足该投票的资格要求
              </Text>
            </div>
          </>
        )}
      </div>
    );
  }
  
  /**
   * 按 `step` 分支主区域：各步会叠加展示前面已通过步骤的 `renderStepResult`，
   * 保证用户能回看签名/证明/验证结果。
   */
  function renderContent() {
    switch (step) {
      case "select_vc":
        return (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {renderEligibilityRule()}
            <Card size="small" title="选择您的可验证凭证">
              {renderVCList()}
            </Card>
          </Space>
        );
      
      case "verifying_signature":
        return (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {renderVerificationProgress()}
            {renderStepResult("signature", "VC签名验证")}
          </Space>
        );
      
      case "generating_proof":
        return (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {renderStepResult("signature", "VC签名验证")}
            {renderVerificationProgress()}
            {renderStepResult("proof", "零知识证明生成")}
            {stepResults.proof && stepResults.proof.success && !verifying && (
              <Card size="small" title="选择验证方式" type="inner">
                <Radio.Group 
                  value={verificationMethod} 
                  onChange={(e) => setVerificationMethod(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Radio value="offchain">
                      <Space direction="vertical" size={4}>
                        <Text strong>链下验证（推荐）</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          在后端服务器上验证，速度快，无需 Gas 费用
                        </Text>
                      </Space>
                    </Radio>
                    <Radio value="onchain">
                      <Space direction="vertical" size={4}>
                        <Text strong>链上验证</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          在区块链上验证，公开透明，需要支付 Gas 费用
                        </Text>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Card>
            )}
          </Space>
        );
      
      case "verifying_proof":
        return (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {renderStepResult("signature", "VC签名验证")}
            {renderStepResult("proof", "零知识证明生成")}
            {renderVerificationProgress()}
            {renderStepResult("verify", "零知识证明验证")}
          </Space>
        );
      
      case "complete":
        return (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {renderStepResult("signature", "VC签名验证")}
            {renderStepResult("proof", "零知识证明生成")}
            {renderStepResult("verify", "零知识证明验证")}
            {renderComplete()}
          </Space>
        );
      
      default:
        return null;
    }
  }
  
  /**
   * 底部按钮随 `step` 与 `verifying` / 各 `stepResults` 变化：
   * 进行中禁用关闭；失败给「返回重试」；验证明成功时「返回」禁用以防篡改已成功的验证后再点完成。
   */
  function renderFooter() {
    if (step === "complete") {
      return [
        <Button key="close" type="primary" onClick={handleClose}>
          关闭
        </Button>,
      ];
    }
    
    // 选择VC步骤
    if (step === "select_vc") {
      return [
        <Button key="cancel" onClick={handleClose} disabled={verifying}>
          取消
        </Button>,
        <Button
          key="verify"
          type="primary"
          onClick={handleVerifySignature}
          disabled={!selectedVcId || verifying || loadingVCs || !walletAddress || !walletAddress.trim()}
          loading={verifying}
        >
          验证签名
        </Button>,
      ];
    }
    
    // 验证签名步骤
    if (step === "verifying_signature") {
      const signatureResult = stepResults.signature;
      
      if (verifying) {
        return [
          <Button key="cancel" onClick={handleClose} disabled>
            取消
          </Button>,
        ];
      }
      
      if (signatureResult) {
        if (signatureResult.success) {
          return [
            <Button key="back" onClick={() => setStep("select_vc")}>
              返回
            </Button>,
            <Button
              key="next"
              type="primary"
              onClick={handleGenerateProof}
            >
              生成证明
            </Button>,
          ];
        } else {
          return [
            <Button key="back" onClick={() => setStep("select_vc")}>
              返回重试
            </Button>,
            <Button key="close" onClick={handleClose}>
              关闭
            </Button>,
          ];
        }
      }
      
      return null;
    }
    
    // 生成证明步骤
    if (step === "generating_proof") {
      const proofResult = stepResults.proof;
      
      if (verifying) {
        return [
          <Button key="cancel" onClick={handleClose} disabled>
            取消
          </Button>,
        ];
      }
      
      if (proofResult) {
        if (proofResult.success) {
          return [
            <Button key="back" onClick={() => setStep("verifying_signature")}>
              返回
            </Button>,
            <Button
              key="next"
              type="primary"
              onClick={handleVerifyProof}
            >
              {verificationMethod === "onchain" ? "链上验证" : "链下验证"}
            </Button>,
          ];
        } else {
          return [
            <Button key="back" onClick={() => setStep("verifying_signature")}>
              返回重试
            </Button>,
            <Button key="close" onClick={handleClose}>
              关闭
            </Button>,
          ];
        }
      }
      
      return null;
    }
    
    // 验证证明步骤
    if (step === "verifying_proof") {
      const verifyResult = stepResults.verify;
      
      if (verifying) {
        return [
          <Button key="cancel" onClick={handleClose} disabled>
            取消
          </Button>,
        ];
      }
      
      if (verifyResult) {
        return [
          <Button key="back" onClick={() => setStep("generating_proof")} disabled={verifyResult.success}>
            返回
          </Button>,
          <Button
            key="complete"
            type="primary"
            onClick={handleComplete}
          >
            完成
          </Button>,
        ];
      }
      
      return null;
    }
    
    return null;
  }
  
  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>投票资格验证</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={renderFooter()}
      width={700}
      closable={!verifying}
      maskClosable={!verifying}
      keyboard={!verifying}
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* 钱包地址检查警告 */}
        {(!walletAddress || !walletAddress.trim()) && (
          <Alert
            message="请先连接钱包"
            description="您需要先连接钱包才能进行投票资格验证。请刷新页面并确保钱包已连接。"
            type="warning"
            showIcon
            closable={false}
          />
        )}
        
        {/* 步骤指示器 */}
        <Steps
          current={getCurrentStepIndex()}
          items={steps.map(s => ({
            title: s.title,
            icon: s.icon,
          }))}
          size="small"
        />
        
        {/* 内容区域 */}
        {renderContent()}
      </Space>
    </Modal>
  );
}

