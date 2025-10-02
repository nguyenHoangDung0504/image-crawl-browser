// global.d.ts
export {};

declare global {
	interface Window {
		getCapturedImageURLs: () => Promise<string[]>;
		saveSelectedImages: (urls: string[], folderPath?: string) => Promise<void>;
	}
}
