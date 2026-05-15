import { redirect } from "next/navigation";

export default function Home() {
  // 中文说明：系统入口页，默认跳转到登录页
  redirect("/login");
}
