() => {
  const errors = [];
  const screen = () => (document.querySelector(".tool-screen") ? "tool" : "home");
  addEventListener("securitypolicyviolation", (event) => errors.push(`csp ${event.violatedDirective} ${event.blockedURI}`));
  addEventListener("error", (event) => errors.push(`error ${event.message ?? event.target?.src ?? event.target?.href}`), true);
  addEventListener("unhandledrejection", (event) => errors.push(`rejection ${event.reason}`));
  const moves = [() => document.querySelector('[data-tool="compress"]')?.click(), () => document.querySelector(".back")?.click()];
  let index = 0;
  const report = async () => {
    const payload = JSON.stringify({ page: screen(), title: document.title, errors: errors.splice(0) });
    await window.__TAURI_INTERNALS__.invoke("smoke_page", { report: payload });
    const move = moves[index++];
    if (!move) return;
    move();
    setTimeout(report, 2000);
  };
  addEventListener("load", () => setTimeout(report, 2000));
}
