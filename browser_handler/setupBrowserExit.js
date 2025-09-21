/**
 * Đảm bảo thoát chương trình an toàn, chỉ gọi exit một lần.
 * @param {import('puppeteer').Browser} browser - Instance trình duyệt Puppeteer.
 */
export default function setupBrowserExit(browser) {
	let isExiting = false;

	async function exitSafely(code = 0) {
		if (isExiting) return;
		isExiting = true;

		console.log('\n> [Info] Đang thoát chương trình...');

		try {
			if (browser?.connected) {
				console.log('> [Info] Đang đóng trình duyệt...');

				// Nếu dùng userDataDir thật thì nên kill process thay vì close
				const browserProcess = browser.process();
				if (browserProcess) browserProcess.kill('SIGTERM'); // cho phép browser tự shutdown an toàn
				else await browser.close(); // fallback nếu không lấy được process
			}
		} catch (err) {
			console.warn('> [Warn] Đóng trình duyệt thất bại:', err.message);
			code = 1;
		} finally {
			setTimeout(() => process.exit(code), 500); // delay nhẹ để tránh exit trước khi browser flush
		}
	}

	process.on('SIGINT', () => {
		console.log('\n> [Info] Ctrl+C được gửi');
		exitSafely(0);
	});

	process.on('SIGTERM', () => {
		console.log('\n> [Info] SIGTERM được gửi');
		exitSafely(0);
	});

	process.on('uncaughtException', (err) => {
		console.error('> [Error] Lỗi chưa xử lý:', err);
		exitSafely(1);
	});

	browser.on('disconnected', () => {
		if (isExiting) return;
		console.log('\n> [Info] Trình duyệt đã đóng. Chờ thoát.');
	});

	return browser;
}
