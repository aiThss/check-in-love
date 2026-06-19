// ── Camera / Gallery ──────────────────────────────────────────────────────────
// ── Image compression ─────────────────────────────────────────────────────────
async function compressImage(file, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;
            // Resize if too large
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to compress image'));
                    return;
                }
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
                const preview = canvas.toDataURL('image/jpeg', quality);
                resolve({ file: compressedFile, preview });
            }, 'image/jpeg', quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
        };
        img.src = objectUrl;
    });
}
// ── File picker helper ────────────────────────────────────────────────────────
function createFileInput(accept, capture) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) {
        input.setAttribute('capture', capture);
    }
    input.style.cssText = 'position:absolute;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
    document.body.appendChild(input);
    return input;
}
async function handleFileSelection(input, onResult) {
    return new Promise((resolve) => {
        input.onchange = async () => {
            const file = input.files?.[0];
            document.body.removeChild(input);
            if (!file) {
                resolve();
                return;
            }
            try {
                const { file: compressed, preview } = await compressImage(file);
                onResult({ file: compressed, preview });
            }
            catch {
                // Fallback: use original file with data URL preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    onResult({
                        file,
                        preview: e.target?.result,
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
                return;
            }
            resolve();
        };
        // Handle cancel
        input.oncancel = () => {
            document.body.removeChild(input);
            resolve();
        };
        input.click();
    });
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Opens device camera (back camera preferred) and returns compressed image.
 */
export function openCamera(onResult) {
    const input = createFileInput('image/*', 'environment');
    handleFileSelection(input, onResult);
}
/**
 * Opens photo gallery picker and returns compressed image.
 */
export function openGallery(onResult) {
    const input = createFileInput('image/*');
    handleFileSelection(input, onResult);
}
