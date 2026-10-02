import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:workmanager/workmanager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:encrypt/encrypt.dart' as encrypt;
import 'package:intl/intl.dart';
import 'dart:async';
import 'dart:convert';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:flutter/rendering.dart';
import 'package:image/image.dart' as img;
import 'dart:ui' as ui;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 작업 관리자 초기화
  await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);

  // 알림 초기화
  await _initNotifications();

  runApp(const HRAttendanceApp());
}

void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName == 'gpsTracking') {
      await _backgroundGpsTracking();
    }
    return Future.value(true);
  });
}

Future<void> _backgroundGpsTracking() async {
  final Position position = await Geolocator.getCurrentPosition(
    desiredAccuracy: LocationAccuracy.high,
  );
  print('백그라운드 GPS 추적: ${position.latitude}, ${position.longitude}');
}

Future<void> _initNotifications() async {
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('app_icon');
  const DarwinInitializationSettings initializationSettingsIOS =
      DarwinInitializationSettings();
  const InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
    iOS: initializationSettingsIOS,
  );

  await FlutterLocalNotificationsPlugin().initialize(initializationSettings);
}

class HRAttendanceApp extends StatelessWidget {
  const HRAttendanceApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '근태관리 시스템',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          elevation: 0,
          centerTitle: true,
        ),
      ),
      home: const SplashScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      final isAuthenticated = await AuthenticationService.isAuthenticated();
      if (isAuthenticated) {
        Navigator.of(context).pushReplacementNamed('/home');
      } else {
        Navigator.of(context).pushReplacementNamed('/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.blue,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.assignment_turned_in,
                size: 60,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              '근태관리',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.blue,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'HR Attendance Management',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 48),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

// 인증 서비스
class AuthenticationService {
  static const String _secureStorageKey = 'auth_token';
  static const String _userDataKey = 'user_data';
  static const secureStorage = FlutterSecureStorage();

  static Future<bool> isAuthenticated() async {
    final token = await secureStorage.read(key: _secureStorageKey);
    return token != null && token.isNotEmpty;
  }

  static Future<void> saveAuthToken(String token) async {
    await secureStorage.write(key: _secureStorageKey, value: token);
  }

  static Future<String?> getAuthToken() async {
    return await secureStorage.read(key: _secureStorageKey);
  }

  static Future<void> clearAuthToken() async {
    await secureStorage.delete(key: _secureStorageKey);
  }

  static Future<void> saveUserData(UserData userData) async {
    final json = jsonEncode(userData.toJson());
    await secureStorage.write(key: _userDataKey, value: json);
  }

  static Future<UserData?> getUserData() async {
    final json = await secureStorage.read(key: _userDataKey);
    if (json == null) return null;
    return UserData.fromJson(jsonDecode(json));
  }
}

// 사용자 데이터 모델
class UserData {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String department;
  final String companySSID;
  final double companyLatitude;
  final double companyLongitude;

  UserData({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.department,
    required this.companySSID,
    required this.companyLatitude,
    required this.companyLongitude,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    'phone': phone,
    'department': department,
    'companySSID': companySSID,
    'companyLatitude': companyLatitude,
    'companyLongitude': companyLongitude,
  };

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      phone: json['phone'],
      department: json['department'],
      companySSID: json['companySSID'],
      companyLatitude: json['companyLatitude'],
      companyLongitude: json['companyLongitude'],
    );
  }
}

// 로그인 화면
class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이메일과 비밀번호를 입력해주세요.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // 시뮬레이션: 실제 구현에서는 백엔드 API 호출
      await Future.delayed(const Duration(seconds: 2));

      final userData = UserData(
        id: '12345',
        name: '김근태',
        email: _emailController.text,
        phone: '010-1234-5678',
        department: '개발팀',
        companySSID: 'Company_WiFi',
        companyLatitude: 37.4979,
        companyLongitude: 127.0276,
      );

      await AuthenticationService.saveAuthToken('mock_token_${DateTime.now().millisecondsSinceEpoch}');
      await AuthenticationService.saveUserData(userData);

      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('로그인 실패: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.assignment_turned_in,
                    size: 48,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                '근태관리 시스템',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'HR Attendance Management',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: '이메일',
                  prefixIcon: const Icon(Icons.email),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: '비밀번호',
                  prefixIcon: const Icon(Icons.lock),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    ),
                    onPressed: () {
                      setState(() => _obscurePassword = !_obscurePassword);
                    },
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                obscureText: _obscurePassword,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _login,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('로그인'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('비밀번호 재설정 기능')),
                  );
                },
                child: const Text('비밀번호를 잊으셨나요?'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// 위치 서비스
class LocationService {
  static const double COMPANY_RADIUS = 100; // 100m 범위

  static Future<bool> requestLocationPermission() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      final newPermission = await Geolocator.requestPermission();
      return newPermission == LocationPermission.whileInUse ||
          newPermission == LocationPermission.always;
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  static Future<Position?> getCurrentPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
      );
    } catch (e) {
      print('위치 가져오기 오류: $e');
      return null;
    }
  }

  static bool isWithinCompanyRadius(
    Position userPosition,
    double companyLatitude,
    double companyLongitude,
  ) {
    final distance = Geolocator.distanceBetween(
      userPosition.latitude,
      userPosition.longitude,
      companyLatitude,
      companyLongitude,
    );
    return distance <= COMPANY_RADIUS;
  }

  static Future<void> startLocationTracking() async {
    await Workmanager().registerPeriodicTask(
      'gpsTracking',
      'gpsTracking',
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.any,
        requiresBatteryNotLow: false,
        requiresCharging: false,
        requiresDeviceIdle: false,
        requiresStorageNotLow: false,
      ),
    );
  }

  static Future<void> stopLocationTracking() async {
    await Workmanager().cancelByTag('gpsTracking');
  }
}

// WiFi 서비스
class WiFiService {
  static final NetworkInfo _networkInfo = NetworkInfo();

  static Future<bool> isConnectedToCompanyWiFi(String companySSID) async {
    try {
      final wifiSSID = await _networkInfo.getWifiName();
      if (wifiSSID == null) return false;

      // 따옴표 제거
      final cleanSSID = wifiSSID.replaceAll('"', '').trim();
      return cleanSSID == companySSID;
    } catch (e) {
      print('WiFi 확인 오류: $e');
      return false;
    }
  }

  static Future<String?> getWiFiName() async {
    try {
      return await _networkInfo.getWifiName();
    } catch (e) {
      print('WiFi 이름 가져오기 오류: $e');
      return null;
    }
  }
}

// 암호화 서비스
class EncryptionService {
  static const String _encryptionKey = 'YourVerySecureEncryptionKey123456'; // 32자

  static String encryptData(String data) {
    final key = encrypt.Key.fromUtf8(_encryptionKey);
    final iv = encrypt.IV.fromLength(16);
    final encrypter = encrypt.Encrypter(encrypt.AES(key));
    final encrypted = encrypter.encrypt(data, iv: iv);
    return encrypted.base64;
  }

  static String decryptData(String encryptedData) {
    final key = encrypt.Key.fromUtf8(_encryptionKey);
    final iv = encrypt.IV.fromLength(16);
    final encrypter = encrypt.Encrypter(encrypt.AES(key));
    final decrypted = encrypter.decrypt64(encryptedData, iv: iv);
    return decrypted;
  }
}

// 2FA 서비스
class TwoFactorAuthService {
  static const secureStorage = FlutterSecureStorage();
  static const String _2faCodeKey = '2fa_code';

  static Future<String> generateCode() async {
    final random = DateTime.now().millisecondsSinceEpoch.toString();
    final code = random.substring(random.length - 6);
    await secureStorage.write(key: _2faCodeKey, value: code);
    return code;
  }

  static Future<bool> verifyCode(String inputCode) async {
    final savedCode = await secureStorage.read(key: _2faCodeKey);
    return savedCode == inputCode;
  }

  static Future<void> clearCode() async {
    await secureStorage.delete(key: _2faCodeKey);
  }
}

// 오프라인 데이터 저장소
class OfflineDataStore {
  static const String _attendanceDataKey = 'attendance_records';

  static Future<String> getStoragePath() async {
    final directory = await getApplicationDocumentsDirectory();
    return directory.path;
  }

  static Future<void> saveAttendanceRecord(AttendanceRecord record) async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/attendance_${record.id}.json');

      final encryptedData = EncryptionService.encryptData(jsonEncode(record.toJson()));
      await file.writeAsString(encryptedData);
    } catch (e) {
      print('저장 오류: $e');
    }
  }

  static Future<List<AttendanceRecord>> getOfflineRecords() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final dir = Directory(directory.path);

      final files = dir.listSync();
      final records = <AttendanceRecord>[];

      for (var file in files) {
        if (file.path.contains('attendance_')) {
          final content = await File(file.path).readAsString();
          final decryptedData = EncryptionService.decryptData(content);
          records.add(AttendanceRecord.fromJson(jsonDecode(decryptedData)));
        }
      }

      return records;
    } catch (e) {
      print('읽기 오류: $e');
      return [];
    }
  }

  static Future<void> syncWithServer(List<AttendanceRecord> records) async {
    try {
      // 실제 구현에서는 서버 API 호출
      for (var record in records) {
        print('동기화: ${record.id} - ${record.checkInTime}');
      }
    } catch (e) {
      print('동기화 오류: $e');
    }
  }
}

// 근태 기록 모델
class AttendanceRecord {
  final String id;
  final String userId;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final double checkInLatitude;
  final double checkInLongitude;
  final bool wifiVerified;
  final String? signature;
  final bool isSynced;

  AttendanceRecord({
    required this.id,
    required this.userId,
    required this.checkInTime,
    this.checkOutTime,
    required this.checkInLatitude,
    required this.checkInLongitude,
    required this.wifiVerified,
    this.signature,
    this.isSynced = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'userId': userId,
    'checkInTime': checkInTime.toIso8601String(),
    'checkOutTime': checkOutTime?.toIso8601String(),
    'checkInLatitude': checkInLatitude,
    'checkInLongitude': checkInLongitude,
    'wifiVerified': wifiVerified,
    'signature': signature,
    'isSynced': isSynced,
  };

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'],
      userId: json['userId'],
      checkInTime: DateTime.parse(json['checkInTime']),
      checkOutTime: json['checkOutTime'] != null
          ? DateTime.parse(json['checkOutTime'])
          : null,
      checkInLatitude: json['checkInLatitude'],
      checkInLongitude: json['checkInLongitude'],
      wifiVerified: json['wifiVerified'],
      signature: json['signature'],
      isSynced: json['isSynced'] ?? false,
    );
  }
}

// 홈 화면
class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => false,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('근태관리'),
          elevation: 0,
          actions: [
            IconButton(
              icon: const Icon(Icons.settings),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                );
              },
            ),
          ],
        ),
        body: IndexedStack(
          index: _selectedIndex,
          children: const [
            AttendanceCheckScreen(),
            AttendanceHistoryScreen(),
            StatisticsScreen(),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() => _selectedIndex = index);
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.access_time),
              label: '출퇴근',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.history),
              label: '기록',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.bar_chart),
              label: '통계',
            ),
          ],
        ),
      ),
    );
  }
}

// 출퇴근 체크 화면
class AttendanceCheckScreen extends StatefulWidget {
  const AttendanceCheckScreen({Key? key}) : super(key: key);

  @override
  State<AttendanceCheckScreen> createState() => _AttendanceCheckScreenState();
}

class _AttendanceCheckScreenState extends State<AttendanceCheckScreen> {
  bool _isLoading = false;
  String? _statusMessage;
  Color? _statusColor;
  bool _isCheckedIn = false;
  Position? _currentPosition;
  String? _wifiStatus;
  UserData? _userData;

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  Future<void> _initializeScreen() async {
    _userData = await AuthenticationService.getUserData();
    await _checkLocationPermission();
    await _getCurrentLocation();
  }

  Future<void> _checkLocationPermission() async {
    final granted = await LocationService.requestLocationPermission();
    if (!granted && mounted) {
      setState(() {
        _statusMessage = '위치 권한이 필요합니다.';
        _statusColor = Colors.red;
      });
    }
  }

  Future<void> _getCurrentLocation() async {
    final position = await LocationService.getCurrentPosition();
    if (mounted) {
      setState(() => _currentPosition = position);
    }
  }

  Future<void> _checkAttendance(bool isCheckIn) async {
    if (_userData == null) return;

    setState(() => _isLoading = true);

    try {
      // 위치 확인
      final position = await LocationService.getCurrentPosition();
      if (position == null) {
        throw '위치를 가져올 수 없습니다.';
      }

      final isWithinRadius = LocationService.isWithinCompanyRadius(
        position,
        _userData!.companyLatitude,
        _userData!.companyLongitude,
      );

      if (!isWithinRadius) {
        throw '회사 위치(100m)에서만 출퇴근이 가능합니다.';
      }

      // WiFi 확인
      final isWiFiConnected = await WiFiService.isConnectedToCompanyWiFi(
        _userData!.companySSID,
      );

      setState(() => _wifiStatus = isWiFiConnected ? 'WiFi 연결됨' : 'WiFi 미연결');

      // 2FA 요청
      await _show2FADialog();
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusMessage = e.toString();
          _statusColor = Colors.red;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _show2FADialog() async {
    final code = await TwoFactorAuthService.generateCode();

    if (mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => _2FADialog(
          code: code,
          onVerify: (inputCode) async {
            final isValid = await TwoFactorAuthService.verifyCode(inputCode);
            if (isValid) {
              await _completeAttendance();
              if (mounted) Navigator.pop(context);
            } else {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('인증 코드가 일치하지 않습니다.')),
                );
              }
            }
          },
        ),
      );
    }
  }

  Future<void> _completeAttendance() async {
    if (_userData == null || _currentPosition == null) return;

    final record = AttendanceRecord(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: _userData!.id,
      checkInTime: DateTime.now(),
      checkInLatitude: _currentPosition!.latitude,
      checkInLongitude: _currentPosition!.longitude,
      wifiVerified: _wifiStatus == 'WiFi 연결됨',
    );

    await OfflineDataStore.saveAttendanceRecord(record);

    if (mounted) {
      setState(() {
        _isCheckedIn = !_isCheckedIn;
        _statusMessage = _isCheckedIn ? '출근했습니다.' : '퇴근했습니다.';
        _statusColor = Colors.green;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_statusMessage!)),
      );

      // 알림 표시
      await _showNotification(_statusMessage!);
    }
  }

  Future<void> _showNotification(String message) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'attendance_channel',
      'Attendance Notifications',
      channelDescription: 'Notifications for attendance',
      importance: Importance.max,
      priority: Priority.high,
    );

    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);

    await FlutterLocalNotificationsPlugin().show(
      0,
      '근태 기록',
      message,
      platformChannelSpecifics,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 24),
          // 상태 표시
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.blue[300]!),
            ),
            child: Column(
              children: [
                Icon(
                  _isCheckedIn ? Icons.check_circle : Icons.login,
                  size: 80,
                  color: Colors.blue,
                ),
                const SizedBox(height: 16),
                Text(
                  _isCheckedIn ? '출근 중' : '퇴근 상태',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now()),
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // 상태 메시지
          if (_statusMessage != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _statusColor?.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _statusColor ?? Colors.blue),
              ),
              child: Row(
                children: [
                  Icon(
                    _statusColor == Colors.green
                        ? Icons.check_circle
                        : Icons.error,
                    color: _statusColor,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(_statusMessage!),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 24),
          // 위치 정보
          if (_currentPosition != null)
            _buildInfoCard(
              '위치 정보',
              '위도: ${_currentPosition!.latitude.toStringAsFixed(6)}\n'
              '경도: ${_currentPosition!.longitude.toStringAsFixed(6)}',
              Icons.location_on,
            ),
          const SizedBox(height: 16),
          // WiFi 상태
          if (_wifiStatus != null)
            _buildInfoCard(
              'WiFi 상태',
              _wifiStatus!,
              Icons.wifi,
            ),
          const SizedBox(height: 24),
          // 출퇴근 버튼
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : () => _checkAttendance(true),
                  icon: const Icon(Icons.login),
                  label: const Text('출근'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: Colors.green,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : () => _checkAttendance(false),
                  icon: const Icon(Icons.logout),
                  label: const Text('퇴근'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          if (_isLoading) ...[
            const SizedBox(height: 16),
            const CircularProgressIndicator(),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoCard(String title, String content, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.blue),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  content,
                  style: const TextStyle(
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// 2FA 다이얼로그
class _2FADialog extends StatefulWidget {
  final String code;
  final Function(String) onVerify;

  const _2FADialog({
    required this.code,
    required this.onVerify,
  });

  @override
  State<_2FADialog> createState() => _2FADialogState();
}

class _2FADialogState extends State<_2FADialog> {
  late TextEditingController _codeController;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('2단계 인증'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('인증 코드가 전송되었습니다.'),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(8),
            ),
            child: SelectableText(
              widget.code,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _codeController,
            decoration: InputDecoration(
              labelText: '인증 코드 입력',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            keyboardType: TextInputType.number,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        ElevatedButton(
          onPressed: () => widget.onVerify(_codeController.text),
          child: const Text('확인'),
        ),
      ],
    );
  }
}

// 근태 기록 화면
class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({Key? key}) : super(key: key);

  @override
  State<AttendanceHistoryScreen> createState() => _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  late Future<List<AttendanceRecord>> _recordsFuture;

  @override
  void initState() {
    super.initState();
    _recordsFuture = OfflineDataStore.getOfflineRecords();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AttendanceRecord>>(
      future: _recordsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.history,
                  size: 64,
                  color: Colors.grey[400],
                ),
                const SizedBox(height: 16),
                Text(
                  '기록이 없습니다.',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          );
        }

        final records = snapshot.data!;
        return RefreshIndicator(
          onRefresh: () async {
            setState(() {
              _recordsFuture = OfflineDataStore.getOfflineRecords();
            });
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: records.length,
            itemBuilder: (context, index) {
              final record = records[index];
              return _buildAttendanceCard(record);
            },
          ),
        );
      },
    );
  }

  Widget _buildAttendanceCard(AttendanceRecord record) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  DateFormat('yyyy-MM-dd').format(record.checkInTime),
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: record.wifiVerified ? Colors.green[100] : Colors.orange[100],
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    record.wifiVerified ? 'WiFi 인증됨' : 'WiFi 미인증',
                    style: TextStyle(
                      fontSize: 12,
                      color: record.wifiVerified ? Colors.green[700] : Colors.orange[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.access_time, size: 18, color: Colors.blue),
                const SizedBox(width: 8),
                Text(DateFormat('HH:mm:ss').format(record.checkInTime)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.location_on, size: 18, color: Colors.blue),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${record.checkInLatitude.toStringAsFixed(6)}, ${record.checkInLongitude.toStringAsFixed(6)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            if (record.isSynced) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.cloud_done, size: 18, color: Colors.green),
                  const SizedBox(width: 8),
                  const Text('서버 동기화됨'),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// 통계 화면
class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({Key? key}) : super(key: key);

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  late Future<List<AttendanceRecord>> _recordsFuture;

  @override
  void initState() {
    super.initState();
    _recordsFuture = OfflineDataStore.getOfflineRecords();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AttendanceRecord>>(
      future: _recordsFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final records = snapshot.data ?? [];
        final totalDays = records.length;
        final wifiVerifiedDays = records.where((r) => r.wifiVerified).length;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              _buildStatCard('총 출근 일수', totalDays.toString(), Icons.calendar_today),
              const SizedBox(height: 12),
              _buildStatCard('WiFi 인증 완료', wifiVerifiedDays.toString(), Icons.wifi),
              const SizedBox(height: 12),
              _buildStatCard(
                '인증 률',
                totalDays > 0 ? '${((wifiVerifiedDays / totalDays) * 100).toStringAsFixed(1)}%' : 'N/A',
                Icons.percent,
              ),
              const SizedBox(height: 24),
              const Text(
                '월별 출근 현황',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              // 월별 통계
              _buildMonthlyStats(records),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue[200]!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.blue, size: 28),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMonthlyStats(List<AttendanceRecord> records) {
    final monthGroups = <String, int>{};

    for (var record in records) {
      final monthKey = DateFormat('yyyy-MM').format(record.checkInTime);
      monthGroups[monthKey] = (monthGroups[monthKey] ?? 0) + 1;
    }

    if (monthGroups.isEmpty) {
      return Center(
        child: Text(
          '데이터가 없습니다.',
          style: TextStyle(color: Colors.grey[600]),
        ),
      );
    }

    return Column(
      children: monthGroups.entries.map((entry) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey[300]!),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                entry.key,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(
                '${entry.value}일',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

// 설정 화면
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  UserData? _userData;
  bool _isBackgroundTrackingEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final userData = await AuthenticationService.getUserData();
    setState(() => _userData = userData);
  }

  Future<void> _toggleBackgroundTracking() async {
    if (_isBackgroundTrackingEnabled) {
      await LocationService.stopLocationTracking();
    } else {
      await LocationService.startLocationTracking();
    }

    setState(() => _isBackgroundTrackingEnabled = !_isBackgroundTrackingEnabled);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isBackgroundTrackingEnabled ? '백그라운드 추적이 활성화되었습니다.' : '백그라운드 추적이 비활성화되었습니다.',
          ),
        ),
      );
    }
  }

  Future<void> _logout() async {
    await AuthenticationService.clearAuthToken();
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  Future<void> _syncOfflineData() async {
    final records = await OfflineDataStore.getOfflineRecords();
    await OfflineDataStore.syncWithServer(records);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${records.length}개의 기록을 동기화했습니다.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('설정'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_userData != null) ...[
              const Text(
                '사용자 정보',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue[200]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildInfoRow('이름', _userData!.name),
                    const SizedBox(height: 8),
                    _buildInfoRow('이메일', _userData!.email),
                    const SizedBox(height: 8),
                    _buildInfoRow('부서', _userData!.department),
                    const SizedBox(height: 8),
                    _buildInfoRow('전화', _userData!.phone),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            const Text(
              '기능 설정',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              title: const Text('백그라운드 GPS 추적'),
              subtitle: const Text('위치 정보를 자동으로 기록합니다'),
              value: _isBackgroundTrackingEnabled,
              onChanged: (_) => _toggleBackgroundTracking(),
            ),
            const Divider(),
            ListTile(
              title: const Text('데이터 동기화'),
              subtitle: const Text('오프라인 데이터를 서버와 동기화'),
              trailing: const Icon(Icons.cloud_upload),
              onTap: _syncOfflineData,
            ),
            const Divider(),
            const SizedBox(height: 24),
            const Text(
              '시스템',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              title: const Text('앱 정보'),
              subtitle: const Text('v1.0.0'),
              trailing: const Icon(Icons.info),
            ),
            const Divider(),
            ListTile(
              title: const Text('개인정보처리방침'),
              trailing: const Icon(Icons.open_in_new),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('개인정보처리방침')),
                );
              },
            ),
            const Divider(),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _logout,
                icon: const Icon(Icons.logout),
                label: const Text('로그아웃'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 14,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}

// 라우트 설정
Route<dynamic> _buildRoute(RouteSettings settings) {
  switch (settings.name) {
    case '/login':
      return MaterialPageRoute(builder: (_) => const LoginScreen());
    case '/home':
      return MaterialPageRoute(builder: (_) => const HomeScreen());
    default:
      return MaterialPageRoute(builder: (_) => const LoginScreen());
  }
}

extension on HRAttendanceApp {
  void Function(RouteSettings)? get onGenerateRoute => _buildRoute;
}
