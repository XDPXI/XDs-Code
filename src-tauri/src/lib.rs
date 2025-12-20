use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryContents {
    entries: Vec<FileEntry>,
    current_path: String,
}

// State to track current working directory
pub struct AppState {
    current_dir: Mutex<Option<PathBuf>>,
}

#[tauri::command]
fn read_directory(path: String, state: State<AppState>) -> Result<DirectoryContents, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Update current directory in state
    *state.current_dir.lock().unwrap() = Some(dir_path.to_path_buf());

    let mut entries = Vec::new();

    match fs::read_dir(dir_path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    let metadata = entry.metadata().ok();

                    let file_entry = FileEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        is_directory: path.is_dir(),
                        size: metadata.map(|m| m.len()).unwrap_or(0),
                    };

                    entries.push(file_entry);
                }
            }

            // Sort: directories first, then files
            entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });

            Ok(DirectoryContents {
                entries,
                current_path: path.clone(),
            })
        }
        Err(e) => Err(format!("Failed to read directory: {}", e)),
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Check file size (limit to 10MB for safety)
    if let Ok(metadata) = fs::metadata(file_path) {
        if metadata.len() > 10 * 1024 * 1024 {
            return Err("File too large (>10MB)".to_string());
        }
    }

    match fs::read_to_string(file_path) {
        Ok(contents) => Ok(contents),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }

    match fs::write(file_path, content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    match fs::write(file_path, "") {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create file: {}", e)),
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if file_path.is_dir() {
        match fs::remove_dir_all(file_path) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete directory: {}", e)),
        }
    } else {
        match fs::remove_file(file_path) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete file: {}", e)),
        }
    }
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_file_path = Path::new(&old_path);
    let new_file_path = Path::new(&new_path);

    if !old_file_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    if new_file_path.exists() {
        return Err("Destination file already exists".to_string());
    }

    match fs::rename(old_file_path, new_file_path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to rename file: {}", e)),
    }
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    let dir_path = Path::new(&path);

    if dir_path.exists() {
        return Err("Directory already exists".to_string());
    }

    match fs::create_dir_all(dir_path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create directory: {}", e)),
    }
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileEntry, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    match fs::metadata(file_path) {
        Ok(metadata) => Ok(FileEntry {
            name: file_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            path: path.clone(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        }),
        Err(e) => Err(format!("Failed to get file metadata: {}", e)),
    }
}

#[tauri::command]
fn is_binary_file(path: String) -> Result<bool, String> {
    let file_path = Path::new(&path);

    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Read first 512 bytes to check for binary content
    match fs::read(file_path) {
        Ok(bytes) => {
            let sample_size = std::cmp::min(512, bytes.len());
            let sample = &bytes[..sample_size];

            // Check for null bytes or high proportion of non-printable characters
            let has_null = sample.contains(&0);
            if has_null {
                return Ok(true);
            }

            let non_printable = sample
                .iter()
                .filter(|&&b| b < 7 || (b > 13 && b < 32))
                .count();

            Ok(non_printable as f32 / sample_size as f32 > 0.3)
        }
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
fn open_in_file_manager(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("Path does not exist".to_string());
    }

    let dir_to_open = if file_path.is_file() {
        file_path.parent().unwrap_or(file_path)
    } else {
        file_path
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(dir_to_open)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(dir_to_open)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(dir_to_open)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn run_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to run file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to run file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to run file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn execute_terminal_command(
    app: AppHandle,
    command: String,
    cwd: Option<String>,
) -> Result<(), String> {
    let working_dir = cwd.unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .to_string()
    });

    #[cfg(target_os = "windows")]
    let mut child = Command::new("pwsh")
        .arg("-Command")
        .arg(&command)
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    #[cfg(target_os = "macos")]
    let mut child = Command::new("zsh")
        .arg("-c")
        .arg(&command)
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    #[cfg(target_os = "linux")]
    let mut child = Command::new("bash")
        .arg("-c")
        .arg(&command)
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let app_finish = app.clone();

    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_stdout.emit("terminal-output", line);
        }
    });

    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_stderr.emit("terminal-error", line);
        }
    });

    thread::spawn(move || {
        let _ = child.wait();
        let _ = app_finish.emit("command-finished", "");
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            current_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            create_file,
            delete_file,
            rename_file,
            create_directory,
            get_file_metadata,
            is_binary_file,
            open_in_file_manager,
            run_file,
            execute_terminal_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
