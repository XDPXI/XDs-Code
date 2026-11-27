use serde::{Deserialize, Serialize};
use std::fs;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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

#[derive(Clone)]
pub struct AppState {
    current_dir: std::sync::Arc<Mutex<Option<PathBuf>>>,
    pty: std::sync::Arc<Mutex<Option<PtySession>>>,
    pty_gen: std::sync::Arc<AtomicU64>,
}

pub struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

fn default_theme() -> String {
    "one-dark".to_string()
}

fn default_sidebar_design() -> String {
    "modern".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub editor_font_size: i32,
    pub editor_word_wrap: bool,
    pub editor_minimap: bool,
    pub editor_line_numbers: bool,
    pub editor_render_whitespace: bool,
    pub terminal_font_size: i32,
    pub sidebar_width: i32,
    pub auto_save_enabled: bool,
    pub auto_save_interval: i32,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_sidebar_design")]
    pub sidebar_design: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum GitFileStatus {
    #[serde(rename = "untracked")]
    Untracked,
    #[serde(rename = "modified")]
    Modified,
    #[serde(rename = "staged")]
    Staged,
    #[serde(rename = "unmodified")]
    Unmodified,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitFileInfo {
    pub path: String,
    pub status: GitFileStatus,
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

    *state.current_dir.lock().unwrap() = Some(dir_path.to_path_buf());

    let mut entries: Vec<FileEntry> = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| {
            entry.ok().map(|e| {
                let path = e.path();
                FileEntry {
                    name: e.file_name().to_string_lossy().into_owned(),
                    path: path.to_string_lossy().into_owned(),
                    is_directory: path.is_dir(),
                    size: e.metadata().ok().map(|m| m.len()).unwrap_or(0),
                }
            })
        })
        .collect();

    // Sort: directories first, then files
    entries.sort_unstable_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(DirectoryContents {
        entries,
        current_path: path,
    })
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

    const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB
    if let Ok(metadata) = fs::metadata(file_path) {
        if metadata.len() > MAX_FILE_SIZE {
            return Err("File too large (>10MB)".to_string());
        }
    }

    fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }

    fs::write(file_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    fs::write(file_path, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    if file_path.is_dir() {
        fs::remove_dir_all(file_path)
    } else {
        fs::remove_file(file_path)
    }
    .map_err(|e| format!("Failed to delete: {}", e))
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

    fs::rename(old_file_path, new_file_path).map_err(|e| format!("Failed to rename file: {}", e))
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    let dir_path = Path::new(&path);

    if dir_path.exists() {
        return Err("Directory already exists".to_string());
    }

    fs::create_dir_all(dir_path).map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileEntry, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata =
        fs::metadata(file_path).map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(FileEntry {
        name: file_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path,
        is_directory: metadata.is_dir(),
        size: metadata.len(),
    })
}

#[tauri::command]
fn is_binary_file(path: String) -> Result<bool, String> {
    let file_path = Path::new(&path);

    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    const SAMPLE_SIZE: usize = 512;
    let bytes = fs::read(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let sample_size = std::cmp::min(SAMPLE_SIZE, bytes.len());
    let sample = &bytes[..sample_size];

    // Check for null bytes
    if sample.contains(&0) {
        return Ok(true);
    }

    // Check proportion of non-printable characters
    let non_printable = sample
        .iter()
        .filter(|&&b| b < 7 || (b > 13 && b < 32))
        .count();

    Ok((non_printable as f32 / sample_size as f32) > 0.3)
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
    Command::new("explorer")
        .arg(dir_to_open)
        .spawn()
        .map_err(|e| format!("Failed to open file manager: {}", e))?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(dir_to_open)
        .spawn()
        .map_err(|e| format!("Failed to open file manager: {}", e))?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(dir_to_open)
        .spawn()
        .map_err(|e| format!("Failed to open file manager: {}", e))?;

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
    Command::new("cmd")
        .args(&["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("Failed to run file: {}", e))?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(file_path)
        .spawn()
        .map_err(|e| format!("Failed to run file: {}", e))?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(file_path)
        .spawn()
        .map_err(|e| format!("Failed to run file: {}", e))?;

    Ok(())
}

fn spawn_shell_session(
    app: AppHandle,
    session_gen: std::sync::Arc<AtomicU64>,
    cwd: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<PtySession, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = CommandBuilder::new("powershell.exe");
        c.arg("-NoLogo");
        c
    };
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                if cfg!(target_os = "macos") {
                    "/bin/zsh".to_string()
                } else {
                    "/bin/bash".to_string()
                }
            });
        CommandBuilder::new(shell)
    };

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let dir = cwd
        .filter(|d| !d.is_empty() && Path::new(d).is_dir())
        .map(PathBuf::from)
        .or_else(dirs::home_dir)
        .or_else(|| std::env::current_dir().ok());
    if let Some(d) = dir {
        cmd.cwd(d);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to read PTY: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to write PTY: {}", e))?;

    let my_gen = session_gen.fetch_add(1, Ordering::SeqCst) + 1;
    thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    // Emit the longest valid UTF-8 prefix; keep a split tail for the next read.
                    let valid = match std::str::from_utf8(&pending) {
                        Ok(_) => pending.len(),
                        Err(e) if e.error_len().is_none() => e.valid_up_to(),
                        Err(_) => pending.len(),
                    };
                    let chunk: Vec<u8> = pending.drain(..valid).collect();
                    if !chunk.is_empty() {
                        let _ = app.emit(
                            "terminal-data",
                            String::from_utf8_lossy(&chunk).into_owned(),
                        );
                    }
                }
            }
        }
        // Only report exit when this is still the current session.
        if session_gen.load(Ordering::SeqCst) == my_gen {
            let _ = app.emit("terminal-exit", ());
        }
    });

    Ok(PtySession {
        master: pair.master,
        writer,
        child,
    })
}

fn kill_session(session: Option<PtySession>) {
    if let Some(mut s) = session {
        let _ = s.child.kill();
        // Dropping master closes the PTY and ends attached processes.
        drop(s.writer);
        drop(s.master);
    }
}

#[tauri::command]
fn init_terminal_shell(
    app: AppHandle,
    state: State<AppState>,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    // Hold the lock for the whole swap so concurrent init/stop calls cannot interleave.
    let mut guard = state.pty.lock().unwrap();
    // Bump generation first so the old reader does not emit "terminal-exit".
    state.pty_gen.fetch_add(1, Ordering::SeqCst);
    kill_session(guard.take());
    let session = spawn_shell_session(
        app,
        state.pty_gen.clone(),
        cwd,
        rows.unwrap_or(24),
        cols.unwrap_or(80),
    )?;
    *guard = Some(session);
    Ok(())
}

#[tauri::command]
fn write_terminal(data: String, state: State<AppState>) -> Result<(), String> {
    let mut guard = state.pty.lock().unwrap();
    match guard.as_mut() {
        Some(s) => {
            s.writer
                .write_all(data.as_bytes())
                .and_then(|_| s.writer.flush())
                .map_err(|e| format!("Failed to write to shell: {}", e))
        }
        None => Err("Shell not initialized".to_string()),
    }
}

#[tauri::command]
fn resize_terminal(rows: u16, cols: u16, state: State<AppState>) -> Result<(), String> {
    let guard = state.pty.lock().unwrap();
    if let Some(s) = guard.as_ref() {
        s.master
            .resize(PtySize {
                rows: rows.max(2),
                cols: cols.max(2),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn stop_terminal_command(state: State<AppState>) -> Result<(), String> {
    let mut guard = state.pty.lock().unwrap();
    state.pty_gen.fetch_add(1, Ordering::SeqCst);
    kill_session(guard.take());
    Ok(())
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            editor_font_size: 14,
            editor_word_wrap: true,
            editor_minimap: false,
            editor_line_numbers: true,
            editor_render_whitespace: false,
            terminal_font_size: 13,
            sidebar_width: 240,
            auto_save_enabled: false,
            auto_save_interval: 5000,
            theme: "one-dark".to_string(),
            sidebar_design: "modern".to_string(),
        }
    }
}

fn get_settings_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or("Could not find config directory")?;
    let app_config = config_dir.join("xds-code");

    if !app_config.exists() {
        std::fs::create_dir_all(&app_config)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(app_config.join("settings.json"))
}

#[tauri::command]
fn load_settings() -> Result<AppSettings, String> {
    let settings_path = get_settings_path()?;

    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path()?;
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&settings_path, json).map_err(|e| format!("Failed to write settings: {}", e))
}

fn git_exe() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "git.exe"
    }

    #[cfg(not(target_os = "windows"))]
    {
        "git"
    }
}

#[tauri::command]
fn get_git_status(repo_path: String) -> Result<Vec<GitFileInfo>, String> {
    let git_dir = std::path::Path::new(&repo_path).join(".git");
    if !git_dir.exists() {
        return Ok(Vec::new());
    }

    let mut cmd = Command::new(git_exe());
    cmd.arg("status")
        .arg("--porcelain")
        .current_dir(&repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git command: {}", e))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let status_output = String::from_utf8_lossy(&output.stdout);
    let mut git_files = Vec::new();

    for line in status_output.lines() {
        if line.is_empty() {
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let status_code = &line[0..2];
        let file_path = line[3..].trim().to_string();

        let status = match status_code {
            "??" => GitFileStatus::Untracked,
            " M" | "M " | "MM" => GitFileStatus::Modified,
            "A " | "AM" | "A" => GitFileStatus::Staged,
            _ => GitFileStatus::Modified,
        };

        git_files.push(GitFileInfo {
            path: file_path,
            status,
        });
    }

    Ok(git_files)
}

#[tauri::command]
fn is_git_repository(path: String) -> Result<bool, String> {
    let git_dir = std::path::Path::new(&path).join(".git");
    Ok(git_dir.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            current_dir: std::sync::Arc::new(Mutex::new(None)),
            pty: std::sync::Arc::new(Mutex::new(None)),
            pty_gen: std::sync::Arc::new(AtomicU64::new(0)),
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
            init_terminal_shell,
            write_terminal,
            resize_terminal,
            stop_terminal_command,
            load_settings,
            save_settings,
            get_git_status,
            is_git_repository,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
