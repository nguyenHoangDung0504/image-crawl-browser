import url from 'url';

export const BROWSER_CONFIG = /** @type {const}*/ ({
	executablePath: 'C:/Program Files/CocCoc/Browser/Application/browser.exe',
	userDataDir: 'C:/Users/MT Dũng/AppData/Local/CocCoc/Browser/User Data/',
});

const DEFAULT_STORAGE_RELATIVE_PATH = './storage';
export const STORAGE_CONFIG = {
	defaultStorage: url.fileURLToPath(import.meta.resolve(DEFAULT_STORAGE_RELATIVE_PATH)),
};
