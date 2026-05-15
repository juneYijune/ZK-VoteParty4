/**
 * 角色切换调试脚本
 * 
 * 在浏览器控制台运行此脚本来调试角色切换问题
 * 
 * 使用方法：
 * 1. 打开浏览器开发者工具（F12）
 * 2. 进入 Console 标签
 * 3. 复制并粘贴这个脚本
 * 4. 按回车执行
 */

console.log('=== 角色切换调试脚本 ===\n');

// 1. 检查当前状态
function checkCurrentState() {
  console.log('1. 当前状态检查:');
  console.log('  - 当前路径:', window.location.pathname);
  console.log('  - 当前 URL:', window.location.href);
  
  // 检查 Cookie
  const cookies = document.cookie.split(';').map(c => c.trim());
  const userCookie = cookies.find(c => c.startsWith('user='));
  
  if (userCookie) {
    try {
      const cookieValue = decodeURIComponent(userCookie.split('=')[1]);
      const user = JSON.parse(cookieValue);
      console.log('  - Cookie 用户:', user);
    } catch (e) {
      console.log('  - Cookie 解析失败:', e.message);
    }
  } else {
    console.log('  - Cookie: 不存在');
  }
  
  // 检查 localStorage
  const address = localStorage.getItem('wallet_address');
  const loginAt = localStorage.getItem('wallet_login_at');
  console.log('  - localStorage address:', address);
  console.log('  - localStorage loginAt:', loginAt ? new Date(parseInt(loginAt)).toLocaleString() : null);
  
  console.log('');
}

// 2. 完全清除状态
function clearAllState() {
  console.log('2. 清除所有状态:');
  
  // 清除 Cookie（多种方式）
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'user=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // 清除 localStorage
  localStorage.removeItem('wallet_address');
  localStorage.removeItem('wallet_login_at');
  
  console.log('  ✅ 状态已清除');
  console.log('  - 请刷新页面验证');
  console.log('');
}

// 3. 模拟登录（用于测试）
function simulateLogin(role) {
  console.log(`3. 模拟登录 (${role}):`);
  
  const roleMap = {
    'admin': 'SYSTEM_ADMIN',
    'partyorg': 'PARTY_ORG_ADMIN',
    'user': 'USER'
  };
  
  const testUser = {
    address: `0x${Math.random().toString(16).substr(2, 40)}`,
    role: roleMap[role] || 'USER',
    loginAt: Date.now()
  };
  
  // 设置 Cookie
  const cookieValue = JSON.stringify(testUser);
  document.cookie = `user=${encodeURIComponent(cookieValue)}; path=/; max-age=${60*60*24*7}; SameSite=Lax`;
  
  // 设置 localStorage
  localStorage.setItem('wallet_address', testUser.address);
  localStorage.setItem('wallet_login_at', String(testUser.loginAt));
  
  console.log('  ✅ 模拟登录完成');
  console.log('  - 角色:', testUser.role);
  console.log('  - 地址:', testUser.address);
  console.log('');
}

// 4. 测试角色切换
function testRoleSwitch(fromRole, toRole) {
  console.log(`4. 测试角色切换: ${fromRole} → ${toRole}`);
  console.log('  步骤 1: 清除当前状态');
  clearAllState();
  
  setTimeout(() => {
    console.log(`  步骤 2: 模拟登录为 ${toRole}`);
    simulateLogin(toRole);
    
    setTimeout(() => {
      console.log('  步骤 3: 检查状态');
      checkCurrentState();
      
      console.log('  步骤 4: 建议操作');
      const pathMap = {
        'admin': '/admin',
        'partyorg': '/partyorg',
        'user': '/user'
      };
      console.log(`  - 访问: ${pathMap[toRole]}`);
      console.log(`  - 或运行: window.location.href = '${pathMap[toRole]}'`);
      console.log('');
    }, 100);
  }, 100);
}

// 5. 监控 Cookie 变化
function monitorCookieChanges() {
  console.log('5. 开始监控 Cookie 变化:');
  
  let lastCookie = document.cookie;
  
  const interval = setInterval(() => {
    const currentCookie = document.cookie;
    if (currentCookie !== lastCookie) {
      console.log('  Cookie 变化检测:');
      console.log('  - 之前:', lastCookie);
      console.log('  - 现在:', currentCookie);
      console.log('  - 时间:', new Date().toLocaleTimeString());
      lastCookie = currentCookie;
    }
  }, 100);
  
  console.log('  ✅ 监控已启动（每 100ms 检查一次）');
  console.log('  - 运行 stopMonitoring() 停止监控');
  console.log('');
  
  window.stopMonitoring = () => {
    clearInterval(interval);
    console.log('  ✅ 监控已停止');
  };
}

// 6. 检查中间件
function checkMiddleware() {
  console.log('6. 检查中间件配置:');
  console.log('  提示：中间件在服务端运行，无法直接检查');
  console.log('  建议：');
  console.log('  - 查看 frontend/middleware.js');
  console.log('  - 查看服务端日志');
  console.log('  - 使用 Network 标签查看请求');
  console.log('');
}

// 导出函数
window.roleDebug = {
  checkCurrentState,
  clearAllState,
  simulateLogin,
  testRoleSwitch,
  monitorCookieChanges,
  checkMiddleware
};

console.log('可用命令:');
console.log('  roleDebug.checkCurrentState()           - 检查当前状态');
console.log('  roleDebug.clearAllState()               - 清除所有状态');
console.log('  roleDebug.simulateLogin("admin")        - 模拟管理员登录');
console.log('  roleDebug.simulateLogin("partyorg")     - 模拟党组织管理员登录');
console.log('  roleDebug.simulateLogin("user")         - 模拟用户登录');
console.log('  roleDebug.testRoleSwitch("user", "admin") - 测试角色切换');
console.log('  roleDebug.monitorCookieChanges()        - 监控 Cookie 变化');
console.log('  roleDebug.checkMiddleware()             - 检查中间件');
console.log('\n执行当前状态检查...\n');

// 自动执行检查
checkCurrentState();

console.log('=== 调试建议 ===');
console.log('1. 退出登录前运行: roleDebug.checkCurrentState()');
console.log('2. 退出登录后运行: roleDebug.checkCurrentState()');
console.log('3. 新登录前运行: roleDebug.checkCurrentState()');
console.log('4. 新登录后运行: roleDebug.checkCurrentState()');
console.log('5. 如果发现 Cookie 未清除，运行: roleDebug.clearAllState()');
console.log('');
