import fs from 'fs';
import path from 'path';
import { getPageImageRegistry } from '../../../resources/registries.js';
import { STORAGE_CONFIG } from '../../../user-configs.js';

/**
 * @param {import('puppeteer').Page} page
 * @param {string[]} urls
 * @param {string} folderPath
 */
export default function saveSelectedImages(page, urls, folderPath = STORAGE_CONFIG.defaultStorage) {
	if (!urls || !urls.length || !folderPath) {
		console.log('> [Error] Thiếu URL hoặc thư mục lưu.');
		return;
	}
	const imageReg = getPageImageRegistry(page);

	fs.mkdirSync(folderPath, { recursive: true });

	for (const url of urls) {
		const buffer = imageReg.get(url);
		if (!buffer) continue;

		const fileName = path.basename(new URL(url).pathname) || 'image.jpg';
		const fullPath = path.join(folderPath, fileName);
		fs.writeFileSync(fullPath, buffer);
		console.log('> [handler.SaveSelectedImages][Info] Đã lưu:', fullPath);
	}

	console.log('> [handler.SaveSelectedImages][Info] Hoàn tất lưu ảnh vào:', folderPath);
}
