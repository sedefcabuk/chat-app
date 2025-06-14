export function str2ab(str) {
  if (typeof str !== "string") {
    throw new Error("Giriş bir string olmalı.");
  }
  return new TextEncoder().encode(str).buffer;
}

export function ab2str(buf) {
  return new TextDecoder().decode(buf);
}

function ab2base64(buffer) {
  const uint8Array = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function base642ab(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==== Anahtar İşlemleri ====

export async function getStoredKeys() {
  const publicKeyStr = localStorage.getItem("userPublicKey");
  const privateKeyStr = localStorage.getItem("userPrivateKey");

  if (!publicKeyStr || !privateKeyStr) {
    console.warn("LocalStorage'da anahtarlar bulunamadı.");
    return null;
  }

  try {
    const publicKeyJwk = JSON.parse(publicKeyStr);
    const privateKeyJwk = JSON.parse(privateKeyStr);

    if (
      !publicKeyJwk.kty ||
      publicKeyJwk.kty !== "RSA" ||
      !privateKeyJwk.kty ||
      privateKeyJwk.kty !== "RSA" ||
      !publicKeyJwk.n ||
      !publicKeyJwk.e ||
      !privateKeyJwk.d
    ) {
      console.error("Anahtar formatı RSA JWK değil veya eksik alanlar var.");
      return null;
    }

    const publicKey = await window.crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    const privateKey = await window.crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    return { publicKey, privateKey };
  } catch (e) {
    console.error("Anahtarları içe aktarma hatası:", e);
    return null;
  }
}

export async function generateKeys() {
  const existingKeys = await getStoredKeys();
  if (existingKeys) {
    return {
      publicKey: localStorage.getItem("userPublicKey"),
      privateKey: localStorage.getItem("userPrivateKey"),
      publicKeyObj: existingKeys.publicKey,
      privateKeyObj: existingKeys.privateKey,
    };
  }

  try {
    const userKeyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKeyJwk = await window.crypto.subtle.exportKey(
      "jwk",
      userKeyPair.publicKey
    );
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      "jwk",
      userKeyPair.privateKey
    );

    localStorage.setItem("userPublicKey", JSON.stringify(publicKeyJwk));
    localStorage.setItem("userPrivateKey", JSON.stringify(privateKeyJwk));

    return {
      publicKey: JSON.stringify(publicKeyJwk),
      privateKey: JSON.stringify(privateKeyJwk),
      publicKeyObj: userKeyPair.publicKey,
      privateKeyObj: userKeyPair.privateKey,
    };
  } catch (error) {
    console.error("Anahtar oluşturma hatası:", error);
    throw new Error("Anahtar oluşturulamadı: " + error.message);
  }
}

// ==== AES İşlemleri ====

async function generateAesKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function exportAesKeyRaw(aesKey) {
  return await window.crypto.subtle.exportKey("raw", aesKey);
}

async function importAesKeyRaw(rawKey) {
  return await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );
}

// ==== Mesaj Şifreleme ====

export async function encryptMessage(message, publicKeysJwkStrArray) {
  if (
    !publicKeysJwkStrArray ||
    !Array.isArray(publicKeysJwkStrArray) ||
    publicKeysJwkStrArray.length === 0
  ) {
    throw new Error("En az bir alıcının açık anahtarı girilmeli.");
  }
  if (!message) {
    throw new Error("Şifrelenecek mesaj boş olamaz.");
  }

  // Anahtarları doğrula ve içe aktar
  const publicKeys = [];
  for (const keyStr of publicKeysJwkStrArray) {
    let keyJwk;
    try {
      keyJwk = JSON.parse(keyStr);
    } catch {
      throw new Error("Açık anahtar JSON formatı geçersiz.");
    }
    if (!keyJwk.kty || keyJwk.kty !== "RSA" || !keyJwk.n || !keyJwk.e) {
      throw new Error(
        "Geçersiz açık anahtar formatı (RSA değil veya eksik alanlar)."
      );
    }
    const importedKey = await window.crypto.subtle.importKey(
      "jwk",
      keyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
    publicKeys.push(importedKey);
  }

  // AES anahtar oluştur ve mesajı şifrele
  const aesKey = await generateAesKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(message);

  const encryptedMessageBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encodedMessage
  );

  const rawAesKey = await exportAesKeyRaw(aesKey);

  // AES anahtarını her açık anahtarla şifrele
  const encryptedAesKeys = [];
  for (const publicKey of publicKeys) {
    const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawAesKey
    );
    encryptedAesKeys.push(ab2base64(encryptedAesKeyBuffer));
  }

  const payload = {
    encryptedAesKeys,
    iv: ab2base64(iv.buffer),
    encryptedMessage: ab2base64(encryptedMessageBuffer),
  };

  return JSON.stringify(payload);
}

// ==== Mesaj Çözme ====

export async function decryptMessage(encryptedBase64, receiverIndex = 0) {
  const storedKeys = await getStoredKeys();
  if (!storedKeys) {
    throw new Error(
      "Bu cihazda gizli anahtar bulunamadı. Lütfen önce anahtar oluşturun."
    );
  }
  const privateKey = storedKeys.privateKey;

  if (!encryptedBase64) {
    throw new Error("Çözülecek şifreli mesaj boş olamaz.");
  }

  let payload;
  try {
    payload = JSON.parse(encryptedBase64);
  } catch {
    throw new Error("Şifreli mesaj JSON formatı geçersiz.");
  }

  if (
    !Array.isArray(payload.encryptedAesKeys) ||
    !payload.iv ||
    !payload.encryptedMessage
  ) {
    throw new Error(
      "Şifreli mesaj formatı geçersiz: Eksik veya hatalı alanlar."
    );
  }

  if (receiverIndex < 0 || receiverIndex >= payload.encryptedAesKeys.length) {
    throw new Error("Alıcı indeksi geçersiz.");
  }

  const encryptedAesKeyBuffer = base642ab(
    payload.encryptedAesKeys[receiverIndex]
  );
  const iv = new Uint8Array(base642ab(payload.iv));
  const encryptedMessageBuffer = base642ab(payload.encryptedMessage);

  // AES anahtarını RSA ile çöz
  const rawAesKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedAesKeyBuffer
  );

  const aesKey = await importAesKeyRaw(rawAesKey);

  // Mesajı AES ile çöz
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encryptedMessageBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}
