use std::{
  env, process,
  sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
  },
  thread,
  time::Duration,
};
use tauri::{
  AppHandle, Emitter, Manager, RunEvent, Runtime, Url, WebviewUrl, WebviewWindowBuilder,
  menu::{AboutMetadata, Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
  webview::NewWindowResponse,
};
use tauri_plugin_opener::OpenerExt;

const EXPECTED_STEPS: usize = 5;
const APP_PROBE: &str = include_str!("../../smoke/app-probe.js");
/// What the probe must see, screen by screen: the monastery, Compress opened by its card, the monastery again.
const APP_PAGES: [&str; 3] = ["home", "tool", "home"];
static VERDICT: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Copy, PartialEq)]
enum Smoke {
  Engine,
  App,
}

#[derive(serde::Deserialize)]
struct Step {
  ok: bool,
}

#[derive(serde::Deserialize)]
struct Report {
  steps: Vec<Step>,
}

#[derive(serde::Deserialize)]
struct PageReport {
  page: String,
  title: String,
  errors: Vec<String>,
}

struct Probe {
  pages: Vec<String>,
  reported: Mutex<usize>,
}

struct Labels {
  about: &'static str,
  services: &'static str,
  hide: &'static str,
  hide_others: &'static str,
  show_all: &'static str,
  quit: &'static str,
  file: &'static str,
  open: &'static str,
  close: &'static str,
  edit: &'static str,
  undo: &'static str,
  redo: &'static str,
  cut: &'static str,
  copy: &'static str,
  paste: &'static str,
  select_all: &'static str,
  window: &'static str,
  minimize: &'static str,
  help: &'static str,
  site: &'static str,
  source: &'static str,
  faq: &'static str,
}

const FR: Labels = Labels {
  about: "À propos de Holy PDF",
  services: "Services",
  hide: "Masquer Holy PDF",
  hide_others: "Masquer les autres",
  show_all: "Tout afficher",
  quit: "Quitter Holy PDF",
  file: "Fichier",
  open: "Ouvrir…",
  close: "Fermer",
  edit: "Édition",
  undo: "Annuler",
  redo: "Rétablir",
  cut: "Couper",
  copy: "Copier",
  paste: "Coller",
  select_all: "Tout sélectionner",
  window: "Fenêtre",
  minimize: "Réduire",
  help: "Aide",
  site: "Site",
  source: "Code source",
  faq: "Questions fréquentes",
};

const EN: Labels = Labels {
  about: "About Holy PDF",
  services: "Services",
  hide: "Hide Holy PDF",
  hide_others: "Hide Others",
  show_all: "Show All",
  quit: "Quit Holy PDF",
  file: "File",
  open: "Open…",
  close: "Close",
  edit: "Edit",
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  select_all: "Select All",
  window: "Window",
  minimize: "Minimize",
  help: "Help",
  site: "Website",
  source: "Source code",
  faq: "FAQ",
};

fn verdict(app: &AppHandle, code: i32) {
  VERDICT.store(true, Ordering::Relaxed);
  app.exit(code);
}

#[tauri::command]
fn smoke_report(app: AppHandle, report: String) {
  println!("SMOKE {report}");
  let passed = app.try_state::<Probe>().is_none()
    && serde_json::from_str::<Report>(&report)
      .is_ok_and(|parsed| parsed.steps.len() == EXPECTED_STEPS && parsed.steps.iter().all(|step| step.ok));
  verdict(&app, if passed { 0 } else { 1 });
}

#[tauri::command]
fn smoke_page(app: AppHandle, report: String) {
  println!("SMOKE {report}");
  let Some(probe) = app.try_state::<Probe>() else { return verdict(&app, 1) };
  let mut reported = probe.reported.lock().unwrap();
  // A missing page is served as an error text: it loads, has no title, and reports no error.
  let passed = serde_json::from_str::<PageReport>(&report).is_ok_and(|parsed| {
    probe.pages.get(*reported) == Some(&parsed.page) && !parsed.title.is_empty() && parsed.errors.is_empty()
  });
  *reported += 1;
  if !passed {
    verdict(&app, 1);
  } else if *reported == probe.pages.len() {
    verdict(&app, 0);
  }
}

fn menu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Menu<R>> {
  let about = AboutMetadata { name: Some("Holy PDF".into()), ..Default::default() };
  let mut app_menu = SubmenuBuilder::new(app, "Holy PDF")
    .item(&PredefinedMenuItem::about(app, Some(l.about), Some(about))?)
    .item(&PredefinedMenuItem::separator(app)?);
  #[cfg(target_os = "macos")]
  {
    app_menu = app_menu
      .item(&PredefinedMenuItem::services(app, Some(l.services))?)
      .item(&PredefinedMenuItem::separator(app)?)
      .item(&PredefinedMenuItem::hide(app, Some(l.hide))?)
      .item(&PredefinedMenuItem::hide_others(app, Some(l.hide_others))?)
      .item(&PredefinedMenuItem::show_all(app, Some(l.show_all))?)
      .item(&PredefinedMenuItem::separator(app)?);
  }
  let app_menu = app_menu.item(&MenuItemBuilder::with_id("quit", l.quit).accelerator("CmdOrCtrl+Q").build(app)?).build()?;
  let file = SubmenuBuilder::new(app, l.file)
    .item(&MenuItemBuilder::with_id("open", l.open).accelerator("CmdOrCtrl+O").build(app)?)
    .item(&MenuItemBuilder::with_id("close", l.close).accelerator("CmdOrCtrl+W").build(app)?)
    .build()?;
  let edit = SubmenuBuilder::new(app, l.edit)
    .item(&MenuItemBuilder::with_id("undo", l.undo).accelerator("CmdOrCtrl+Z").build(app)?)
    .item(&MenuItemBuilder::with_id("redo", l.redo).accelerator("CmdOrCtrl+Shift+Z").build(app)?)
    .item(&PredefinedMenuItem::separator(app)?)
    .item(&PredefinedMenuItem::cut(app, Some(l.cut))?)
    .item(&PredefinedMenuItem::copy(app, Some(l.copy))?)
    .item(&PredefinedMenuItem::paste(app, Some(l.paste))?)
    .item(&PredefinedMenuItem::select_all(app, Some(l.select_all))?)
    .build()?;
  let window = SubmenuBuilder::new(app, l.window).item(&PredefinedMenuItem::minimize(app, Some(l.minimize))?).build()?;
  let help = SubmenuBuilder::new(app, l.help)
    .item(&MenuItemBuilder::with_id("site", l.site).build(app)?)
    .item(&MenuItemBuilder::with_id("source", l.source).build(app)?)
    .item(&MenuItemBuilder::with_id("faq", l.faq).build(app)?)
    .build()?;
  Menu::with_items(app, &[&app_menu, &file, &edit, &window, &help])
}

fn is_app(url: &Url) -> bool {
  url.scheme() == "tauri"
    || url.host_str() == Some("tauri.localhost")
    || (tauri::is_dev() && url.host_str() == Some("localhost") && url.port() == Some(1420))
}

/// A link to the outside opens in the browser; any other scheme, a dropped `file://` for one, goes nowhere.
fn leave<R: Runtime>(app: &AppHandle<R>, url: &str) {
  if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:") {
    let _ = app.opener().open_url(url, None::<&str>);
  }
}

pub fn run() {
  let mut args = env::args().skip(1);
  let smoke = (args.next().as_deref() == Some("--smoke")).then(|| if args.next().as_deref() == Some("app") { Smoke::App } else { Smoke::Engine });
  let locale = sys_locale::get_locale().unwrap_or_default();
  let french = locale.to_lowercase().starts_with("fr");
  let init = format!("window.__HOLY__ = {{ lang: {}, os: {} }};", serde_json::to_string(&locale).unwrap(), serde_json::to_string(env::consts::OS).unwrap());
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .menu(move |app| menu(app, if french { &FR } else { &EN }))
    .on_menu_event(move |app, event| match event.id().as_ref() {
      "site" => leave(app, "https://holy-pdf.com"),
      "source" => leave(app, "https://github.com/Snouzy/holy-pdf"),
      "faq" => leave(app, if french { "https://holy-pdf.com/fr/faq" } else { "https://holy-pdf.com/en/faq" }),
      // Through Rust until lot 2 adds the unsaved-result guard, which the page must ask first.
      "quit" => app.exit(0),
      "close" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.close();
        }
      }
      id => {
        let _ = app.emit("menu", id);
      }
    });
  if smoke.is_some() {
    builder = builder.invoke_handler(tauri::generate_handler![smoke_report, smoke_page]);
  }
  builder
    .setup(move |app| {
      let navigating = app.handle().clone();
      let opening = app.handle().clone();
      let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Holy PDF")
        .inner_size(1280.0, 840.0)
        .min_inner_size(1024.0, 680.0)
        .initialization_script(init)
        .disable_drag_drop_handler()
        .on_navigation(move |url| {
          if is_app(url) {
            return true;
          }
          leave(&navigating, url.as_str());
          false
        })
        .on_new_window(move |url, _| {
          leave(&opening, url.as_str());
          NewWindowResponse::Deny
        });
      #[cfg(target_os = "macos")]
      {
        window = window.title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true).traffic_light_position(tauri::LogicalPosition::new(16.0, 18.0));
      }
      let Some(mode) = smoke else {
        window.build()?;
        return Ok(());
      };
      // A page that never loads reports nothing: the watchdog turns that silence into a verdict.
      thread::spawn(|| {
        thread::sleep(Duration::from_secs(120));
        eprintln!("SMOKE no verdict after 120 s");
        process::exit(2);
      });
      if mode == Smoke::App {
        window = window.initialization_script(format!("({APP_PROBE})()"));
        app.manage(Probe { pages: APP_PAGES.map(String::from).to_vec(), reported: Mutex::new(0) });
      }
      window.build()?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(move |_, event| {
      // The close button and Cmd+Q end the loop with 0: in smoke mode only a verdict may.
      if smoke.is_some() && matches!(event, RunEvent::Exit) && !VERDICT.load(Ordering::Relaxed) {
        eprintln!("SMOKE closed before the verdict");
        process::exit(3);
      }
    });
}
