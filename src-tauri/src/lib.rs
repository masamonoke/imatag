use tauri::generate_handler;
use crate::file_info::FileInfo;
use crate::file_directory::{get_directory, get_image_base64};

mod file_info;
mod file_directory;

#[tauri::command]
fn get_files() -> Vec<FileInfo> {
    get_directory().get_file_infos()
}

#[tauri::command]
fn open_file(filename: String) -> String {
    match get_image_base64(filename.clone()) {
        Ok(base64_string) => {
            return base64_string
        },
        Err(e) => eprintln!("Failed to open {}: {}", filename, e)
    };

    return String::from("");
}

#[tauri::command]
fn update_tags(filename: String, tags: Vec<String>) {
    let _ = &get_directory().update_tags(tags, filename);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .on_window_event(|_, event| {
            if let tauri::WindowEvent::CloseRequested {  .. } = event {
                match get_directory().save_file() {
                    Ok(_) => {},
                    Err(e) => eprintln!("Failed to save tags data: {}", e)
                }
            }
        })
        .invoke_handler(generate_handler![get_files, open_file, update_tags])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
