use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub name: String,
    pub is_image: bool,
    pub tags: Vec<String>,
}

