// uiServerManager.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UI_SERVER_PORT = 45678;

/**@type {import('http').Server?} */
let serverInstance = null;
let isStarting = false;

/**
 * Start UI static server (lazy initialization)
 * @returns {Promise<number>} Server port
 */
export async function ensureUIServer() {
	// Nếu đã chạy rồi, return port luôn
	if (serverInstance) {
		return UI_SERVER_PORT;
	}

	// Nếu đang trong quá trình khởi động, đợi
	if (isStarting) {
		await new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (serverInstance) {
					clearInterval(checkInterval);
					resolve(true);
				}
			}, 50);
		});
		return UI_SERVER_PORT;
	}

	// Bắt đầu khởi động server
	isStarting = true;

	return new Promise((resolve, reject) => {
		try {
			const app = express();

			// CORS headers - cho phép mọi origin truy cập
			app.use((req, res, next) => {
				res.header('Access-Control-Allow-Origin', '*');
				res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
				res.header('Access-Control-Allow-Headers', 'Content-Type');
				next();
			});

			// CHỈ CHO PHÉP GET và HEAD - bảo mật
			app.use((req, res, next) => {
				if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
					return res.status(405).json({ error: 'Method Not Allowed' });
				}
				next();
			});

			// Serve static files từ thư mục UIs
			const uiPath = path.join(__dirname, '../UIs');
			app.use(
				'/ui',
				express.static(uiPath, {
					setHeaders: (res, filePath) => {
						// Set correct MIME types for modules
						if (filePath.endsWith('.js')) {
							res.setHeader('Content-Type', 'application/javascript');
						} else if (filePath.endsWith('.css')) {
							res.setHeader('Content-Type', 'text/css');
						} else if (filePath.endsWith('.html')) {
							res.setHeader('Content-Type', 'text/html');
						}
					},
				})
			);

			// Health check endpoint
			app.get('/health', (req, res) => {
				res.json({ status: 'ok', port: UI_SERVER_PORT });
			});

			// 404 handler
			app.use((req, res) => {
				res.status(404).json({ error: 'Not Found' });
			});

			// Error handler
			// @ts-ignore
			app.use((err, req, res, next) => {
				console.error('> [Server Error]', err);
				res.status(500).json({ error: 'Internal Server Error' });
			});

			// Start server
			serverInstance = app.listen(UI_SERVER_PORT, () => {
				isStarting = false;
				console.log(`✓ UI Static Server running at http://localhost:${UI_SERVER_PORT}`);
				console.log(`  └─ Serving: ${uiPath}`);
				resolve(UI_SERVER_PORT);
			});

			// Error handling
			serverInstance.on('error', (err) => {
				isStarting = false;
				serverInstance = null;

				// @ts-ignore
				if (err.code === 'EADDRINUSE') {
					console.error(`✗ Port ${UI_SERVER_PORT} already in use`);
					// Giả sử server đã chạy ở process khác
					resolve(UI_SERVER_PORT);
				} else {
					console.error('✗ Failed to start UI server:', err);
					reject(err);
				}
			});
		} catch (err) {
			isStarting = false;
			reject(err);
		}
	});
}

/**
 * Stop UI server
 */
export function stopUIServer() {
	return new Promise((resolve) => {
		if (serverInstance) {
			serverInstance.close(() => {
				console.log('✓ UI Server stopped');
				serverInstance = null;
				resolve(true);
			});
		} else {
			resolve(false);
		}
	});
}

/**
 * Get server status
 */
export function getServerStatus() {
	return {
		isRunning: serverInstance !== null,
		isStarting,
		port: UI_SERVER_PORT,
	};
}

// Cleanup khi process exit
process.on('exit', () => {
	if (serverInstance) {
		serverInstance.close();
	}
});

process.on('SIGINT', async () => {
	await stopUIServer();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await stopUIServer();
	process.exit(0);
});
