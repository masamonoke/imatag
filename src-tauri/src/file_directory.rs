use std::fs::{self, OpenOptions, File};
use std::path::Path;
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::env;
use crate::FileInfo;
use base64::encode;
use std::io::BufReader;

pub struct Directory {
    config: Vec<FileInfo>,
    path: String
}

impl Directory {
    fn new(path: String) -> Directory {
        let config_path = path.clone() + "/config.json";

        if Path::new(config_path.as_str()).exists() {
            let file = File::open(config_path.as_str());

            if file.is_err() {
                panic!("Failed to open config at {}: {}", config_path, file.err().unwrap())
            }
            let file = file.unwrap();
            let reader = BufReader::new(file);
            let config = serde_json::from_reader(reader).unwrap();
            return Directory { config, path };
        } else {
            return Directory { config: vec![], path };
        }
    }

    pub fn save_file(&self) -> Result<(), std::io::Error> {
        let config_path = self.path.clone() + "/config.json";

        let file = OpenOptions::new()
            .write(true)
            .truncate(true)
            .create(true)
            .open(config_path.as_str())?;

        match serde_json::to_writer(file, &self.config) {
            Ok(_) => {},
            Err(e) => panic!("Failed to save config: {}", e)
        }
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

        self.config.retain(|item| files.contains(&item.name));

        for file in files {
            if self.config.iter().filter(|item| item.name == file).count() == 0 {
                let is_img = file.ends_with(".png") | file.ends_with(".jpg") | file.ends_with(".jpeg");
                self.config.push(FileInfo { name: file.to_string(), is_image: is_img, tags: vec![] });
            }
        }

        let mut file_infos: Vec<FileInfo> = Vec::new();
        self.config.iter().for_each(|val| file_infos.push(FileInfo { name: val.name.clone(), is_image: val.is_image, tags: val.tags.clone() }));
        file_infos
    }

    pub fn update_tags(&mut self, tags: Vec<String>, filename: String) {
        for entry in &mut self.config {
            if entry.name == filename {
                entry.tags = tags;
                return;
            }
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

pub fn get_image_base64(name: String) -> Result<String, String> {
    let image_path = get_directory().path.clone() + "/" + name.as_str();
    let image_data = fs::read(image_path).map_err(|e| e.to_string())?;
    let base64_encoded = encode(&image_data);

    Ok(format!("data:image/jpeg;base64,{}", base64_encoded))
}
