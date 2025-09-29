import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Đọc danh sách đen từ file blacklist-ads.txt và chuyển thành regex.
 */
export default function loadBlacklist() {
	const blacklistPath = path.join(__dirname, '/black-list-ADs.txt');
	if (!fs.existsSync(blacklistPath)) throw new Error('> [loadBlacklist] Blacklist path not found!');

	return fs
		.readFileSync(blacklistPath, 'utf-8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'))
		.map((pattern) => {
			const escapedPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
			return new RegExp(`^${escapedPattern}$`);
		});
}
