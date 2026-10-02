# 빠른 시작 가이드 - SEAON 근태관리 APK 빌드

**상태: 프로젝트 구조 완성 ✓**

## 현재까지 완료된 작업

- ✓ Flutter 프로젝트 구조 생성
- ✓ 모든 Dart 파일 통합 (main.dart, services 등)
- ✓ 의존성 설정 (pubspec.yaml)
- ✓ Android 설정 (gradle, permissions)
- ✓ iOS 설정 (Podfile, Info.plist)
- ✓ 빌드 최적화 설정 (ProGuard 규칙)
- ✓ 문서화 완료

## 다음 단계: 빌드 환경 설정 (필수)

### 1단계: 필수 도구 설치 (첫 설치 시만 필요)

#### Windows PowerShell을 관리자 권한으로 실행 후 다음 실행:

```powershell
# Java 설치 여부 확인
java -version

# 없으면 설치:
# https://www.oracle.com/java/technologies/downloads/
# JDK 11 또는 17 LTS 버전 다운로드 후 설치
# 설치 후 JAVA_HOME 환경 변수 설정

# Android SDK 확인
echo %ANDROID_HOME%

# 없으면 설치:
# 1. Android Studio 다운로드: https://developer.android.com/studio
# 2. 설치 후 자동 SDK 설치
# 3. ANDROID_HOME 환경 변수 설정: C:\Users\A\AppData\Local\Android\Sdk

# Flutter 설치 확인
flutter --version

# 없으면 설치:
# 1. https://flutter.dev/docs/get-started/install/windows
# 2. Flutter SDK 다운로드 및 압축 해제
# 3. flutter\bin을 PATH 환경 변수에 추가

# 모든 것이 준비되었는지 확인
flutter doctor
```

### 2단계: APK 빌드 (도구 설치 후 매번 실행)

```bash
# 프로젝트 폴더로 이동
cd C:\Users\A\Desktop\seaon_attendance

# 의존성 설치
flutter pub get

# APK 빌드 (약 3-5분 소요)
flutter build apk --release
```

### 빌드 완료!

**생성된 APK 파일:**
```
C:\Users\A\Desktop\seaon_attendance\build\app\outputs\flutter-apk\app-release.apk
```

## 3단계: Firebase 배포 (선택사항)

### Firebase에 배포하려면:

```bash
# Node.js/npm 설치 (https://nodejs.org/)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# Firebase 프로젝트 선택
firebase use --add

# APK 배포
firebase appdistribution:distribute ^
  build\app\outputs\flutter-apk\app-release.apk ^
  --release-notes "SEAON Attendance App v1.0.0" ^
  --testers 7416979@gmail.com
```

## 빠른 체크리스트

- [ ] Java 설치 및 JAVA_HOME 설정
- [ ] Android SDK 설치 및 ANDROID_HOME 설정
- [ ] Flutter 설치 및 PATH에 추가
- [ ] `flutter doctor` 모두 체크
- [ ] `cd C:\Users\A\Desktop\seaon_attendance`
- [ ] `flutter pub get`
- [ ] `flutter build apk --release`
- [ ] APK 파일 생성 확인

## 환경 변수 설정 (Windows)

**시스템 환경 변수 설정 방법:**

1. "시스템 환경 변수 편집" 열기
2. "환경 변수" 클릭
3. "새로 만들기" 클릭
4. 다음 변수 추가:

| 변수명 | 값 |
|--------|-----|
| JAVA_HOME | C:\Program Files\Java\jdk-17.x.x |
| ANDROID_HOME | C:\Users\A\AppData\Local\Android\Sdk |
| FLUTTER_HOME | C:\path\to\flutter |

5. PATH에 다음 추가:
   - %JAVA_HOME%\bin
   - %ANDROID_HOME%\tools
   - %FLUTTER_HOME%\bin

## 문제 해결

### "flutter: The term is not recognized"
→ Flutter PATH 확인 및 터미널 재시작

### "Android SDK not found"
→ android/local.properties의 sdk.dir 경로 확인

### "Build failed"
```bash
flutter clean
flutter pub get
flutter build apk --release
```

## 완료 후

1. APK 파일을 테스트 장치에 설치
2. Firebase App Distribution으로 테스터에게 공유
3. Crashlytics 모니터링 시작

---

**프로젝트 위치:** C:\Users\A\Desktop\seaon_attendance
**생성일:** 2026-10-01
**상태:** Ready to Build ✓
