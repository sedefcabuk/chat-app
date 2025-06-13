// ==== Yardımcı Fonksiyonlar ====

export function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function ab2base64(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

function base642ab(base64) {
  const byteString = atob(base64);
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==== Anahtar İşlemleri ====

export async function generateKeys() {
  const existingPublic = localStorage.getItem("userPublicKey");
  const existingPrivate = localStorage.getItem("userPrivateKey");

  if (existingPublic && existingPrivate) {
    return {
      publicKey: existingPublic,
      privateKey: existingPrivate,
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
    };
  } catch (error) {
    console.error("Anahtar oluşturma hatası:", error);
    alert("Anahtar oluşturulamadı: " + error.message);
  }
}

function getPrivateKey() {
  return localStorage.getItem("userPrivateKey");
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

export async function encryptMessage(message, publicKeyJwkStr) {
  try {
    if (!publicKeyJwkStr) {
      alert("Lütfen alıcının açık anahtarını girin.");
      return;
    }
    if (!message) {
      alert("Lütfen şifrelenecek bir mesaj girin.");
      return;
    }

    let publicKeyJwk;
    try {
      publicKeyJwk = JSON.parse(publicKeyJwkStr);
      if (!publicKeyJwk.kty || publicKeyJwk.kty !== "RSA") {
        throw new Error("Geçersiz açık anahtar formatı.");
      }
    } catch (e) {
      alert("Açık anahtar geçersiz ya da hatalı formatta.");
      return;
    }

    const publicKey = await window.crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    const aesKey = await generateAesKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    const encryptedMessageBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encodedMessage
    );

    const rawAesKey = await exportAesKeyRaw(aesKey);

    const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawAesKey
    );

    const payload = {
      encryptedAesKey: ab2base64(encryptedAesKeyBuffer),
      iv: ab2base64(iv.buffer),
      encryptedMessage: ab2base64(encryptedMessageBuffer),
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error("Şifreleme hatası:", error);
    alert("Mesaj şifrelenemedi: " + error.message);
  }
}

// ==== Mesaj Çözme ====

export async function decryptMessage(encryptedBase64) {
  try {
    const privateKeyJwkStr = getPrivateKey();
    if (!privateKeyJwkStr) {
      alert(
        "Bu cihazda gizli anahtar bulunamadı. Lütfen önce anahtar oluşturun."
      );
      return;
    }

    if (!encryptedBase64) {
      alert("Lütfen çözülecek şifreli mesajı girin.");
      return;
    }

    const privateKeyJwk = JSON.parse(privateKeyJwkStr);

    const privateKey = await window.crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    const payload = JSON.parse(encryptedBase64);

    const encryptedAesKeyBuffer = base642ab(payload.encryptedAesKey);
    const iv = new Uint8Array(base642ab(payload.iv));
    const encryptedMessageBuffer = base642ab(payload.encryptedMessage);

    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBuffer
    );

    const aesKey = await importAesKeyRaw(rawAesKey);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encryptedMessageBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("Çözme hatası:", error);
    alert("Mesaj çözülemedi: " + error.message);
  }
}
