use base64::{Engine, engine::general_purpose::STANDARD};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, env, fs, path::Path};

// Tauri allows the inline scripts of a page by hashing them into that page's own policy. The site's client router
// swaps pages without a reload, so the scripts of the next page must already be allowed by the first: every page gets
// the hashes of the whole site, and Tauri's per-page edit stays off. Its style hashes would also silence the
// 'unsafe-inline' that the site's style attributes need.
fn main() {
  let dist = Path::new(&env::var("CARGO_MANIFEST_DIR").unwrap()).join("../../web/dist");
  println!("cargo:rerun-if-changed={}", dist.display());
  let mut hashes = BTreeSet::new();
  collect_script_hashes(&dist, &mut hashes);
  let script_hashes = hashes.into_iter().map(|hash| format!(" '{hash}'")).collect::<String>();
  let csp = format!(
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'{script_hashes}; connect-src 'self' ipc: http://ipc.localhost; worker-src 'self' blob:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'"
  );
  let mut config: serde_json::Value = env::var("TAURI_CONFIG")
    .ok()
    .and_then(|json| serde_json::from_str(&json).ok())
    .unwrap_or_default();
  config["app"]["security"]["csp"] = csp.into();
  config["app"]["security"]["dangerousDisableAssetCspModification"] = true.into();
  println!("cargo:rustc-env=TAURI_CONFIG={config}");
  tauri_build::build()
}

fn collect_script_hashes(dir: &Path, hashes: &mut BTreeSet<String>) {
  let Ok(entries) = fs::read_dir(dir) else { return };
  for path in entries.flatten().map(|entry| entry.path()) {
    if path.is_dir() {
      collect_script_hashes(&path, hashes);
    } else if path.extension().is_some_and(|extension| extension == "html") {
      let html = fs::read_to_string(&path).unwrap();
      for script in inline_scripts(&html) {
        hashes.insert(format!("sha256-{}", STANDARD.encode(Sha256::digest(script.replace("\r\n", "\n")))));
      }
    }
  }
}

fn inline_scripts(html: &str) -> Vec<&str> {
  let mut scripts = Vec::new();
  let mut rest = html;
  while let Some(start) = rest.find("<script") {
    let tag = &rest[start..];
    let Some(attributes_end) = tag.find('>') else { break };
    let (attributes, body) = (&tag[..attributes_end], &tag[attributes_end + 1..]);
    let Some(close) = body.find("</script>") else { break };
    if !attributes.contains(" src=") && !attributes.contains("ld+json") {
      scripts.push(&body[..close]);
    }
    rest = &body[close..];
  }
  scripts
}
