import CryptoJS from "crypto-js";

const SECRET = "ZIGMA_GLOBAL_IWMS_32BIT_KEY";

export const encryptSegment = (text: string): string => {
  const cipher = CryptoJS.AES.encrypt(text, SECRET).toString();
  // URL-safe encoding: replace problematic characters
  return cipher
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '~');
};

export const decryptSegment = (cipher: string): string | null => {
  try {
    // Reverse the URL-safe encoding
    const restored = cipher
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/~/g, '=');

    const bytes = CryptoJS.AES.decrypt(restored, SECRET);
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    return plain || null;
  } catch {
    return null;
  }
};
