const { invoke } = window.__TAURI__.core;

export async function backendGetFiles(items, globalTags, generateList) {
    console.log("Fetching files...");
    try {
        const files = await invoke('get_files');

        items.length = 0;
        files.forEach(file => {
            items.push({ name: file.name, info: "Details about " + file.name, isImage: file.is_image, tags: file.tags });
        });

        generateList();
		items.forEach(item => {
			item.tags.forEach(tag => globalTags.add(tag));
		});

    } catch (error) {
        console.error("Error fetching files:", error);
    }
}

export async function backendOpenFile(filename) {
	const image = await invoke("open_file", { filename: filename });
	return image;
}

export async function backendUpdateTags(filename, tags) {
	console.log("called")
	await invoke("update_tags", {filename: filename, tags: tags });
}

