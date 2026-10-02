# SEAON 근태관리 시스템 (HR Attendance App)

완전한 기능의 Flutter 기반 근태관리 시스템으로, GPS 위치 기반, WiFi 인증, 2FA, 고급 암호화, 오프라인 동기화 기능을 제공합니다.

## 주요 기능

- **GPS 기반 위치 확인**: 정확한 위치 추적으로 출퇴근 기록
- **WiFi 인증**: 회사 WiFi를 통한 추가 인증
- **2FA (2단계 인증)**: 보안 강화
- **디지털 서명**: 서명 기반 확인
- **고급 암호화**: AES 암호화로 데이터 보호
- **오프라인 동기화**: 인터넷 미연결 시에도 데이터 자동 저장
- **백그라운드 GPS 추적**: 앱을 닫아도 GPS 추적 계속
- **로컬 알림**: 중요 이벤트 알림

## 시스템 요구사항

### 빌드 환경
- Flutter 3.0+
- Dart 3.0+
- Android SDK (API Level 21+)
- Java Development Kit (JDK 8+)
- Gradle 7.0+

### 런타임 요구사항
- Android 5.0+ (API Level 21)
- iOS 12.0+

## 설치 방법

### 1. 필수 도구 설치 (Windows)

#### Flutter 설치
```bash
# https://flutter.dev/docs/get-started/install/windows 에서 Flutter SDK 다운로드
# 압축 해제 후 PATH에 추가

flutter --version
```

#### Android SDK 설치
```bash
# Android Studio 또는 Command line tools 설치
# ANDROID_HOME 환경 변수 설정
```

#### Java 설치
```bash
# JDK 8 또는 11 설치
# JAVA_HOME 환경 변수 설정
```

### 2. 프로젝트 준비

```bash
cd C:\Users\A\Desktop\seaon_attendance

# 의존성 설치
flutter pub get

# 코드 생성 (암호화 등)
flutter pub run build_runner build
```

### 3. APK 빌드

```bash
# 릴리스 APK 빌드
flutter build apk --release

# 출력 위치
# C:\Users\A\Desktop\seaon_attendance\build\app\outputs\flutter-apk\app-release.apk
```

## Firebase 배포

### 1. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Android 앱 등록
3. `google-services.json` 파일 다운로드
4. 파일을 `android/app/` 디렉토리에 복사

### 2. Google Play Console 설정

1. Google Play Developer Account 생성
2. 앱 서명 키 생성
3. 스토어 정보 입력

### 3. 앱 배포

```bash
# 프로덕션 릴리스 빌드
flutter build appbundle --release

# Google Play Console에서 업로드
```

## Firebase App Distribution

### 테스터 초대

```bash
firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk \
  --app 1:123456789:android:abcdef \
  --release-notes "Release Notes" \
  --testers 7416979@gmail.com
```

## 설정 파일

### pubspec.yaml
모든 의존성과 프로젝트 설정이 포함되어 있습니다.

### AndroidManifest.xml
- GPS, WiFi 권한
- 카메라 권한 (서명용)
- 백그라운드 서비스 권한
- 알림 권한

### Info.plist (iOS)
- 위치 사용 설명
- 카메라 사용 설명
- 알림 사용 설명

## 개발 팁

### 로그 확인
```bash
flutter logs
```

### 디버그 빌드
```bash
flutter run -v
```

### 핸드폰에서 테스트
```bash
flutter run --release
```

## 파일 구조

```
seaon_attendance/
├── lib/
│   ├── main.dart                          # 메인 앱
│   ├── services/
│   │   ├── signature_service.dart         # 서명 관련
│   │   ├── mock_location_detection.dart   # 위치 모킹 감지
│   │   ├── advanced_encryption_service.dart  # 암호화
│   │   └── offline_sync_service.dart      # 오프라인 동기화
│   ├── screens/                            # UI 화면
│   ├── models/                             # 데이터 모델
│   └── utils/                              # 유틸리티
├── android/                                # Android 설정
├── ios/                                    # iOS 설정
├── assets/                                 # 이미지, 아이콘 등
└── pubspec.yaml                           # 의존성 정의

```

## 트러블슈팅

### Flutter 명령어를 찾을 수 없음
```bash
# Flutter SDK 경로 확인
flutter doctor

# PATH에 Flutter/bin 추가 (Windows)
# C:\path\to\flutter\bin을 시스템 PATH에 추가
```

### Android SDK 경로 오류
```bash
# android/local.properties 확인
# sdk.dir 경로가 올바른지 확인
```

### 빌드 실패
```bash
# 캐시 정리
flutter clean

# 의존성 재설치
flutter pub get

# 다시 빌드
flutter build apk --release
```

## 라이선스

이 프로젝트는 SEAON에 의해 개발되었습니다.

## 지원

문제가 발생하면 Firebase Console의 Crashlytics를 확인하세요.

---
마지막 업데이트: 2026-10-01
