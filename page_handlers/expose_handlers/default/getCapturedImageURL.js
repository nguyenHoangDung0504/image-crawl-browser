import { getPageImageRegistry } from '../../../resources/registries.js';

/**
 * @param {import('puppeteer').Page} page
 */
export default function getCapturedImageURLs(page) {
	const imageReg = getPageImageRegistry(page);
	return [...imageReg.keys()];
}
