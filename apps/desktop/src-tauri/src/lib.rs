use std::{env, process, sync::Mutex, thread, time::Duration};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const EXPECTED_STEPS: usize = 5;
const PROBE: &str = include_str!("../../smoke/probe.js");

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
  errors: Vec<String>,
}

struct Smoke {
  pages: Vec<String>,
  reported: Mutex<usize>,
}

#[tauri::command]
fn smoke_report(app: AppHandle, report: String) {
  println!("SMOKE {report}");
  let passed = serde_json::from_str::<Report>(&report)
    .is_ok_and(|parsed| parsed.steps.len() == EXPECTED_STEPS && parsed.steps.iter().all(|step| step.ok));
  app.exit(if passed { 0 } else { 1 });
}

#[tauri::command]
fn smoke_page(app: AppHandle, report: String) {
  println!("SMOKE {report}");
  let smoke = app.state::<Smoke>();
  let mut reported = smoke.reported.lock().unwrap();
  let passed = serde_json::from_str::<PageReport>(&report)
    .is_ok_and(|parsed| smoke.pages.get(*reported) == Some(&parsed.page) && parsed.errors.is_empty());
  *reported += 1;
  if !passed {
    app.exit(1);
  } else if *reported == smoke.pages.len() {
    app.exit(0);
  }
}

fn home() -> String {
  let french = sys_locale::get_locale().is_some_and(|locale| locale.starts_with("fr"));
  String::from(if french { "fr" } else { "en" })
}

pub fn run() {
  let mut args = env::args().skip(1);
  let smoke = (args.next().as_deref() == Some("--smoke")).then(|| args.collect::<Vec<String>>());
  let smoke_mode = smoke.is_some();
  let start = match &smoke {
    None => home(),
    Some(pages) => pages.first().cloned().unwrap_or_else(|| String::from("index.html")),
  };
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![smoke_report, smoke_page])
    .setup(move |app| {
      let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App(start.into()))
        .title("Holy PDF")
        .inner_size(1200.0, 800.0)
        .min_inner_size(640.0, 480.0);
      let Some(pages) = smoke else {
        window.build()?;
        return Ok(());
      };
      // A page that never loads reports nothing: the watchdog turns that silence into a verdict.
      thread::spawn(|| {
        thread::sleep(Duration::from_secs(120));
        eprintln!("SMOKE no report after 120 s");
        process::exit(2);
      });
      if !pages.is_empty() {
        window = window.initialization_script(format!("({PROBE})({})", serde_json::to_string(&pages)?));
        app.manage(Smoke { pages, reported: Mutex::new(0) });
      }
      window.build()?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(move |_, event| {
      // Closing the window ends the event loop with 0: in smoke mode that would pass for a verdict.
      if smoke_mode && matches!(event, RunEvent::ExitRequested { code: None, .. }) {
        eprintln!("SMOKE window closed before the verdict");
        process::exit(3);
      }
    });
}
