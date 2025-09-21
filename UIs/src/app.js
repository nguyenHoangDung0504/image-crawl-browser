// Init ====================================================================================================================

document.readyState === 'loading'
	? document.addEventListener('DOMContentLoaded', initImageSniffer)
	: initImageSniffer();

async function initImageSniffer() {
	const maxRetries = 3;
	const delay = 200; // ms

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		const container = document.getElementById('image-sniffer-container');
		if (container || inDevEnv()) {
			const _shadowRoot = container?.shadowRoot;

			if (!_shadowRoot) {
				console.warn('Shadow root not found, falling back to document');
				setupEventListeners(document);
				return;
			}

			setupEventListeners(_shadowRoot);
			return; // thành công -> thoát hàm
		}

		// Nếu chưa đủ số lần thử thì chờ
		if (attempt < maxRetries) {
			await new Promise((res) => setTimeout(res, delay));
		}
	}

	throw new Error('image-sniffer-container not found after 3 retries');
}

// Events ====================================================================================================================

/**
 * @param {ShadowRoot | Document} root
 */
function setupEventListeners(root) {
	let queryRs;
	const [
		triggerBtn,
		modal,
		closeBtn,
		selectAllBtn,
		selectRangeBtn,
		deselectAllBtn,
		saveBtn,
		folderInput,
		imagesGrid,
	] = (queryRs = [
		'#sniffer-trigger-btn',
		'#sniffer-modal',
		'#close-modal',
		'#select-all',
		'#select-range',
		'#deselect-all',
		'#save-btn',
		'#folder-input',
		'#images-grid',
	].map((selector) => root.querySelector(selector)));

	if (queryRs.some((el) => !el)) {
		console.error('Required elements not found in shadow DOM');
		return;
	}

	if (inDevEnv()) {
		populateImagesGrid(
			[
				'https://i3.hentaifox.com/004/3454912/thumb.jpg',
				'https://i3.hentaifox.com/004/3454835/thumb.jpg',
				'https://m9.imhentai.xxx/027/md9na4z1j6/cover.jpg',
				'https://m10.imhentai.xxx/029/klfrjgzhdn/thumb.jpg',
				'https://m10.imhentai.xxx/029/c4nh75m96x/thumb.jpg',
				'https://m10.imhentai.xxx/029/wj9ms427hg/thumb.jpg',
				'https://m10.imhentai.xxx/029/6ymwkd0qs3/thumb.jpg',
				'https://m10.imhentai.xxx/029/5e18jt6nx0/cover.jpg',
				'https://m8.imhentai.xxx/025/dtfla740pw/cover.jpg',
			],
			imagesGrid,
			root
		);
		modal.classList.remove('hidden');
		updateSelectedCount(root);
	}

	// Show modal when trigger button is clicked
	triggerBtn.addEventListener('click', async () => {
		try {
			let urls = await window.getCapturedImageUrls();

			if (!urls || urls.length === 0) {
				showToast('Chưa có ảnh nào được bắt!', 'info', root);
				return;
			}

			// Sort theo thứ tự xuất hiện trong DOM
			const docImages = Array.from(document.querySelectorAll('img'));
			console.log(
				'> [ImageBrowser] Debug - All image on document:',
				docImages.map((img) => img.src),
				docImages.length
			);
			console.log('> [ImageBrowser] Debug - All image catched:', urls);
			urls = [...urls].sort((a, b) => {
				const idxA = docImages.findIndex((img) => img.src === a);
				const idxB = docImages.findIndex((img) => img.src === b);
				return (idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA) - (idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB);
			});

			console.log('> [ImageBrowser] Debug - All image after sort:', urls, urls.length);

			populateImagesGrid(urls, imagesGrid, root);
			modal.classList.remove('hidden');
			updateSelectedCount(root);
		} catch (error) {
			console.error('Error getting captured images:', error);
			showToast('Lỗi khi lấy danh sách ảnh!', 'error', root);
		}
	});

	// Close modal
	const closeModal = () => {
		modal.classList.add('hidden');
		imagesGrid.innerHTML = '';
	};

	closeBtn.addEventListener('click', closeModal);

	// Close modal when clicking outside
	modal.addEventListener('click', (e) => {
		if (e.target === modal) {
			closeModal();
		}
	});

	// Close modal with Escape key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
			closeModal();
		}
	});

	// Select all images
	selectAllBtn.addEventListener('click', () => {
		const checkboxes = imagesGrid.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach((checkbox) => {
			checkbox.checked = true;
			checkbox.closest('.image-item').classList.add('selected');
		});
		updateSelectedCount(root);
	});

	// Select range of images between exactly two checked
	selectRangeBtn.addEventListener('click', () => {
		const checkboxes = Array.from(imagesGrid.querySelectorAll('input[type="checkbox"]'));
		const checkedIndices = checkboxes.map((cb, idx) => (cb.checked ? idx : -1)).filter((idx) => idx !== -1);

		if (checkedIndices.length !== 2) {
			showToast('Khoảng không hợp lệ, chỉ được chọn 2 ảnh!', 'error', root);
			return;
		}

		const [start, end] =
			checkedIndices[0] < checkedIndices[1] ? checkedIndices : [checkedIndices[1], checkedIndices[0]];

		// Tick all checkboxes in range
		for (let i = start; i <= end; i++) {
			checkboxes[i].checked = true;
			checkboxes[i].closest('.image-item').classList.add('selected');
		}

		updateSelectedCount(root);
	});

	// Deselect all images
	deselectAllBtn.addEventListener('click', () => {
		const checkboxes = imagesGrid.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach((checkbox) => {
			checkbox.checked = false;
			checkbox.closest('.image-item').classList.remove('selected');
		});
		updateSelectedCount(root);
	});

	// Save selected images
	saveBtn.addEventListener('click', async () => {
		const selectedUrls = getSelectedImageUrls(imagesGrid);
		const folder = folderInput.value.trim();

		if (!folder) {
			showToast('Vui lòng nhập tên thư mục!', 'error', root);
			folderInput.focus();
			return;
		}

		if (selectedUrls.length === 0) {
			showToast('Vui lòng chọn ít nhất một ảnh!', 'error', root);
			return;
		}

		try {
			saveBtn.classList.add('loading');
			saveBtn.disabled = true;

			showToast(`Đang lưu ${selectedUrls.length} ảnh...`, 'info', root);

			await window.saveSelectedImages(selectedUrls, folder);

			showToast(`Đã lưu thành công ${selectedUrls.length} ảnh vào thư mục "${folder}"!`, 'success', root);
			closeModal();
		} catch (error) {
			console.error('Error saving images:', error);
			showToast('Lỗi khi lưu ảnh!', 'error', root);
		} finally {
			saveBtn.classList.remove('loading');
			saveBtn.disabled = false;
		}
	});

	// Enter key to save
	folderInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			saveBtn.click();
		}
	});
}

// UIs ====================================================================================================================

function populateImagesGrid(urls, grid, root) {
	grid.innerHTML = '';

	urls.forEach((url, index) => {
		const item = document.createElement('div');
		item.className = 'image-item';

		item.innerHTML = `
            <img src="${url}" alt="Captured Image ${index + 1}" loading="lazy">
            <div class="checkbox-container">
                <input type="checkbox" data-url="${url}">
                <span>Ảnh ${index + 1}</span>
            </div>
            <div class="url-preview">${truncateUrl(url, 50)}</div>
        `;

		const checkbox = item.querySelector('input[type="checkbox"]');
		const img = item.querySelector('img');

		// Handle checkbox change
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) {
				item.classList.add('selected');
			} else {
				item.classList.remove('selected');
			}
			updateSelectedCount(root);
		});

		// Handle image load error
		img.addEventListener('error', () => {
			img.src =
				'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDNWMjFIMTJMMTIgMTJMMTIgM0gyMVoiIGZpbGw9IiM0QTU1NjgiLz4KPHBhdGggZD0iTTEyIDEySDE4VjE4SDEyVjEyWiIgZmlsbD0iIzJEMzc0OCIvPgo8L3N2Zz4K';
			img.alt = 'Không thể tải ảnh';
			item.classList.add('error');
		});

		// Click item to toggle checkbox
		item.addEventListener('click', (e) => {
			if (!e.target.classList.contains('url-preview')) {
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event('change'));
			}
		});

		grid.appendChild(item);
	});
}

function getSelectedImageUrls(grid) {
	const selectedCheckboxes = grid.querySelectorAll('input[type="checkbox"]:checked');
	return Array.from(selectedCheckboxes).map((checkbox) => checkbox.dataset.url);
}

function updateSelectedCount(root) {
	const selectedCount = root.querySelector('#selected-count');
	const grid = root.querySelector('#images-grid');

	if (selectedCount && grid) {
		const count = grid.querySelectorAll('input[type="checkbox"]:checked').length;
		selectedCount.textContent = `${count} ảnh được chọn (Note: Số lượng ảnh bằng STT cuối - đầu + 1)`;
	}
}

function showToast(message, type = 'info', root) {
	const toastContainer = root.querySelector('#toast-container');
	if (!toastContainer) return;

	const toast = document.createElement('div');
	toast.className = `toast ${type}`;
	toast.textContent = message;

	toastContainer.appendChild(toast);

	// Auto remove after 3 seconds
	setTimeout(() => {
		toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 300);
	}, 2000);

	// Click to dismiss
	toast.addEventListener('click', () => {
		toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 300);
	});
}

// Utils ====================================================================================================================

function truncateUrl(url, maxLength) {
	if (url.length <= maxLength) return url;

	const start = url.substring(0, maxLength / 2);
	const end = url.substring(url.length - maxLength / 2);
	return `${start}...${end}`;
}

function inDevEnv() {
	return ['file:///', 'localhost', '127.0.0.1'].some((signal) => window.location.href.includes(signal));
}
