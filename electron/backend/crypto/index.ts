/**
 * 加密模块统一导出
 * 
 * 提供两种加密方案：
 * 1. simple.ts - PBKDF2 密码哈希（用于账户密码验证，无需解密）
 * 2. hybrid.ts - 混合加密（用于敏感数据加密/解密）
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
  isHybridEncrypted
} from './hybrid'

// RSA 加密功能（底层）
export {
  setCachedPrivateKey,
  setCachedPublicKey,
  loadPrivateKey,
  loadPublicKey,
  hasKeyPair,
  clearKeyCache,
  privateEncrypt,
  publicDecrypt,
  isEncrypted,
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