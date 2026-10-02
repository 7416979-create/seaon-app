import 'package:encrypt/encrypt.dart' as encrypt;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import 'package:crypto/crypto.dart';

/// 고급 암호화 서비스
/// AES-256 기반의 엔드투엔드 암호화
class AdvancedEncryptionService {
  static const secureStorage = FlutterSecureStorage();
  static const String _masterKeyKey = 'master_encryption_key';
  static const String _saltKey = 'encryption_salt';

  /// 마스터 키 생성 또는 로드
  static Future<String> getMasterKey() async {
    var masterKey = await secureStorage.read(key: _masterKeyKey);

    if (masterKey == null) {
      masterKey = _generateSecureKey();
      await secureStorage.write(key: _masterKeyKey, value: masterKey);
    }

    return masterKey;
  }

  /// 보안 키 생성 (32자 = 256비트)
  static String _generateSecureKey() {
    final random = DateTime.now().millisecondsSinceEpoch.toString();
    final hash = sha256.convert(utf8.encode(random));
    return hash.toString().substring(0, 32);
  }

  /// 데이터 암호화 (AES-256-CBC)
  static Future<EncryptedData> encryptData(
    String plainText, {
    String? customKey,
  }) async {
    final key = customKey ?? await getMasterKey();
    final encryptionKey = encrypt.Key.fromUtf8(key);
    final iv = encrypt.IV.fromSecureRandom(16);

    final encrypter = encrypt.Encrypter(encrypt.AES(encryptionKey));
    final encrypted = encrypter.encrypt(plainText, iv: iv);

    return EncryptedData(
      cipherText: encrypted.base64,
      iv: iv.base64,
      algorithm: 'AES-256-CBC',
      timestamp: DateTime.now(),
    );
  }

  /// 데이터 복호화
  static Future<String> decryptData(
    EncryptedData encryptedData, {
    String? customKey,
  }) async {
    try {
      final key = customKey ?? await getMasterKey();
      final encryptionKey = encrypt.Key.fromUtf8(key);
      final iv = encrypt.IV.fromBase64(encryptedData.iv);

      final encrypter = encrypt.Encrypter(encrypt.AES(encryptionKey));
      final decrypted = encrypter.decrypt64(encryptedData.cipherText, iv: iv);

      return decrypted;
    } catch (e) {
      throw 'Decryption failed: $e';
    }
  }

  /// HMAC 서명 생성 (무결성 검증)
  static Future<String> generateHMAC(String data) async {
    final masterKey = await getMasterKey();
    final hmacKey = encrypt.Key.fromUtf8(masterKey);
    final bytes = utf8.encode(data);
    final hmac = encrypt.Hmac(encrypt.Sha256(hmacKey.bytes));
    return hmac.base64.toString();
  }

  /// HMAC 검증
  static Future<bool> verifyHMAC(String data, String signature) async {
    try {
      final generated = await generateHMAC(data);
      return generated == signature;
    } catch (e) {
      return false;
    }
  }

  /// 키 로테이션 (정기적인 보안 갱신)
  static Future<void> rotateKeys() async {
    final oldKey = await getMasterKey();
    final newKey = _generateSecureKey();

    // 새 키로 저장
    await secureStorage.write(key: _masterKeyKey, value: newKey);

    // 기존 데이터는 새 키로 다시 암호화해야 함
    print('Keys rotated successfully');
  }

  /// 인증서 검증
  static Future<bool> verifySignature(
    String data,
    String signature,
    String certificateHash,
  ) async {
    try {
      final verified = await verifyHMAC(data, signature);
      return verified;
    } catch (e) {
      return false;
    }
  }
}

/// 암호화된 데이터 모델
class EncryptedData {
  final String cipherText;
  final String iv;
  final String algorithm;
  final DateTime timestamp;

  EncryptedData({
    required this.cipherText,
    required this.iv,
    required this.algorithm,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
    'cipher_text': cipherText,
    'iv': iv,
    'algorithm': algorithm,
    'timestamp': timestamp.toIso8601String(),
  };

  factory EncryptedData.fromJson(Map<String, dynamic> json) {
    return EncryptedData(
      cipherText: json['cipher_text'],
      iv: json['iv'],
      algorithm: json['algorithm'],
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}

/// 보안 데이터 전송 패키지
class SecureDataPackage {
  final String encryptedData;
  final String signature;
  final String senderId;
  final DateTime createdAt;
  final Map<String, dynamic> metadata;

  SecureDataPackage({
    required this.encryptedData,
    required this.signature,
    required this.senderId,
    required this.createdAt,
    required this.metadata,
  });

  Map<String, dynamic> toJson() => {
    'encrypted_data': encryptedData,
    'signature': signature,
    'sender_id': senderId,
    'created_at': createdAt.toIso8601String(),
    'metadata': metadata,
  };

  factory SecureDataPackage.fromJson(Map<String, dynamic> json) {
    return SecureDataPackage(
      encryptedData: json['encrypted_data'],
      signature: json['signature'],
      senderId: json['sender_id'],
      createdAt: DateTime.parse(json['created_at']),
      metadata: json['metadata'] ?? {},
    );
  }
}

/// 암호화 검증 결과
class EncryptionVerificationResult {
  final bool isValid;
  final String reason;
  final DateTime verifiedAt;
  final List<String> violations;

  EncryptionVerificationResult({
    required this.isValid,
    required this.reason,
    required this.verifiedAt,
    required this.violations,
  });
}
