pragma circom 2.0.0;

// =============================================================================
// eligibleVoter.circom — 投票资格零知识证明电路
// 在不泄露 VC 具体字段的前提下，证明持有者满足某次投票公布的资格规则。
// =============================================================================
//
// 私有输入（来自用户 VC；证明者掌握，验证方仅校验证明，不获知 VC 明文）：
//   is_formal_member   — 是否正式党员（0/1）
//   is_active          — 党员状态是否正常（0/1）
//   fee_paid           — 是否已缴纳党费（0/1）
//   no_conflict        — 是否无利益冲突（0/1）
//   voter_party_years  — 党龄（数值）
//   voter_org_code     — 党组织编码（数值）
//
// 公开输入（本次投票的资格规则，作为 public signal 进入证明/校验）：
//   require_formal_member — 是否要求正式党员（0/1）
//   require_active        — 是否要求状态正常（0/1）
//   require_fee_paid      — 是否要求已缴费（0/1）
//   require_no_conflict   — 是否要求无冲突（0/1）
//   require_party_years   — 是否校验最低党龄（0/1）
//   min_party_years       — 最低党龄（当 require_party_years=1 时生效）
//   require_org_code      — 是否要求指定组织编码（0/1）
//   required_org_code     — 要求的组织编码（当 require_org_code=1 时生效）
//
// 输出：
//   is_eligible — 是否同时满足所有「被要求的」条件（0/1）

template EligibleVoter() {
    // ---------- 私有输入：VC 中的资格相关字段 ----------
    signal input is_formal_member;
    signal input is_active;
    signal input fee_paid;
    signal input no_conflict;
    signal input voter_party_years;
    signal input voter_org_code;
    
    // ---------- 公开输入：投票侧公布的规则 ----------
    signal input require_formal_member;
    signal input require_active;
    signal input require_fee_paid;
    signal input require_no_conflict;
    signal input require_party_years;
    signal input min_party_years;
    signal input require_org_code;
    signal input required_org_code;
    
    // ---------- 输出 ----------
    signal output is_eligible;
    
    // 各子条件是否通过（1=通过，0=未通过）；最终 is_eligible 为全部子条件的乘积
    signal check_formal_member;
    signal check_active;
    signal check_fee_paid;
    signal check_no_conflict;
    signal check_party_years;
    signal check_org_code;
    
    // 正式党员：若规则不要求(require=0)，则视为通过(1)；若要求(require=1)，则须 is_formal_member=1
    // 公式：1 - r + r * v，r=0 时为 1；r=1 时为 v
    check_formal_member <== 1 - require_formal_member + require_formal_member * is_formal_member;
    
    // 状态正常
    check_active <== 1 - require_active + require_active * is_active;
    
    // 已缴党费
    check_fee_paid <== 1 - require_fee_paid + require_fee_paid * fee_paid;
    
    // 无利益冲突
    check_no_conflict <== 1 - require_no_conflict + require_no_conflict * no_conflict;
    
    // 党龄下限：不要求时通过；要求时用 GreaterEqThan 约束 voter_party_years >= min_party_years
    signal party_years_diff;
    party_years_diff <== voter_party_years - min_party_years;
    
    // 假设党龄可用 32 位表示（与比较器位宽一致）
    component geq = GreaterEqThan(32);
    geq.in[0] <== voter_party_years;
    geq.in[1] <== min_party_years;
    
    check_party_years <== 1 - require_party_years + require_party_years * geq.out;
    
    // 组织编码：不要求时通过；要求时 voter_org_code 必须等于 required_org_code
    component eq = IsEqual();
    eq.in[0] <== voter_org_code;
    eq.in[1] <== required_org_code;
    
    check_org_code <== 1 - require_org_code + require_org_code * eq.out;
    
    // 所有子条件须同时为 1（与门，用乘法实现）
    signal check1;
    signal check2;
    signal check3;
    signal check4;
    signal check5;
    
    check1 <== check_formal_member * check_active;
    check2 <== check1 * check_fee_paid;
    check3 <== check2 * check_no_conflict;
    check4 <== check3 * check_party_years;
    check5 <== check4 * check_org_code;
    
    is_eligible <== check5;
}

// 比较器：in[0] >= in[1] 时 out=1，否则 out=0
template GreaterEqThan(n) {
    signal input in[2];
    signal output out;
    
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1];
    
    // a >= b 等价于 NOT (a < b)
    out <== 1 - lt.out;
}

// 比较器：in[0] < in[1] 时 out=1（n 为参与比较的位宽相关参数）
template LessThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    
    // 将 in[0]-in[1]+2^n 展开为二进制，通过最高位判断差值符号
    component n2b = Num2Bits(n+1);
    n2b.in <== in[0] + (1<<n) - in[1];
    
    out <== 1 - n2b.out[n];
}

// 将无符号整数 in 拆成 n 个二进制位 out[i]（带约束保证与 in 一致）
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    
    var e2 = 1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    
    lc1 === in;
}

// 相等比较：in[0] == in[1] 时 out=1
template IsEqual() {
    signal input in[2];
    signal output out;
    
    component isz = IsZero();
    isz.in <== in[1] - in[0];
    
    out <== isz.out;
}

// 判零：in==0 时 out=1；否则 out=0（用 witness inv 辅助约束）
template IsZero() {
    signal input in;
    signal output out;
    
    signal inv;
    inv <-- in != 0 ? 1/in : 0;
    
    out <== -in * inv + 1;
    in * out === 0;
}

// 主电路：公开信号为投票规则侧全部输入，便于链上/验证端与声明的投票规则对齐
component main {public [require_formal_member, require_active, require_fee_paid, require_no_conflict, require_party_years, min_party_years, require_org_code, required_org_code]} = EligibleVoter();



