use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::{Arc, Mutex, OnceLock};
use std::io::Write;

struct PtyState {
    writer: Option<Box<dyn Write + Send>>,
}

fn pty_state() -> &'static Arc<Mutex<PtyState>> {
    static STATE: OnceLock<Arc<Mutex<PtyState>>> = OnceLock::new();
    STATE.get_or_init(|| {
        Arc::new(Mutex::new(PtyState { writer: None }))
    })
}

#[tauri::command]
pub async fn spawn_pty() -> Result<String, String> {
    let pty_system = native_pty_system();
    
    // Choose shell based on OS
    let shell = if cfg!(target_os = "windows") { "powershell.exe" } else { "bash" };

    let pair = pty_system.open_pty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let cmd = CommandBuilder::new(shell);
    let mut _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    
    let state = pty_state();
    let mut state = state.lock().unwrap();
    state.writer = Some(writer);

    Ok("PTY spawned successfully".to_string())
}

#[tauri::command]
pub async fn write_to_pty(data: String) -> Result<(), String> {
    let state = pty_state();
    let mut state = state.lock().unwrap();
    if let Some(ref mut writer) = state.writer {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("PTY not spawned yet".to_string())
    }
}
