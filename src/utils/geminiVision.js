import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!API_KEY) throw new Error('Missing VITE_GEMINI_API_KEY environment variable');
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
}

/**
 * Convert a File object to a Gemini-compatible inline data part
 */
function fileToGenerativePart(base64Data, mimeType) {
  return {
    inlineData: { data: base64Data, mimeType }
  };
}

/**
 * Read a File as base64 string
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Scan a clothing photo and return detected attributes
 * @param {File} imageFile - The image file to analyze
 * @returns {Promise<{category, subcategory, color, brand, confidence}>}
 */
export async function scanClothingItem(imageFile) {
  const gemini = getModel();
  const base64 = await readFileAsBase64(imageFile);
  const imagePart = fileToGenerativePart(base64, imageFile.type);

  const prompt = `You are a clothing identification expert. Analyze this image of a clothing item and return a JSON object with ONLY these fields:

{
  "name": "A short descriptive name for this item (e.g., 'Blue Oxford Shirt', 'Black Slim Jeans')",
  "category": "One of: Tops, Bottoms, Shoes, Outerwear, Accessories, Dresses, Activewear",
  "subcategory": "More specific type (e.g., T-Shirt, Button-Down, Sneakers, Hoodie, Blazer)",
  "color": "Primary color of the item (e.g., Navy, Black, White, Olive)",
  "brand": "Brand name if a logo or label is visible, otherwise null",
  "confidence": "high, medium, or low — your confidence in the identification"
}

Rules:
- Return ONLY valid JSON, no markdown, no code blocks, no explanation
- If you can't determine a field, use null
- Be specific with colors (Navy not Blue, Olive not Green)
- For name, be descriptive but concise (2-4 words)`;

  const result = await gemini.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();

  // Parse JSON, handling potential markdown code blocks
  let cleaned = text;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Gemini response:', text);
    return {
      name: 'Unknown Item',
      category: 'Tops',
      subcategory: null,
      color: null,
      brand: null,
      confidence: 'low'
    };
  }
}

/**
 * Scan multiple clothing photos in parallel (with rate limiting)
 * @param {File[]} files - Array of image files
 * @param {function} onProgress - Callback with (index, result)
 * @returns {Promise<Array>}
 */
export async function scanMultipleItems(files, onProgress) {
  const results = [];

  // Process 3 at a time to avoid rate limits
  for (let i = 0; i < files.length; i += 3) {
    const batch = files.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (file, batchIdx) => {
        const idx = i + batchIdx;
        try {
          const result = await scanClothingItem(file);
          onProgress?.(idx, { ...result, status: 'success' });
          return { ...result, status: 'success', fileIndex: idx };
        } catch (err) {
          console.error(`Error scanning file ${idx}:`, err);
          const fallback = {
            name: file.name.replace(/\.[^.]+$/, ''),
            category: 'Tops',
            subcategory: null,
            color: null,
            brand: null,
            confidence: 'low',
            status: 'error',
            fileIndex: idx
          };
          onProgress?.(idx, fallback);
          return fallback;
        }
      })
    );
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + 3 < files.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}
