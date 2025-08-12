import puppeteer, { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import blockADs from './page_handlers/blockADs.js';
import setupGracefulExit from './browser_handler/setupGracefulExit.js';
import loadBlacklist from './resources/loadBlacklist.js';
import injectSniffer from './page_handlers/injectSniffer.js';
import userBrowserConfig from './user-browser-config.js';

/**@type {RegExp[]} */
const blacklistPatterns = loadBlacklist();

/** @type {Map<Page, Map<string, Buffer>>} */
const pageImageMaps = new Map();

(async () => {
	const browser = setupGracefulExit(
		await puppeteer.launch({
			headless: false,
			defaultViewport: null,
			args: ['--start-maximized'],
			...userBrowserConfig,
		})
	);

	const [page] = await browser.pages();
	pageImageMaps.set(page, new Map());
	await setupPage(page);
	page.on('close', () => {
		pageImageMaps.delete(page);
		console.log('> [Info] Cleaned up images for closed tab\n');
	});

	// Theo dõi tab mới
	browser.on('targetcreated', async (target) => {
		if (target.type() !== 'page') return;

		try {
			const newPage = await target.page();
			if (!newPage || newPage.isClosed()) return;

			pageImageMaps.set(newPage, new Map());
			await setupPage(newPage);

			newPage.on('close', () => {
				pageImageMaps.delete(newPage);
				console.log('> [Info] Cleaned up images for closed tab\n');
			});
		} catch (err) {
			console.warn('> [Warn] Failed to setup new page:', err.message);
		}
	});
})();

/**
 * @param {Page} page
 */
async function setupPage(page) {
	const imageMap = pageImageMaps.get(page);
	await page.setRequestInterception(true);

	if (!imageMap) {
		console.error('> [Error] No imageMap found for page!');
		return;
	}

	// Block Ads
	page.on('request', (request) => {
		const url = request.url();
		const isBlocked = blacklistPatterns.some((pattern) => pattern.test(url));

		if (isBlocked) {
			console.log(`\t\t> [Info] Chặn: ${url}`);
			request.abort();
		} else {
			request.continue();
		}
	});

	// Capture images
	page.on('response', async (res) => {
		const url = res.url();
		const headers = res.headers();
		const ct = headers['content-type'] || '';

		if (ct.startsWith('image/') && !imageMap.has(url) && !url.includes('base64') && res.status() !== 403) {
			try {
				const buffer = await res.buffer();
				imageMap.set(url, buffer);
				console.log('\t> [Info] Đã bắt ảnh:', url);
			} catch (err) {
				console.error('\t> [Error] Lỗi đọc ảnh:', url, err.message);
			}
		}
	});

	// Expose functions
	await page.exposeFunction('getCapturedImageUrls', () => [...imageMap.keys()]);
	await page.exposeFunction('saveSelectedImages', async (urls, folder) => {
		if (!urls || !urls.length || !folder) {
			console.log('> [Error] Thiếu URL hoặc thư mục lưu.');
			return;
		}
		fs.mkdirSync(folder, { recursive: true });

		for (const url of urls) {
			const buffer = imageMap.get(url);
			if (!buffer) continue;

			const fileName = path.basename(new URL(url).pathname) || 'image.jpg';
			const fullPath = path.join(folder, fileName);
			fs.writeFileSync(fullPath, buffer);
			console.log('> [Info] Đã lưu:', fullPath);
		}

		console.log('> [Info] Hoàn tất lưu ảnh vào:', folder);
	});

	await page.evaluateOnNewDocument(blockADs);
	await injectSniffer(page);

	page.on('framenavigated', async (frame) => {
		const pageUrl = page.url();
		const imageCount = imageMap.size;

		console.log(`> [Info] Navigation detected to [${pageUrl}] - Clearing ${imageCount} cached images`);
		imageMap.clear();

		if (frame === page.mainFrame()) {
			try {
				// await page.waitForFunction(() => document.body, { timeout: 10000 });
				await page.waitForSelector('body', { timeout: 10000 });
				await injectSniffer(page);
				console.log('> [Info] Script đã được inject lại sau khi chuyển trang');
			} catch (err) {
				console.warn('> [Error] Inject thất bại:', err);
			}
		}
	});
}
