use std::{process, thread, time::Duration};

const EXPECTED_STEPS: usize = 5;

#[derive(serde::Deserialize)]
struct Step {
  ok: bool,
}

#[derive(serde::Deserialize)]
struct Report {
  steps: Vec<Step>,
}

#[tauri::command]
fn smoke_report(app: tauri::AppHandle, report: String) {
  println!("SMOKE {report}");
  let passed = serde_json::from_str::<Report>(&report)
    .is_ok_and(|parsed| parsed.steps.len() == EXPECTED_STEPS && parsed.steps.iter().all(|step| step.ok));
  app.exit(if passed { 0 } else { 1 });
}

pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![smoke_report])
    .setup(|_app| {
      // A page that never loads reports nothing: the watchdog turns that silence into a verdict.
      thread::spawn(|| {
        thread::sleep(Duration::from_secs(120));
        eprintln!("SMOKE no report after 120 s");
        process::exit(2);
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
