import { backendGetFiles, backendOpenFile, backendUpdateTags } from "./tauri.mjs";

const items = [];
let currentItems = []
let selectedIndex = -1;
let searchTags = [];
let highlightedIndex = -1;

const globalTags = new Set();
const itemList = document.getElementById('item-list');
const infoDisplay = document.getElementById('info-display');
const tagsContainer = document.getElementById('tags-container');
const tagInput = document.getElementById('tag-input');
const autocompleteSuggestions = document.getElementById('autocomplete-suggestions');
const searchInput = document.getElementById('search-input');
const searchTagsContainer = document.getElementById('search-tags-container');
const tagSuggestionsPopup = document.getElementById('tag-suggestions');
const checkbox = document.getElementById('filter-untagged');


function updateSelection(index) {
	const selectedItem = itemList.children[index];
	const itemInfo     = selectedItem.getAttribute('data-info');
	const itemTags     = currentItems[index].tags;

	document.getElementById('item-info').textContent = itemInfo;
	infoDisplay.classList.remove('hidden');

	updateTags(itemTags);

	Array.from(itemList.children).forEach(i => i.classList.remove('selected'));
	selectedItem.classList.add('selected');

	selectedItem.scrollIntoView({
		behavior: 'smooth',
		block:    'nearest',
		inline:   'nearest'
	});
}

function updateTags(tags) {
	tagsContainer.innerHTML = '';

	tags.forEach((tag, tagIndex) => {
		const tagElement = document.createElement('div');
		tagElement.classList.add('tag');
		tagElement.innerHTML = `<span>${tag}</span> <button>&times;</button>`;

		tagElement.querySelector('button').addEventListener('click', (e) => {
			e.stopPropagation();
			removeTag(tagIndex);
		});

		tagsContainer.appendChild(tagElement);
	});
}

function removeTag(tagIndex) {
	if (selectedIndex !== -1) {
		currentItems[selectedIndex].tags.splice(tagIndex, 1);
		updateTags(currentItems[selectedIndex].tags);
	}

	generateList()
}

function addTags(newTags) {
	if (selectedIndex !== -1) {
		const currentTags = currentItems[selectedIndex].tags;
		newTags.forEach(tag => {
			if (tag && !currentTags.includes(tag.trim())) {
				currentTags.push(tag.trim());
				globalTags.add(tag.trim());
			}
		});
		updateTags(currentTags);
	}
	tagInput.value = '';

	generateList()

	backendUpdateTags(currentItems[selectedIndex].name, currentItems[selectedIndex].tags)
}

function generateList(filterTags = [], filterUntagged = false) {
    itemList.innerHTML = '';

	currentItems = []
    items.forEach((item, index) => {
		if (filterUntagged) {
			if (item.tags.length != 0) {
				return;
			}
		}

        if (filterTags.length === 0 || filterTags.every(tag => item.tags.includes(tag))) {
            const listItem = document.createElement('li');
            listItem.textContent = item.name;
            listItem.setAttribute('data-info', item.info);
            listItem.setAttribute('is-image', item.isImage);

            if (item.tags && item.tags.length > 0) {
                listItem.classList.add('item-with-tags');
            }

            listItem.addEventListener('click', () => {
                selectedIndex = index;
                updateSelection(selectedIndex);
            });

            itemList.appendChild(listItem);
        }

		currentItems.push(item);
    });

	selectedIndex = -1;
	highlightedIndex = -1;
}

function updateHighlight() {
	const suggestionElements = document.querySelectorAll('.autocomplete-suggestion');
	suggestionElements.forEach((element, index) => {
		element.classList.toggle('highlighted', index === highlightedIndex);
	});

	if (highlightedIndex >= 0) {
		const highlightedElement = suggestionElements[highlightedIndex];
		const container = autocompleteSuggestions;

		const elementTop = highlightedElement.offsetTop;
		const elementBottom = elementTop + highlightedElement.offsetHeight;
		const containerTop = container.scrollTop;
		const containerBottom = containerTop + container.clientHeight;

		if (elementTop < containerTop) {
			container.scrollTop = elementTop;
		} else if (elementBottom > containerBottom) {
			container.scrollTop = elementBottom - container.clientHeight;
		}
	}
}

function addSearchTags(newTags) {
	newTags.forEach(tag => {
		if (!searchTags.includes(tag.trim())) {
			searchTags.push(tag.trim());
		}
	});
	updateSearchTags();
	generateList(searchTags);
	searchInput.value = '';
}

function updateSearchTags() {
	searchTagsContainer.innerHTML = '';

	searchTags.forEach((tag, tagIndex) => {
		const tagElement = document.createElement('div');
		tagElement.classList.add('tag');
		tagElement.innerHTML = `<span>${tag}</span> <button>&times;</button>`;

		tagElement.querySelector('button').addEventListener('click', (e) => {
			e.stopPropagation();
			removeSearchTag(tagIndex);
		});

		searchTagsContainer.appendChild(tagElement);
	});
}

function removeSearchTag(tagIndex) {
	searchTags.splice(tagIndex, 1);
	updateSearchTags();
	generateList(searchTags);
}

function updateTagHighlight() {
    const suggestionElements = document.querySelectorAll('.popup-suggestions .suggestion-item');
    suggestionElements.forEach((element, index) => {
        element.classList.toggle('highlighted', index === highlightedTagIndex);
    });
}

function toggleLeftBar(show) {
    infoDisplay.classList.toggle('hidden', !show);
    if (!show) {
        tagSuggestionsPopup.style.display = 'none';
        autocompleteSuggestions.innerHTML = '';
        autocompleteSuggestions.style.display = 'none';
    }
}

export function main() {
	backendGetFiles(items, globalTags, generateList)
}

checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
        generateList(searchTags, true);
    } else {
        generateList(searchTags);
    }
});

tagInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		const tagsToAdd = tagInput.value.split(' ').filter(tag => tag.trim() !== '');
		addTags(tagsToAdd);
	}
});

tagInput.addEventListener('input', (e) => {
    const inputText = e.target.value.toLowerCase();

    const suggestions = Array.from(globalTags).filter(tag =>
        tag.toLowerCase().startsWith(inputText) && tag !== inputText
    );

    tagSuggestionsPopup.innerHTML = '';

    if (suggestions.length > 0) {
        tagSuggestionsPopup.style.display = 'block';
        const tagInputRect = tagInput.getBoundingClientRect();

        tagSuggestionsPopup.style.top = `${tagInputRect.bottom + window.scrollY}px`;
        tagSuggestionsPopup.style.left = `${tagInputRect.left + window.scrollX}px`;

        suggestions.forEach((suggestion, _) => {
            const suggestionElement = document.createElement('div');
            suggestionElement.textContent = suggestion;
            suggestionElement.classList.add('suggestion-item');

            suggestionElement.addEventListener('click', () => {
                tagInput.value += (tagInput.value ? ' ' : '') + suggestion;
                tagSuggestionsPopup.innerHTML = '';
                tagSuggestionsPopup.style.display = 'none';
            });

            tagSuggestionsPopup.appendChild(suggestionElement);
        });
    } else {
        tagSuggestionsPopup.style.display = 'none';
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#tag-input') && !e.target.closest('#tag-suggestions')) {
        tagSuggestionsPopup.style.display = 'none';
    }
});

let highlightedTagIndex = -1;

tagInput.addEventListener('keydown', (e) => {
    const suggestions = document.querySelectorAll('.popup-suggestions .suggestion-item');

    if (e.key === 'ArrowDown') {
        highlightedTagIndex = (highlightedTagIndex + 1) % suggestions.length;
        updateTagHighlight();
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        highlightedTagIndex = (highlightedTagIndex - 1 + suggestions.length) % suggestions.length;
        updateTagHighlight();
        e.preventDefault();
    }
});

itemList.addEventListener('click', () => {
	toggleLeftBar(true);
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('#item-list') && !event.target.closest('#info-display')) {
        toggleLeftBar(false);
        Array.from(itemList.children).forEach(i => i.classList.remove('selected'));
    }
    autocompleteSuggestions.innerHTML = '';
    autocompleteSuggestions.style.display = 'none';
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape') {
		toggleLeftBar(false);
		Array.from(itemList.children).forEach(i => i.classList.remove('selected'));
		selectedIndex = -1;
	}

	if (event.key === 'ArrowDown') {
		event.preventDefault();
		selectedIndex = (selectedIndex + 1) % currentItems.length;
		updateSelection(selectedIndex);
		console.log("current items", currentItems);
	}

	if (event.key === 'ArrowUp') {
		event.preventDefault();
		selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
		updateSelection(selectedIndex);
	}

	if (event.code === 'Space') {
		event.preventDefault();
		if (isPopupVisible) {
			hidePopup();
		} else {
			if (selectedIndex >= 0) {
				showPopup(currentItems[selectedIndex].name);
			}
		}
	}
});

searchInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		const tagsToAdd = searchInput.value.split(' ').filter(tag => tag.trim() !== '');
		addSearchTags(tagsToAdd);
	}
});

searchInput.addEventListener('input', (e) => {
	const inputText = e.target.value;
	const suggestions = Array.from(globalTags).filter(tag => tag.startsWith(inputText) && tag !== inputText);

	autocompleteSuggestions.innerHTML = '';
	autocompleteSuggestions.style.display = suggestions.length > 0 ? 'block' : 'none';
	highlightedIndex = -1;

	suggestions.forEach((suggestion, index) => {
		const suggestionElement = document.createElement('div');
		suggestionElement.textContent = suggestion;
		suggestionElement.classList.add('autocomplete-suggestion');

		suggestionElement.addEventListener('click', () => {
			tagInput.value += (tagInput.value ? ' ' : '') + suggestion;
			autocompleteSuggestions.innerHTML = '';
			autocompleteSuggestions.style.display = 'none';
		});

		suggestionElement.addEventListener('mouseover', () => {
			highlightedIndex = index;
			updateHighlight();
		});

		autocompleteSuggestions.appendChild(suggestionElement);
	});
});

searchInput.addEventListener('keydown', (e) => {
	const suggestions = document.querySelectorAll('.autocomplete-suggestion');

	if (e.key === 'ArrowDown') {
		highlightedIndex = (highlightedIndex + 1) % suggestions.length;
		updateHighlight();
		e.preventDefault();
	} else if (e.key === 'ArrowUp') {
		highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
		updateHighlight();
		e.preventDefault();
	} else if (e.key === 'Enter' && highlightedIndex > -1) {
		const selectedSuggestion = suggestions[highlightedIndex].textContent;
		tagInput.value += (tagInput.value ? ' ' : '') + selectedSuggestion;
		autocompleteSuggestions.innerHTML = '';
		autocompleteSuggestions.style.display = 'none';
	}
});

const overlay = document.getElementById("overlay");
const popupContent = document.getElementById("popupContent");
let isPopupVisible = false;
const popupImage = document.getElementById("popupImage");

function showPopup(filename) {
	backendOpenFile(filename).then((base64_img) => {
		popupImage.src = base64_img;
		overlay.style.display = "flex";
		overlay.classList.remove("fadeOut");
		popupContent.classList.remove("scaleOut");
		overlay.classList.add("fadeIn");
		popupContent.classList.add("scaleIn");
		isPopupVisible = true;

	});
}

function hidePopup() {
	overlay.classList.remove("fadeIn");
	popupContent.classList.remove("scaleIn");
	overlay.classList.add("fadeOut");
	popupContent.classList.add("scaleOut");

	overlay.style.display = "none";
	isPopupVisible = false;
}

