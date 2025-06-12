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
        modulusLength: 2048, // Anahtar boyutu, 2048 veya 4096 önerilir
        publicExponent: new Uint8Array([1, 0, 1]), // Genellikle 65537 (0x010001)
        hash: "SHA-256", // Şifreleme işleminde kullanılacak hash algoritması
      },
      true, // Anahtarın export edilebilir olup olmadığı
      ["encrypt", "decrypt"] // Anahtarın kullanım amaçları
    );

    // Anahtarları JWK (JSON Web Key) formatına çevirelim (paylaşım ve saklama için daha uygun)
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

// 2. Mesaj Şifreleme
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

    // JWK formatındaki açık anahtarı CryptoKey objesine dönüştür
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

    const encoder = new TextEncoder(); // Mesajı Uint8Array'e çevirmek için
    const encodedMessage = encoder.encode(message);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      encodedMessage
    );

    // Şifrelenmiş veriyi base64 formatında gösterelim (taşıması daha kolay)
    const encryptedBase64 = ab2base64(encryptedBuffer);
    return encryptedBase64;
  } catch (error) {
    console.error("Şifreleme hatası:", error);
    alert(
      "Mesaj şifrelenemedi: " +
        error.message +
        "\n Girilen açık anahtarın doğru formatta (JWK) ve RSA-OAEP için uygun olduğundan emin olun."
    );
  }
}

function getPrivateKey() {
  return localStorage.getItem("userPrivateKey");
}
// 3. Mesaj Çözme
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

    // JWK formatındaki gizli anahtarı CryptoKey objesine dönüştür
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

    const encryptedBuffer = base642ab(encryptedBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder(); // Çözülmüş Uint8Array'i metne çevirmek için
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
