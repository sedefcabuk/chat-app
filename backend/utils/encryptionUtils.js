const crypto = require("crypto");
const NodeRSA = require("node-rsa");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const privateKey = fs.readFileSync(
  path.resolve(process.env.PRIVATE_KEY_PATH),
  "utf8"
);
const publicKey = fs.readFileSync(
  path.resolve(process.env.PUBLIC_KEY_PATH),
  "utf8"
);

const rsa = new NodeRSA();
rsa.importKey(publicKey, "pkcs8-public-pem");

const rsaPrivate = new NodeRSA();
rsaPrivate.importKey(privateKey, "pkcs8-private-pem");

// AES ile şifreleme
function hybridEncrypt(message) {
  // 1. Rastgele AES anahtarı ve IV oluştur
  const aesKey = crypto.randomBytes(32); // 256-bit AES
  const iv = crypto.randomBytes(16); // 128-bit IV

  // 2. Mesajı AES ile şifrele
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  let encrypted = cipher.update(message, "utf8", "base64");
  encrypted += cipher.final("base64");

  // 3. AES anahtarını RSA ile şifrele
  const encryptedKey = rsa.encrypt(aesKey, "base64");

  return {
    encryptedMessage: encrypted,
    encryptedKey,
    iv: iv.toString("base64"),
  };
}

// AES ile çözme
function hybridDecrypt(encryptedMessage, encryptedKey, ivBase64) {
  try {
    // 1. RSA ile AES anahtarını çöz
    const aesKey = rsaPrivate.decrypt(Buffer.from(encryptedKey, "base64"));

    // 2. Mesajı AES ile çöz
    const iv = Buffer.from(ivBase64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
    let decrypted = decipher.update(encryptedMessage, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Hibrit çözme hatası:", err);
    return "";
  }
}

module.exports = { hybridEncrypt, hybridDecrypt };
