// Leaving through the page's own link runs the site's client router under the policy of the first page: that is what
// the site-wide hashes of build.rs are for.
(pages) => {
  // Behind other windows the document is hidden, WebKit then skips view transitions and the router leaves a rejected
  // promise. Without the API the router still fetches, swaps and runs the next page's scripts.
  document.startViewTransition = undefined;
  const errors = [];
  let via = "load";
  addEventListener("securitypolicyviolation", (event) => errors.push(`csp ${event.violatedDirective} ${event.blockedURI}`));
  addEventListener("error", (event) => errors.push(`error ${event.message ?? event.target?.src ?? event.target?.href}`), true);
  addEventListener("unhandledrejection", (event) => errors.push(`rejection ${event.reason}`));
  const report = async () => {
    const page = location.pathname.slice(1);
    const report = JSON.stringify({ page, via, title: document.title, errors: errors.splice(0) });
    await window.__TAURI_INTERNALS__.invoke("smoke_page", { report });
    const next = pages[pages.indexOf(page) + 1];
    if (!next) return;
    const link = document.querySelector(`a[href="/${next}"]`);
    if (link) link.click();
    else location.assign(`/${next}`);
  };
  const settle = () => setTimeout(report, 2000);
  addEventListener("load", settle);
  document.addEventListener("astro:after-swap", () => {
    via = "swap";
    settle();
  });
}
