# SEAON 근태관리 APK 빌드 및 Firebase 배포 가이드

## 현재 프로젝트 상태

완전한 Flutter 프로젝트 구조가 준비되었습니다:
- ✓ 모든 Dart 파일 통합
- ✓ pubspec.yaml 의존성 설정
- ✓ Android/iOS 설정 파일
- ✓ 프로젝트 구조 완성

## 빌드 전 필수 설치 (Windows)

### Step 1: Java Development Kit (JDK) 설치

```
1. 웹브라우저에서 https://www.oracle.com/java/technologies/downloads/ 방문
2. Java 11 또는 17 LTS 버전 다운로드
3. 설치 후 시스템 환경 변수 설정:
   - JAVA_HOME = C:\Program Files\Java\jdk-17.x.x
4. 터미널에서 확인:
   java -version
```

### Step 2: Android SDK 설치

```
1. Android Studio 설치 (https://developer.android.com/studio)
2. Android Studio 실행 후 SDK 자동 설치
3. 또는 Command Line Tools만 설치:
   - https://developer.android.com/studio에서 다운로드
4. 환경 변수 설정:
   - ANDROID_HOME = C:\Users\A\AppData\Local\Android\Sdk
5. 터미널에서 확인:
   echo %ANDROID_HOME%
```

### Step 3: Flutter SDK 설치

```
1. https://flutter.dev/docs/get-started/install/windows 방문
2. Flutter SDK 다운로드 (ZIP 파일)
3. 예: C:\flutter 에 압축 해제
4. 환경 변수 PATH에 추가:
   - C:\flutter\bin
5. 터미널에서 확인:
   flutter --version
```

### Step 4: Flutter 초기 설정

```
1. PowerShell 또는 CMD 열기
2. 다음 명령 실행:
   flutter doctor
   
3. 모든 항목이 체크되면 준비 완료
```

## 프로젝트 빌드 (설치 완료 후)

### Step 1: 프로젝트 디렉토리로 이동

```bash
cd C:\Users\A\Desktop\seaon_attendance
```

### Step 2: 의존성 설치

```bash
flutter pub get
```

### Step 3: 코드 생성 (필요한 경우)

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### Step 4: APK 빌드 (릴리스)

```bash
flutter build apk --release
```

**빌드 시간:** 약 3-5분

**출력 파일:**
```
C:\Users\A\Desktop\seaon_attendance\build\app\outputs\flutter-apk\app-release.apk
```

### Step 5: 빌드 검증

```bash
# APK 파일 확인
ls build\app\outputs\flutter-apk\

# 파일 크기 확인
dir build\app\outputs\flutter-apk\app-release.apk /s
```

## Firebase 배포

### Option 1: Firebase Console을 통한 배포

#### 1-1. Firebase 프로젝트 설정

```
1. https://console.firebase.google.com 방문
2. "새 프로젝트" 클릭
3. 프로젝트명: seaon_attendance
4. 프로젝트 생성
```

#### 1-2. Android 앱 등록

```
1. Firebase Console에서 "Android 앱 추가" 클릭
2. 패키지명: com.example.hr_attendance_app
3. 앱 별칭: SEAON Attendance
4. google-services.json 다운로드
5. 파일을 android/app/ 디렉토리에 복사
```

#### 1-3. Firebase CLI 설치 및 로그인

```bash
# Node.js/npm 설치 (https://nodejs.org/)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 선택
firebase use --add
```

#### 1-4. APK 배포

```bash
# App Distribution 사용
firebase appdistribution:distribute \
  build\app\outputs\flutter-apk\app-release.apk \
  --app 1:YOUR_PROJECT_ID:android:YOUR_APP_ID \
  --release-notes "Initial Release" \
  --testers 7416979@gmail.com
```

### Option 2: Google Play Console을 통한 배포

#### 2-1. Google Play Developer Account 가입

```
1. https://play.google.com/console 방문
2. Developer 계정 생성 ($25 수수료)
3. 스토어 정보 입력
```

#### 2-2. App Bundle 빌드

```bash
flutter build appbundle --release
```

**출력 파일:**
```
C:\Users\A\Desktop\seaon_attendance\build\app\outputs\bundle\release\app-release.aab
```

#### 2-3. Google Play Console에 업로드

```
1. Google Play Console 접속
2. 새 앱 만들기
3. 앱 정보 입력
4. "Release" → "Production" 클릭
5. .aab 파일 업로드
6. 검토 및 발행
```

## 테스터 초대 (Firebase App Distribution)

### 테스터 이메일로 초대

```bash
firebase appdistribution:testers:add 7416979@gmail.com
```

### 테스터가 앱 설치

1. 테스터 이메일로 수신한 링크 클릭
2. Firebase App Distribution에서 앱 다운로드
3. APK 설치

## 문제 해결

### "flutter: The term 'flutter' is not recognized"

```
해결책:
1. Flutter SDK 설치 확인
2. PATH에 flutter\bin 경로 추가
3. 터미널 재시작
```

### "Android SDK not found"

```
해결책:
1. ANDROID_HOME 환경 변수 확인
2. android/local.properties에서 sdk.dir 경로 확인
3. 경로 수정 후 다시 빌드
```

### "build failed" 오류

```bash
# 캐시 정리
flutter clean

# 의존성 재설치
flutter pub get

# 다시 빌드
flutter build apk --release
```

### APK 설치 안 됨

```bash
# 다른 버전 제거 후 설치
adb uninstall com.example.hr_attendance_app
adb install build\app\outputs\flutter-apk\app-release.apk
```

## 배포 완료 후

### 다운로드 링크 생성

Firebase App Distribution:
```
https://appdistribution.firebase.google.com/app/YOUR_APP_ID/releases
```

테스터 이메일: 7416979@gmail.com

### 모니터링

1. Firebase Console → Crashlytics
2. 앱 성능 모니터링
3. 사용자 분석

## 보안 주의사항

- google-services.json은 Git에 커밋하지 않기
- 앱 서명 키 안전하게 보관
- Firebase 규칙 설정 확인
- API 키 제한 설정

## 참고 문서

- Flutter 공식 문서: https://flutter.dev/docs
- Firebase 가이드: https://firebase.google.com/docs
- Google Play Console: https://developer.android.com/distribute

---

**프로젝트 경로:** C:\Users\A\Desktop\seaon_attendance
**생성일:** 2026-10-01
