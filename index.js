// Core
import fs from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';

// Page handlers
import blockADs from './page_handlers/blockADs.js';
import injectSniffer from './page_handlers/injectSniffer.js';

// Browser handlers
import setupBrowserExit from './browser_handler/setupBrowserExit.js';

// Configs
import { BROWSER_CONFIG } from './user-configs.js';
import loadBlacklist from './resources/loadBlacklist.js';

/** @type {Map<Page, Map<string, Buffer>>} */
const pageImageMaps = new Map();
const blacklistPatterns = loadBlacklist();

const browser = await puppeteer.launch({
	headless: false,
	defaultViewport: null,
	args: ['--start-maximized'],
	...BROWSER_CONFIG,
});

// Theo dõi để setup page (tab) mới
browser.on('targetcreated', async (target) => {
	if (target.type() !== 'page') return;

	try {
		const newPage = await target.page();
		if (!newPage || newPage.isClosed()) return;
		await setupPage(newPage);
	} catch (err) {
		console.warn('> [Warn] Failed to setup new page:', err.message);
	}
});

setupBrowserExit(browser);

// Tạo trang blank đầu tiên
const [page] = await browser.pages();
await setupPage(page);

/**
 * @param {Page} page
 */
async function setupPage(page) {
	pageImageMaps.set(page, new Map());

	const imageMap = pageImageMaps.get(page);
	await page.setRequestInterception(true);

	if (!imageMap) return console.error('> [Error] No imageMap found for page!');

	// Block Ads
	page.on('request', (request) => {
		const url = request.url();
		const isBlocked = blacklistPatterns.some((pattern) => pattern.test(url));

		if (isBlocked) {
			console.log(`\t\t> [Info] Chặn: ${url}`);
			request.abort();
		} else request.continue();
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

	let lastURL = page.url();
	page.on('framenavigated', async (frame) => {
		if (frame === page.mainFrame()) {
			// Xóa ảnh ở trang cũ
			const pageUrl = page.url();
			if (lastURL !== pageUrl) {
				imageMap.clear();
				lastURL = pageUrl;
				console.log(`> [Info] Navigation detected to [${pageUrl}] - Clearing ${imageMap.size} cached images`);
			} else console.log('> [Info] Reload detected, ignore clear images');

			try {
				await page.waitForSelector('body', { timeout: 10000 });
				await injectSniffer(page);
				console.log('> [Info] Script đã được inject lại sau khi chuyển trang');
			} catch (err) {
				console.warn('> [Error] Inject thất bại:', err);
			}
		}
	});

	page.on('close', () => {
		pageImageMaps.delete(page);
		console.log('> [Info] Cleaned up images for closed tab\n');
	});
}
