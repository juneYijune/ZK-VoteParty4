import { NextResponse } from 'next/server';

// 定义路由角色映射
const ROUTE_ROLES = {
  '/admin': ['SYSTEM_ADMIN'],
  '/partyorg': ['PARTY_ORG_ADMIN'],
  '/user': ['USER', 'PARTY_ORG_ADMIN'], // 党组织管理员也可以访问用户页面
};

// 公开路由（不需要登录）
const PUBLIC_ROUTES = ['/login', '/'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // 检查是否是公开路由
  if (PUBLIC_ROUTES.some(route => pathname === route)) {
    return NextResponse.next();
  }

  // 从 cookie 获取用户信息
  const userCookie = request.cookies.get('user');
  let user = null;
  
  try {
    user = userCookie ? JSON.parse(userCookie.value) : null;
  } catch (e) {
    console.error('Failed to parse user cookie:', e);
    // Cookie 解析失败，清除它
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('user');
    return response;
  }

  // 未登录，重定向到登录页
  if (!user || !user.address) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 检查角色权限
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(user.role)) {
        // 角色不匹配，重定向到登录页
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(loginUrl);
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
