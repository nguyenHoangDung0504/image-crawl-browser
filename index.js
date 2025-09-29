import puppeteer, { Browser, Page } from 'puppeteer';

// Page handlers
import blockADs from './page_handlers/blockADs.js';
import injectSniffer from './page_handlers/injectSniffer.js';
import saveSelectedImages from './page_handlers/expose_handlers/default/saveSelectedImages.js';
import getCapturedImageURLs from './page_handlers/expose_handlers/default/getCapturedImageURL.js';

// Browser handlers
import setupBrowserExit from './browser_handler/setupBrowserExit.js';

// Configs
import { BROWSER_CONFIG } from './user-configs.js';
import loadBlacklist from './resources/loadBlacklist.js';
import { pageImageRegistries } from './resources/registries.js';

const blacklistPatterns = loadBlacklist();

const browser = await puppeteer.launch({
	headless: false,
	defaultViewport: null,
	args: ['--start-maximized'],
	...BROWSER_CONFIG,
});
setupBrowserExit(browser);
setupBrowser(browser);

// Tạo trang blank đầu tiên
const [page] = await browser.pages();
await setupPage(page);

/**
 * @param {Browser} browser
 */
function setupBrowser(browser) {
	// Theo dõi để setup page (tab) mới
	browser.on('targetcreated', async (target) => {
		if (target.type() !== 'page') return;

		try {
			const newPage = await target.page();
			if (!newPage || newPage.isClosed()) return;
			await setupPage(newPage);
		} catch (err) {
			console.warn('> [Warn] Failed to setup new page:', err);
		}
	});
}

/**
 * @param {Page} page
 */
async function setupPage(page) {
	pageImageRegistries.set(page, new Map());

	const imageMap = pageImageRegistries.get(page);
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
		const contentType = headers['content-type'] || '';
		const contentLength = parseInt(headers['content-length'] || '0', 10);

		// Kiểm tra kỹ hơn
		if (
			!contentType.startsWith('image/') ||
			imageMap.has(url) ||
			url.includes('base64') ||
			![200, 304].includes(res.status()) ||
			res.request().method() !== 'GET' ||
			contentLength > 10 * 1024 * 1024 || // Skip ảnh > 10MB
			imageMap.size >= 500 // Giới hạn số lượng ảnh
		) {
			return;
		}

		try {
			// Timeout 5s
			const buffer = await Promise.race([
				res.buffer(),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Buffer timeout')), 5000)),
			]);

			// Validate buffer
			if (buffer && buffer.length > 0) {
				imageMap.set(url, buffer);
				console.log('\t> [Info] Đã bắt ảnh:', url, `(${(buffer.length / 1024).toFixed(2)} KB)`);
			}
		} catch (error) {
			console.clear();
			console.error(
				'\t> [Error] Lỗi đọc ảnh:',
				{
					url,
					contentType,
					contentLength,
					status: res.status(),
				},
				error
			);
		}
	});

	// Expose functions
	await page.exposeFunction(getCapturedImageURLs.name, getCapturedImageURLs.bind(null, page));
	await page.exposeFunction(saveSelectedImages.name, saveSelectedImages.bind(null, page));
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
		pageImageRegistries.delete(page);
		console.log('> [Info] Cleaned up images for closed tab\n');
	});
}
