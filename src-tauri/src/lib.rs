// The native shell: a window around the same static build the website serves (VITE_TARGET=shell, see scripts/shell-dist.mjs).
// Every capability a page may use is a plugin listed here AND a permission in capabilities/default.json; a feature that needs
// a new one adds an adapter method in src/platform/ (docs/gallery-shells.md, "adding a capability"), not a change to the shell.
//   store      settings (src/platform/tauri.ts `storage`)
//   fs         offline pictures in the app-local data directory (`files`)
//   http       the download-all pack fetches from world.yahwehword.com, made from Rust so the site needs no CORS header for them
//   os         platform info for the pages (`info`)
//   deep-link  https://world.yahwehword.com/p/<id> and yahwehsworld:// open the picture page
//   opener     links that leave the app (http, https, mailto only: capabilities)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
