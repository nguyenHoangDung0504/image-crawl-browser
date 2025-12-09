// @ts-check
import fs from 'fs';
import path from 'path';
import { getPageImageRegistry } from '../../../resources/registries.js';
import { STORAGE_CONFIG } from '../../../user-configs.js';

/**
 * @param {import('puppeteer').Page} page
 * @param {string[]} urls
 * @param {string} folderPath
 */
export default function saveSelectedImages(page, urls, folderPath) {
	folderPath = folderPath ? folderPath : `${STORAGE_CONFIG.defaultStorage}/${Date.now()}/`;

	const pageURL = page.url();

	if (!urls || !urls.length || !folderPath) {
		console.log('> [Error] Thiếu URL hoặc thư mục lưu.', folderPath);
		return;
	}

	const imageReg = getPageImageRegistry(page);

	fs.mkdirSync(folderPath, { recursive: true });

	// Viết file .source.txt
	const sourceFile = path.join(folderPath, '.source.txt');
	fs.writeFileSync(sourceFile, pageURL + '\n', 'utf8');
	console.log('> [SaveSelectedImages][Info] Đã ghi file nguồn:', sourceFile);

	// Lưu ảnh
	for (const url of urls) {
		const buffer = imageReg.get(url);
		if (!buffer) continue;

		const fileName = path.basename(new URL(url).pathname) || 'image.jpg';
		const fullPath = path.join(folderPath, fileName);

		fs.writeFileSync(fullPath, buffer);
		console.log('> [SaveSelectedImages][Info] Đã lưu:', fullPath);
	}

	console.log('> [SaveSelectedImages][Info] Hoàn tất lưu ảnh vào:', folderPath);
}
