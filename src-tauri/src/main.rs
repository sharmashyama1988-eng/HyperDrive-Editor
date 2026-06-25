// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_dir_recursive,
            commands::pty::spawn_pty,
            commands::pty::write_to_pty,
            commands::git::git_diff_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
