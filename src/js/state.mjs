import { backendGetFiles, backendUpdateTags } from "./tauri.mjs";
import { shuffle } from "./shuffle.mjs";
import { showPopup, hidePopup, isPopupVisible } from './popup.mjs'

class Directory {
	constructor() {
		this.items = [];
		this.globalTags = new Set();
		this.itemList = document.getElementById('item-list');
		this.infoDisplay = document.getElementById('info-display');
		this.tagsContainer = document.getElementById('tags-container');
		this.tagInput = document.getElementById('tag-input');
		this.autocompleteSuggestions = document.getElementById('autocomplete-suggestions');
		this.searchInput = document.getElementById('search-input');
		this.searchTagsContainer = document.getElementById('search-tags-container');
		this.tagSuggestionsPopup = document.getElementById('tag-suggestions');
		this.checkbox = document.getElementById('filter-untagged');
		this.perPageElements = 10;

		this.currentItems = []
		this.selectedIndex = -1;
		this.searchTags = [];
		this.highlightedIndex = -1;
		this.filterUntagged = false;
		this.highlightedTagIndex = -1;
		this.currentPage = 0;

		this.setDOM();
	}

	toggleLeftBar(show) {
		this.infoDisplay.classList.toggle('hidden', !show);
		if (!show) {
			this.tagSuggestionsPopup.style.display = 'none';
			this.autocompleteSuggestions.innerHTML = '';
			this.autocompleteSuggestions.style.display = 'none';
		}
	}

	hideLeftBar() {
		this.toggleLeftBar(false);
	}

	updateSelection() {
		const selectedItem = this.itemList.children[this.selectedIndex];
		const itemInfo     = selectedItem.getAttribute('data-info');
		const itemTags     = this.currentItems[this.selectedIndex].tags;

		document.getElementById('item-info').textContent = itemInfo;
		this.infoDisplay.classList.remove('hidden');

		this.updateTags(itemTags);

		Array.from(this.itemList.children).forEach(i => i.classList.remove('selected'));
		selectedItem.classList.add('selected');

		selectedItem.scrollIntoView({
			behavior: 'smooth',
			block:    'nearest',
			inline:   'nearest'
		});
	}

	updateTags(tags) {
		this.tagsContainer.innerHTML = '';

		tags.forEach((tag, tagIndex) => {
			const tagElement = document.createElement('div');
			tagElement.classList.add('tag');
			tagElement.innerHTML = `<span>${tag}</span> <button>&times;</button>`;

			tagElement.querySelector('button').addEventListener('click', (e) => {
				e.stopPropagation();
				this.removeTag(tagIndex);
			});

			this.tagsContainer.appendChild(tagElement);
		});
	}

	removeTag(tagIndex) {
		if (this.selectedIndex !== -1) {
			this.currentItems[this.selectedIndex].tags.splice(tagIndex, 1);
			this.updateTags(this.currentItems[this.selectedIndex].tags);
			backendUpdateTags(this.currentItems[this.selectedIndex].name, this.currentItems[this.selectedIndex].tags);
			this.generateList(false)
			this.updateSelection();
		}
	}

	addTags(newTags) {
		if (this.selectedIndex !== -1) {
			const currentTags = this.currentItems[this.selectedIndex].tags;
			newTags.forEach(tag => {
				if (tag && !currentTags.includes(tag.trim())) {
					currentTags.push(tag.trim());
					this.globalTags.add(tag.trim());
				}
			});
			this.updateTags(currentTags);

			this.tagInput.value = '';

			backendUpdateTags(this.currentItems[this.selectedIndex].name, this.currentItems[this.selectedIndex].tags)
			this.generateList(false);
			this.updateSelection();
		}
	}

	generateList(resetIndex = true) {
		this.itemList.innerHTML = '';

		this.currentItems = []
		if (resetIndex) {
			this.selectedIndex = 0;
			this.highlightedIndex = 0;
		}

		this.items.forEach((item, _) => {
			if (this.filterUntagged) {
				if (item.tags.length != 0) {
					return;
				}
			}

			if (this.searchTags.length === 0 || this.searchTags.every(tag => item.tags.includes(tag))) {
				this.currentItems.push(item);
			}
		});

		const start = this.currentPage * this.perPageElements;
		const end = start + this.perPageElements - 1;
		this.currentItems = this.currentItems.slice(start, end);

		this.currentItems.forEach((item, index) => {
			const listItem = document.createElement('li');
			listItem.textContent = item.name;
			listItem.setAttribute('data-info', item.info);
			listItem.setAttribute('is-image', item.isImage);

			if (item.tags && item.tags.length > 0) {
				listItem.classList.add('item-with-tags');
			}

			listItem.addEventListener('click', () => {
				this.selectedIndex = index;
				this.updateSelection();
			});

			this.itemList.appendChild(listItem);
		});

	}

	updateHighlight() {
		const suggestionElements = document.querySelectorAll('.autocomplete-suggestion');
		suggestionElements.forEach((element, index) => {
			element.classList.toggle('highlighted', index === this.highlightedIndex);
		});

		if (this.highlightedIndex >= 0) {
			const highlightedElement = suggestionElements[this.highlightedIndex];
			const container = this.autocompleteSuggestions;

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

	addSearchTags(newTags) {
		newTags.forEach(tag => {
			if (!this.searchTags.includes(tag.trim())) {
				this.searchTags.push(tag.trim());
			}
		});
		this.updateSearchTags();
		this.generateList(true);
		this.searchInput.value = '';
	}

	updateSearchTags() {
		this.searchTagsContainer.innerHTML = '';

		this.searchTags.forEach((tag, tagIndex) => {
			const tagElement = document.createElement('div');
			tagElement.classList.add('tag');
			tagElement.innerHTML = `<span>${tag}</span> <button>&times;</button>`;

			tagElement.querySelector('button').addEventListener('click', (e) => {
				e.stopPropagation();
				this.removeSearchTag(tagIndex);
			});

			this.searchTagsContainer.appendChild(tagElement);
		});
	}

	removeSearchTag(tagIndex) {
		this.searchTags.splice(tagIndex, 1);
		this.updateSearchTags();
		this.generateList(this.searchTags);
		this.updateSelection();
	}

	updateTagHighlight() {
		const suggestionElements = document
			.querySelectorAll('.popup-suggestions .suggestion-item');
		suggestionElements.forEach((element, index) => {
			element.classList.toggle('highlighted', index === this.highlightedTagIndex);
		});
	}

	setDOM() {
		this.checkbox.addEventListener('change', () => {
			if (this.checkbox.checked) {
				this.filterUntagged = true;
				this.generateList(true);
			} else {
				this.filterUntagged = false;
				this.generateList(true);
			}
			this.updateSelection();
		});

		this.tagInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const tagsToAdd = this.tagInput.value.split(' ').filter(tag => tag.trim() !== '');
				this.addTags(tagsToAdd);
			}
		});

		this.tagInput.addEventListener('input', (e) => {
			const inputText = e.target.value.toLowerCase();

			const suggestions = Array.from(this.globalTags).filter(tag =>
				tag.toLowerCase().startsWith(inputText) && tag !== inputText
			);

			this.tagSuggestionsPopup.innerHTML = '';

			if (suggestions.length > 0) {
				this.tagSuggestionsPopup.style.display = 'block';
				const tagInputRect = this.tagInput.getBoundingClientRect();

				this.tagSuggestionsPopup.style.top = `${tagInputRect.bottom + window.scrollY}px`;
				this.tagSuggestionsPopup.style.left = `${tagInputRect.left + window.scrollX}px`;

				suggestions.forEach((suggestion, _) => {
					const suggestionElement = document.createElement('div');
					suggestionElement.textContent = suggestion;
					suggestionElement.classList.add('suggestion-item');

					suggestionElement.addEventListener('click', () => {
						this.tagInput.value += (this.tagInput.value ? ' ' : '') + suggestion;
						this.tagSuggestionsPopup.innerHTML = '';
						this.tagSuggestionsPopup.style.display = 'none';
					});

					this.tagSuggestionsPopup.appendChild(suggestionElement);
				});
			} else {
				this.tagSuggestionsPopup.style.display = 'none';
			}
		});

		document.addEventListener('click', (e) => {
			if (!e.target.closest('#tag-input') && !e.target.closest('#tag-suggestions')) {
				this.tagSuggestionsPopup.style.display = 'none';
			}
		});

		this.tagInput.addEventListener('keydown', (e) => {
			const suggestions = document.querySelectorAll('.popup-suggestions .suggestion-item');

			if (e.key === 'ArrowDown') {
				if (isPopupVisible) {
					return;
				}
				this.highlightedTagIndex = (this.highlightedTagIndex + 1) % suggestions.length;
				this.updateTagHighlight();
				e.preventDefault();
			} else if (e.key === 'ArrowUp') {
				if (isPopupVisible) {
					return;
				}
				this.highlightedTagIndex = (this.highlightedTagIndex - 1 + suggestions.length) %
					suggestions.length;
				this.updateTagHighlight();
				e.preventDefault();
			}
		});

		this.itemList.addEventListener('click', () => {
			this.toggleLeftBar(true);
		});

		document.addEventListener('click', (event) => {
			if (isPopupVisible) {
				return;
			}
			if (!event.target.closest('#item-list') && !event.target.closest('#info-display')) {
				this.toggleLeftBar(false);
				Array.from(this.itemList.children).forEach(i => i.classList.remove('selected'));
			}
			this.autocompleteSuggestions.innerHTML = '';
			this.autocompleteSuggestions.style.display = 'none';
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {

				if (isPopupVisible) {
					hidePopup();
					return;
				}

				this.hideLeftBar()
			}

			if (event.key === 'ArrowDown') {
				event.preventDefault();

				if (isPopupVisible) {
					return;
				}

				this.selectedIndex = (this.selectedIndex + 1) % this.currentItems.length;
				this.updateSelection();
			}

			if (event.key === 'ArrowUp') {
				if (isPopupVisible) {
					return;
				}

				event.preventDefault();
				this.selectedIndex = (this.selectedIndex - 1 + this.currentItems.length) % this.currentItems.length;
				this.updateSelection();
			}

			if (event.key === 'ArrowLeft') {
				event.preventDefault();

				if (isPopupVisible) {
					return;
				}

				this.currentPage--;
				if (this.currentPage < 0) {
					this.currentPage = 0;
				}
				this.hideLeftBar()
				this.generateList(true);
				this.updateSelection();
			}

			if (event.key === 'ArrowRight') {
				event.preventDefault();

				if (isPopupVisible) {
					return;
				}

				this.currentPage++;
				let maxPages;
				if (this.searchTags.length > 0) {
					maxPages = Math.round(this.currentItems.length / this.perPageElements);
					if (maxPages != 0 && this.currentItems.length % this.perPageElements != 0) {
						maxPages++;
					}
				} else
				{
					maxPages = this.items.length / this.perPageElements;
					if (this.items.length % this.perPageElements != 0) {
						maxPages++;
					}
				}

				if (this.currentPage > maxPages - 1) {
					if (maxPages == 0) {
						this.currentPage = maxPages;
					} else {
						this.currentPage = maxPages - 1;
					}
				}
				this.hideLeftBar();
				this.generateList(true);
				this.updateSelection();
			}

			if (event.code === 'Space') {
				event.preventDefault();
				if (isPopupVisible) {
					hidePopup();
				} else if (this.selectedIndex >= 0) {
					showPopup(this.currentItems[this.selectedIndex].name);
				}
			}
		});

		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const tagsToAdd = this.searchInput.value.split(' ').filter(tag => tag.trim() !== '');
				this.addSearchTags(tagsToAdd);
				this.currentPage = 0;
				this.generateList(true);
				this.updateSelection();
			}
		});

		this.searchInput.addEventListener('input', (e) => {
			const inputText = e.target.value;
			const suggestions = Array.from(this.globalTags).filter(tag => tag.startsWith(inputText)
				&& tag !== inputText);

			this.autocompleteSuggestions.innerHTML = '';
			this.autocompleteSuggestions.style.display = suggestions.length > 0 ? 'block' : 'none';
			this.highlightedIndex = -1;

			suggestions.forEach((suggestion, index) => {
				const suggestionElement = document.createElement('div');
				suggestionElement.textContent = suggestion;
				suggestionElement.classList.add('autocomplete-suggestion');

				suggestionElement.addEventListener('click', () => {
					this.tagInput.value += (this.tagInput.value ? ' ' : '') + suggestion;
					this.autocompleteSuggestions.innerHTML = '';
					this.autocompleteSuggestions.style.display = 'none';
				});

				suggestionElement.addEventListener('mouseover', () => {
					this.highlightedIndex = index;
					this.updateHighlight();
				});

				this.autocompleteSuggestions.appendChild(suggestionElement);
			});
		});

		this.searchInput.addEventListener('keydown', (e) => {
			const suggestions = document.querySelectorAll('.autocomplete-suggestion');

			if (e.key === 'ArrowDown') {
				this.highlightedIndex = (this.highlightedIndex + 1) % suggestions.length;
				this.updateHighlight();
				e.preventDefault();
			} else if (e.key === 'ArrowUp') {
				this.highlightedIndex = (this.highlightedIndex - 1 + suggestions.length) % suggestions.length;
				this.updateHighlight();
				e.preventDefault();
			} else if (e.key === 'Enter' && this.highlightedIndex > -1) {
				this.autocompleteSuggestions.innerHTML = '';
				this.autocompleteSuggestions.style.display = 'none';
			}
		});

		document.getElementById("shuffle-button").addEventListener("click", () => {
			shuffle(this.items);
			this.currentPage = 0;
			this.generateList(true);
			this.updateSelection();
		});
	}
}

export function main() {
	let d = new Directory;
	backendGetFiles(d.items, d.globalTags, d.generateList.bind(d))
}
