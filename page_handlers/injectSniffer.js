import { ensureUIServer } from '../internal_handlers/script-server.js';

/**
 * Inject Image Sniffer UI vào page với module support
 * @param {import('puppeteer').Page} page
 */
export default async function injectSniffer(page) {
	try {
		// Lazy start server - chỉ start khi cần
		const serverPort = await ensureUIServer();

		// Fetch HTML và CSS từ server
		const htmlContent = await fetch(`http://localhost:${serverPort}/ui/index.html`)
			.then((r) => {
				if (!r.ok) throw new Error(`Failed to fetch HTML: ${r.status}`);
				return r.text();
			})
			.catch((err) => {
				console.warn('> [Warn] Cannot fetch index.html, using empty:', err.message);
				return '<div id="app"></div>';
			});

		// Inject vào page
		await page.evaluate(
			(html, port) => {
				if (!document.body) {
					console.error('> [Error] Document.body is not available');
					return;
				}

				// Xóa container & styles cũ nếu có
				document.getElementById('image-sniffer-container')?.remove();
				document.getElementById('image-sniffer-styles')?.remove();
				document.querySelectorAll('script[data-image-sniffer]').forEach((s) => s.remove());

				// Tạo container
				const container = document.createElement('div');
				container.id = 'image-sniffer-container';
				container.style.cssText = 'all: initial; position: fixed; z-index: 999999; display: none';

				let shadowRoot;
				let usingShadowDOM = false;

				// Thử tạo Shadow DOM
				try {
					shadowRoot = container.attachShadow({ mode: 'open' });
					usingShadowDOM = true;
					console.log('> [Info] Using Shadow DOM for Image Sniffer');
				} catch (err) {
					console.warn('> [Warn] Shadow DOM not supported, using regular DOM');
					shadowRoot = container;
				}

				// Inject CSS - Dùng <link> để CSS có thể resolve @import và url() từ localhost
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = `http://localhost:${port}/ui/styles/main.css`;
				link.crossOrigin = 'anonymous';
				link.id = 'image-sniffer-styles';

				if (usingShadowDOM) {
					shadowRoot.appendChild(link);
				} else {
					document.head.appendChild(link);
				}

				// Inject HTML
				const contentWrapper = document.createElement('div');
				contentWrapper.innerHTML = html;
				shadowRoot.appendChild(contentWrapper);

				// Inject JavaScript module từ localhost
				const script = document.createElement('script');
				script.type = 'module';
				script.src = `http://localhost:${port}/ui/src/app.js`;
				script.dataset.imageSniffer = 'true'; // Đánh dấu để dễ remove
				script.crossOrigin = 'anonymous';

				// Handle load success/error
				script.onload = () => {
					console.log('✓ Image Sniffer module loaded successfully from localhost:' + port);
				};

				script.onerror = (err) => {
					console.error('✗ Failed to load Image Sniffer module:', err);
					console.error('  Make sure app.js exists at: http://localhost:' + port + '/ui/src/app.js');
				};

				document.head.appendChild(script);
				document.body.appendChild(container);

				console.log(
					`✓ Image Sniffer UI injected (${usingShadowDOM ? 'Shadow DOM' : 'Regular DOM'}) with module support`
				);
			},
			htmlContent,
			serverPort
		);

		console.log('> [Info] Image Sniffer injected successfully');
	} catch (err) {
		console.error('> [Error] Failed to inject Image Sniffer:', err);
		throw err;
	}
}
