use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
pub async fn read_dir_recursive(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut result = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            let file_path = entry.path();
            let is_dir = file_path.is_dir();
            let name = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            let path_str = file_path.to_string_lossy().into_owned();

            result.push(FileEntry {
                name,
                path: path_str,
                is_dir,
            });
        }
    }

    // Sort: directories first, then alphabetically
    result.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(result)
}
