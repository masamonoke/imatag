use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub is_image: bool,
    pub tags: Vec<String>,
}

