export function shuffle(itemList) {
	for (let i = itemList.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));

		[itemList[i], itemList[j]] = [itemList[j], itemList[i]];
	}
}
