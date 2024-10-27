use std::fs::{self, OpenOptions};
use serde_json::json;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::env;
use crate::FileInfo;
use base64::encode;

pub struct Directory {
    pub config: serde_json::Value,
    pub path: String
}

impl Directory {
    fn new(path: String) -> Directory {
        let config_path = path.clone() + "/config.json";

        if Path::new(config_path.as_str()).exists() {
            let file = File::open(config_path.as_str());

            if file.is_err() {
                panic!("Failed to open config at {}: {}", config_path, file.err().unwrap())
            }
            let mut file = file.unwrap();
            let mut contents = String::new();

            let n = file.read_to_string(&mut contents);
            match n {
                Ok(_) => {
                    let json: serde_json::Value = serde_json::from_str(&contents).unwrap();
                    return Directory { config: json, path };
                },
                Err(e) => panic!("Failed to read config in {}: {}", path, e)
            }
        } else {
            println!("Creating new config.json");

            let mut file = File::create(config_path.as_str()).unwrap();
            let json: serde_json::Value = serde_json::json!([]);

            let n = file.write_all(json.to_string().as_bytes());
            match n {
                Ok(_) => {
                    return Directory { config: json, path };
                },
                Err(e) => panic!("Failed to read config in {}: {}", path, e)
            }
        }

    }

    pub fn save_file(&self) -> Result<(), std::io::Error> {
        let config_path = self.path.clone() + "/config.json";

        let mut file = OpenOptions::new()
            .write(true)
            .open(config_path)?;

        file.write_all(self.config.to_string().as_bytes())?;
        Ok(())
    }

    pub fn get_file_infos(&mut self) -> Vec<FileInfo> {
        let mut files = Vec::new();

        let entries = fs::read_dir(&self.path).unwrap();

        for entry in entries {
            let entry = entry.unwrap();
            let filename = entry.file_name().into_string().unwrap_or_default();

            files.push(filename);
        }

        let mut file_infos: Vec<FileInfo> = Vec::new();
        for file in files {
            let is_img = file.ends_with(".png") | file.ends_with(".jpg") | file.ends_with(".jpeg");
            let data = find_object_by_name(&self.config, &file);
            match data {
                Some(data) => {
                    if let Some(tags_json) = data.get("tags") {
                        if let Some(tags_arr) = tags_json.as_array() {
                            let tags: Vec<String> = tags_arr.iter()
                                .filter_map(|tag| tag.as_str())
                                .map(|opt| opt.to_string())
                                .collect();
                            file_infos.push(FileInfo { name: file.to_string(), is_image: is_img, tags });
                        }
                    }
                },
                None => {
                    file_infos.push(FileInfo { name: file.to_string(), is_image: is_img, tags: vec![] });
                }
            };
        }

        let mut entry_to_remove = vec![];

        if let Some(json_arr) = self.config.as_array_mut() {
            if json_arr.is_empty() {
                for file_info in &file_infos {
                    json_arr.push(json!(file_info));
                }
            } else {
                for entry in json_arr.iter() {
                    let mut found = false;

                    for file_info in &file_infos {
                        if *file_info.name == *entry.get("name").unwrap() {
                            found = true;
                            break;
                        }
                    }

                    if !found {
                        println!("Failed to find {}", entry.get("name").unwrap());
                        entry_to_remove.push(entry.get("name").unwrap().clone());
                    }
                }

                json_arr.retain(|obj| {
                    let name = obj.get("name").unwrap();
                    !entry_to_remove.iter().any(|rm| rm == name)
                });
            }
        } else {
            eprintln!("Failed to write config.json");
        }

        file_infos
    }

    pub fn update_tags(&mut self, tags: Vec<String>, filename: String) {
        if let Some(arr) = self.config.as_array_mut() {
            for img in &mut *arr {
                if img.get("name").and_then(|n| n.as_str()) == Some(filename.as_str()) {
                     if let Some(t) = img.get_mut("tags") {
                        let tags_json = json!(tags);
                        *t = tags_json;
                        return;
                     }
                }
            }

            arr.push(serde_json::to_value(FileInfo { name: filename, is_image: false, tags }).unwrap());
        }
    }

}

static DIRECTORY: Lazy<Mutex<Directory>> = Lazy::new(|| {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        Mutex::new(Directory::new(args[1].clone()))
    } else {
        panic!("No directory passed");
    }
});

pub fn get_directory() -> std::sync::MutexGuard<'static, Directory> {
    DIRECTORY.lock().unwrap()
}

fn find_object_by_name<'a>(json: &'a serde_json::Value, target_name: &'a str) -> Option<&'a serde_json::Value> {
    if let Some(array) = json.as_array() {
        for obj in array {
            if let Some(name) = obj.get("name") {
                if name == target_name {
                    return Some(obj);
                }
            }
        }
    }
    None
}

pub fn get_image_base64(name: String) -> Result<String, String> {
    let image_path = get_directory().path.clone() + "/" + name.as_str();
    let image_data = fs::read(image_path).map_err(|e| e.to_string())?;
    let base64_encoded = encode(&image_data);

    Ok(format!("data:image/jpeg;base64,{}", base64_encoded))
}
