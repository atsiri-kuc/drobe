/**
 * Compress an image file using canvas
 * @param {File} file - The image file to compress
 * @param {object} options - Compression options
 * @param {number} options.maxWidth - Max width in pixels (default: 800)
 * @param {number} options.maxHeight - Max height in pixels (default: 800)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.7)
 * @returns {Promise<File>} Compressed image file
 */
export function compressImage(file, options = {}) {
  const { maxWidth = 800, maxHeight = 800, quality = 0.7 } = options;

  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback to original
            return;
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original on error
    };

    img.src = url;
  });
}
