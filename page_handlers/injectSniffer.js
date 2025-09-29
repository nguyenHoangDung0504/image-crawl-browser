import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {import('puppeteer').Page} page
 */
export default async function injectSniffer(page) {
	// Đọc file HTML và CSS từ disk
	const htmlContent = fs.readFileSync(path.join(__dirname, '../UIs/index.html'), 'utf-8');
	const cssContent = fs.readFileSync(path.join(__dirname, '../UIs/styles/style.css'), 'utf-8');
	const jsContent = fs.readFileSync(path.join(__dirname, '../UIs/src/app.js'), 'utf-8');

	await page.evaluate((html, css, js) => {
		// Đảm bảo DOM đã sẵn sàng
		if (!document.body) {
			console.error('> [Error] Document.body is not available');
			return;
		}

		// Xóa container & style cũ nếu có
		document.getElementById('image-sniffer-container')?.remove();
		document.getElementById('image-sniffer-styles')?.remove();

		// Tạo container
		const container = document.createElement('div');
		container.id = 'image-sniffer-container';
		container.style.cssText = 'all: initial; position: fixed; z-index: 999999;';

		let shadowRoot;
		let usingShadowDOM = false;

		// Thử tạo Shadow DOM
		try {
			shadowRoot = container.attachShadow({ mode: 'open' });
			usingShadowDOM = true;
			console.log('Using Shadow DOM');
		} catch (err) {
			console.warn('Shadow DOM not supported, using isolated DOM');
			shadowRoot = container;
		}

		// Inject CSS
		{
			const style = document.createElement('style');
			style.id = 'image-sniffer-styles';
			style.textContent = css;

			if (usingShadowDOM) shadowRoot.appendChild(style);
			else document.head.appendChild(style);
		}

		// Inject HTML
		shadowRoot.appendChild(Object.assign(document.createElement('div'), { innerHTML: html }));

		// Inject JavaScript
		document.head.appendChild(Object.assign(document.createElement('script'), { textContent: js }));

		// Append container to body
		document.body.appendChild(container);
		console.log(`Image Sniffer UI injected successfully, using ${usingShadowDOM ? 'Shadow DOM' : 'Document'}`);
	}, ...[htmlContent, cssContent, jsContent]);
}
