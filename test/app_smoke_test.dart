import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hr_attendance_app/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    // Answer every other plugin call with null so screens render without a device.
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    final tempDir = Directory.systemTemp.createTempSync('seaon_test').path;
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => tempDir,
    );
    // Behave like a phone where location permission is granted (LocationPermission.whileInUse).
    messenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/geolocator'),
      (call) async {
        switch (call.method) {
          case 'checkPermission':
          case 'requestPermission':
            return 2;
          case 'isLocationServiceEnabled':
            return true;
          case 'getCurrentPosition':
            return <String, dynamic>{
              'latitude': 37.4979,
              'longitude': 127.0276,
              'timestamp': DateTime.now().millisecondsSinceEpoch,
              'accuracy': 5.0,
              'altitude': 0.0,
              'heading': 0.0,
              'speed': 0.0,
              'speed_accuracy': 0.0,
            };
        }
        return null;
      },
    );
    for (final name in [
      'dev.fluttercommunity.plus/network_info',
      'dev.fluttercommunity.plus/connectivity',
      'be.tramckrijte.workmanager/foreground_channel_work_manager',
    ]) {
      messenger.setMockMethodCallHandler(MethodChannel(name), (call) async => null);
    }
  });

  testWidgets('splash -> login -> home -> every tab', (tester) async {
    await tester.pumpWidget(const HRAttendanceApp());
    expect(find.text('HR Attendance Management'), findsOneWidget);

    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget, reason: 'splash must open login');

    await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'pw1234');
    await tester.tap(find.text('로그인'));
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget, reason: 'login must open home');

    for (final tab in ['기록', '통계', '출퇴근']) {
      await tester.tap(find.text(tab).last);
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
    }
  });
}
