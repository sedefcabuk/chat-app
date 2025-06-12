// Metni ArrayBuffer'a dönüştürme
export function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// ArrayBuffer'ı metne dönüştürme
export function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

// ArrayBuffer'ı Base64'e dönüştürme
function ab2base64(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

// Base64'ü ArrayBuffer'a dönüştürme
function base642ab(base64) {
  const byteString = atob(base64);
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 1. Anahtar Çifti Oluşturma
export async function generateKeys() {
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

// AES anahtarı oluşturma
async function generateAesKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// AES anahtarını raw formatına çevirme (ArrayBuffer)
async function exportAesKeyRaw(aesKey) {
  return await window.crypto.subtle.exportKey("raw", aesKey);
}

// Raw AES anahtarını import etme
async function importAesKeyRaw(rawKey) {
  return await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );
}

// 2. Mesaj Şifreleme (Hibrit)
// Mesajı AES ile şifrele, AES anahtarını RSA ile şifrele ve ikisini birlikte base64'le döndür
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

    const publicKeyJwk = JSON.parse(publicKeyJwkStr);

    const publicKey = await window.crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );

    // 1. AES anahtarı oluştur
    const aesKey = await generateAesKey();

    // 2. Mesajı AES-GCM ile şifrele (iv gerekiyor)
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit iv

    const encryptedMessageBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      encodedMessage
    );

    // 3. AES anahtarını raw formatta al
    const rawAesKey = await exportAesKeyRaw(aesKey);

    // 4. AES anahtarını RSA ile şifrele
    const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      rawAesKey
    );

    // 5. Bileşenleri base64'e çevir
    const encryptedAesKeyBase64 = ab2base64(encryptedAesKeyBuffer);
    const ivBase64 = ab2base64(iv.buffer);
    const encryptedMessageBase64 = ab2base64(encryptedMessageBuffer);

    // 6. JSON objesi olarak döndür (iv, encryptedKey, encryptedMessage)
    const payload = {
      encryptedAesKey: encryptedAesKeyBase64,
      iv: ivBase64,
      encryptedMessage: encryptedMessageBase64,
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error("Şifreleme hatası:", error);
    alert(
      "Mesaj şifrelenemedi: " +
        error.message +
        "\n Girilen açık anahtarın doğru formatta (JWK) ve RSA-OAEP için uygun olduğundan emin olun."
    );
  }
}

// 3. Mesaj Çözme (Hibrit)
// RSA ile AES anahtarını çöz, sonra AES-GCM ile mesajı çöz
export async function decryptMessage(encryptedBase64) {
  try {
    const privateKeyJwkStr = getPrivateKey();

    if (!privateKeyJwkStr) {
      alert("Lütfen kullanıcının gizli anahtarını girin.");
      return;
    }
    if (!encryptedBase64) {
      alert("Lütfen çözülecek şifreli bir mesaj girin.");
      return;
    }

    const privateKeyJwk = JSON.parse(privateKeyJwkStr);

    const privateKey = await window.crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );

    // JSON string'i parse et
    const payload = JSON.parse(encryptedBase64);

    const encryptedAesKeyBuffer = base642ab(payload.encryptedAesKey);
    const iv = new Uint8Array(base642ab(payload.iv));
    const encryptedMessageBuffer = base642ab(payload.encryptedMessage);

    // 1. AES anahtarını RSA ile çöz
    const rawAesKey = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      encryptedAesKeyBuffer
    );

    // 2. Raw AES anahtarını CryptoKey objesine çevir
    const aesKey = await importAesKeyRaw(rawAesKey);

    // 3. AES-GCM ile mesajı çöz
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      encryptedMessageBuffer
    );

    const decoder = new TextDecoder();
    const decryptedMessage = decoder.decode(decryptedBuffer);
    return decryptedMessage;
  } catch (error) {
    console.error("Çözme hatası:", error);
    alert(
      "Mesaj çözülemedi: " +
        error.message +
        "\n Girilen gizli anahtarın doğru formatta (JWK) ve bu mesajı şifreleyen açık anahtarın eşi olduğundan emin olun."
    );
  }
}
