/**
 * 加密模块统一导出
 * 
 * 提供两种加密方案：
 * 1. simple.ts - PBKDF2 密码哈希（用于账户密码验证，无需解密）
 * 2. hybrid.ts - 混合加密（用于敏感数据加密/解密）
 * 
 * 新方案（正确用法）：
 * - 加密：公钥加密（保护数据）
 * - 解密：私钥解密（需要私钥才能解密）
 */

// 密码哈希功能（用于账户密码）
export { 
  hashPassword, 
  verifyPassword, 
  generateSalt 
} from './simple'

// 混合加密功能（用于敏感数据）
export {
  hybridEncrypt,
  hybridDecrypt,
  isHybridEncrypted,
  // Token 分享专用
  symmetricEncrypt,
  symmetricDecrypt,
  generateSymmetricKey,
  isSymmetricEncrypted
} from './hybrid'

// RSA 加密功能（底层）
export {
  // 密钥管理
  setCachedPrivateKey,
  setCachedPublicKey,
  loadPrivateKey,
  loadPublicKey,
  hasKeyPair,
  clearKeyCache,
  // 新方案（推荐）
  publicEncrypt,
  publicEncryptWithKey,
  privateDecrypt,
  privateDecryptWithKey,
  // 旧方案（兼容）
  privateEncrypt,
  publicDecrypt,
  publicDecryptWithKey,
  // 辅助函数
  isEncrypted,
  isOldFormatEncrypted,
  isNewFormatEncrypted,
  encryptIfNeeded,
  decryptIfNeeded
} from './rsa'

// 安全密钥存储（密钥生成和管理）
export {
  isEncryptionAvailable,
  generateKeyPair,
  saveKeyPair,
  initializeKeyPair,
  clearPrivateKeyCache,
  deleteKeyPair,
  getKeyStatus,
  getKeysDirectory,
  getPrivateKeyPath,
  getPublicKeyPath
} from './secureKeyStorage'