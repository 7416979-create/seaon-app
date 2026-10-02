import 'package:geolocator/geolocator.dart';

/// 위치 모킹 감지 서비스
/// GPS 스푸핑 감지 및 위치 신뢰도 검증
class MockLocationDetector {
  static const double UNREALISTIC_SPEED = 300; // km/h
  static const double SUSPICIOUS_ACCURACY = 5.0; // meters

  static Future<LocationTrustLevel> analyzeTrust(Position position) async {
    // 1. 정확도 검사
    if (position.accuracy > 1000) {
      return LocationTrustLevel.low;
    }

    // 2. 속도 검사
    if (position.speed > UNREALISTIC_SPEED) {
      return LocationTrustLevel.suspicious;
    }

    // 3. 고도 데이터 검사
    if (position.altitude < -500 || position.altitude > 9000) {
      return LocationTrustLevel.suspicious;
    }

    // 4. GPS 신호 강도 검사
    if (position.speedAccuracy > 50) {
      return LocationTrustLevel.medium;
    }

    // 5. 위도/경도 이상 값 검사
    if (position.latitude < -90 || position.latitude > 90 ||
        position.longitude < -180 || position.longitude > 180) {
      return LocationTrustLevel.suspicious;
    }

    return LocationTrustLevel.high;
  }

  static Future<bool> isLocationSpoofed(
    Position currentPosition,
    Position? previousPosition,
    Duration timeDifference,
  ) async {
    if (previousPosition == null) return false;

    // 두 위치 간의 거리 계산
    final distance = Geolocator.distanceBetween(
      previousPosition.latitude,
      previousPosition.longitude,
      currentPosition.latitude,
      currentPosition.longitude,
    );

    // 경과 시간 (초)
    final seconds = timeDifference.inSeconds;

    // 실제 속도 계산 (m/s)
    final actualSpeed = distance / seconds;

    // 음속을 초과하는 속도는 의심스러움 (343 m/s)
    if (actualSpeed > 343) {
      return true;
    }

    // 비정상적인 가속도 확인
    final previousSpeed = previousPosition.speed;
    final speedDifference = (actualSpeed - previousSpeed).abs();
    if (speedDifference > 50) {
      return true;
    }

    return false;
  }

  static Future<Map<String, dynamic>> generateLocationReport(
    Position position,
  ) async {
    final trustLevel = await analyzeTrust(position);

    return {
      'timestamp': DateTime.now(),
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'speed': position.speed,
      'speed_accuracy': position.speedAccuracy,
      'heading': position.heading,
      'trust_level': trustLevel.toString(),
      'is_likely_spoofed': trustLevel == LocationTrustLevel.suspicious,
      'verification_details': {
        'accuracy_check': position.accuracy <= SUSPICIOUS_ACCURACY,
        'speed_check': position.speed <= UNREALISTIC_SPEED,
        'altitude_check': position.altitude >= -500 && position.altitude <= 9000,
        'coordinates_valid': position.latitude >= -90 &&
            position.latitude <= 90 &&
            position.longitude >= -180 &&
            position.longitude <= 180,
      },
    };
  }
}

enum LocationTrustLevel {
  high,
  medium,
  low,
  suspicious,
}

extension LocationTrustLevelExtension on LocationTrustLevel {
  String get displayName {
    switch (this) {
      case LocationTrustLevel.high:
        return '높음 - 신뢰할 수 있음';
      case LocationTrustLevel.medium:
        return '중간 - 주의 필요';
      case LocationTrustLevel.low:
        return '낮음 - 부정확';
      case LocationTrustLevel.suspicious:
        return '의심스러움 - 모킹 가능성';
    }
  }

  Color get color {
    switch (this) {
      case LocationTrustLevel.high:
        return const Color(0xFF4CAF50);
      case LocationTrustLevel.medium:
        return const Color(0xFFFFC107);
      case LocationTrustLevel.low:
        return const Color(0xFFFF9800);
      case LocationTrustLevel.suspicious:
        return const Color(0xFFF44336);
    }
  }
}
