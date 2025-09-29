/** @type {Map<import('puppeteer').Page, Map<string, Buffer>>} */
export const pageImageRegistries = new Map();

/**
 * @param {import('puppeteer').Page} page
 */
export function getPageImageRegistry(page) {
	const imageReg = pageImageRegistries.get(page);

	if (!imageReg) {
		console.clear();
		throw new Error('\t> [Error] Lỗi bất định, không lấy được kết quả get image registry từ page image registry');
	}

	return imageReg;
}
