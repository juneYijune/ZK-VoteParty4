export function AppLayout({ title, children }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ padding: 16, borderBottom: "1px solid #eee" }}>
        <strong>{title}</strong>
      </header>
      <main style={{ padding: 16 }}>{children}</main>
    </div>
  );
}
