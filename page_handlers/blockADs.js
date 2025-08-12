export default function blockADs() {
	disablePopup();
	disableOnbeforeunload();

	function disablePopup() {
		// Vô hiệu hóa window.open
		Object.defineProperty(window, 'open', {
			writable: false,
			configurable: false,
			value: () => {
				console.log('Chặn mở tab mới (window.open ghi đè mạnh mẽ)');
				return null;
			},
		});

		// Vô hiệu hóa thay đổi window.location đến các origin khác
		const originalAssign = window.location.assign;
		const originalReplace = window.location.replace;

		window.location.assign = function (url) {
			if (new URL(url, window.location.origin).origin !== window.location.origin) {
				console.log('Chặn chuyển hướng bằng location.assign:', url);
			} else {
				originalAssign.apply(window.location, arguments);
			}
		};

		window.location.replace = function (url) {
			if (new URL(url, window.location.origin).origin !== window.location.origin) {
				console.log('Chặn chuyển hướng bằng location.replace:', url);
			} else {
				originalReplace.apply(window.location, arguments);
			}
		};

		// Ghi đè anchor click để chặn các link khác origin
		document.addEventListener(
			'click',
			(event) => {
				const anchor = event.target.closest('a');
				if (anchor && anchor.href && new URL(anchor.href).origin !== window.location.origin) {
					console.log('Chặn link click:', anchor.href);
					event.preventDefault();
				}
			},
			true
		);

		// Chặn mở cửa sổ bằng target="_blank" hoặc các thuộc tính tương tự
		const originalAddEventListener = EventTarget.prototype.addEventListener;
		EventTarget.prototype.addEventListener = function (type, listener, options) {
			if (type === 'click') {
				const wrappedListener = function (event) {
					const anchor = event.target.closest('a');
					if (anchor && anchor.target === '_blank') {
						console.log('Chặn click mở tab mới:', anchor.href);
						event.preventDefault();
					} else {
						listener.call(this, event);
					}
				};
				return originalAddEventListener.call(this, type, wrappedListener, options);
			}
			return originalAddEventListener.call(this, type, listener, options);
		};
	}

	function disableOnbeforeunload() {
		// Vô hiệu hóa sự kiện beforeunload
		window.onbeforeunload = null;

		// Chặn thêm mới sự kiện beforeunload
		const originalAddEventListener = EventTarget.prototype.addEventListener;
		EventTarget.prototype.addEventListener = function (type, listener, options) {
			if (type === 'beforeunload') {
				console.log('Chặn sự kiện beforeunload');
				return;
			}
			return originalAddEventListener.call(this, type, listener, options);
		};
	}
}
