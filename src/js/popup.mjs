import { backendOpenFile } from "./tauri.mjs";

const overlay = document.getElementById("overlay");
const popupContent = document.getElementById("popupContent");
const popupImage = document.getElementById("popupImage");

export let isPopupVisible = false;

export function showPopup(filename) {
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

export function hidePopup() {
	overlay.classList.remove("fadeIn");
	popupContent.classList.remove("scaleIn");
	overlay.classList.add("fadeOut");
	popupContent.classList.add("scaleOut");

	overlay.style.display = "none";
	isPopupVisible = false;
}

function adjustImageSize() {
    const { naturalWidth, naturalHeight } = popupImage;

    const maxContainerWidth = window.innerWidth * 0.9;
    const maxContainerHeight = window.innerHeight * 0.9;

    let maxWidth, maxHeight;

    if (naturalWidth > maxContainerWidth || naturalHeight > maxContainerHeight) {
        const widthRatio = maxContainerWidth / naturalWidth;
        const heightRatio = maxContainerHeight / naturalHeight;
        const scaleRatio = Math.min(widthRatio, heightRatio);

        maxWidth = `${naturalWidth * scaleRatio}px`;
        maxHeight = `${naturalHeight * scaleRatio}px`;
    } else {
        maxWidth = `${naturalWidth}px`;
        maxHeight = `${naturalHeight}px`;
    }

    popupImage.style.maxWidth = maxWidth;
    popupImage.style.maxHeight = maxHeight;
}

popupImage.addEventListener("load", adjustImageSize);

window.addEventListener("resize", adjustImageSize);

