import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// 오프라인 데이터 동기화 서비스
/// 오프라인 상태에서 데이터를 저장했다가 온라인 상태에서 자동 동기화
class OfflineSyncService {
  static const String API_BASE_URL = 'https://api.example.com/api/v1';
  static const String ATTENDANCE_ENDPOINT = '/attendance';

  static final Connectivity _connectivity = Connectivity();
  static final List<SyncListener> _listeners = [];

  /// 동기화 리스너 등록
  static void addListener(SyncListener listener) {
    _listeners.add(listener);
  }

  static void removeListener(SyncListener listener) {
    _listeners.remove(listener);
  }

  static void _notifyListeners(SyncEvent event) {
    for (var listener in _listeners) {
      listener.onSyncEvent(event);
    }
  }

  /// 네트워크 연결 상태 모니터링
  static Stream<bool> getNetworkStatusStream() {
    return _connectivity.onConnectivityChanged.map((result) {
      return result != ConnectivityResult.none;
    });
  }

  /// 현재 네트워크 상태 확인
  static Future<bool> isOnline() async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }

  /// 근태 기록 동기화
  static Future<SyncResult> syncAttendanceRecords(
    List<AttendanceRecordSync> records,
    String authToken,
  ) async {
    try {
      final isConnected = await isOnline();
      if (!isConnected) {
        _notifyListeners(
          SyncEvent(
            status: SyncStatus.offline,
            message: '네트워크 연결이 없습니다.',
            recordsCount: records.length,
          ),
        );
        return SyncResult(
          success: false,
          message: 'No network connection',
          syncedCount: 0,
          failedCount: records.length,
        );
      }

      _notifyListeners(
        SyncEvent(
          status: SyncStatus.syncing,
          message: '동기화 중...',
          recordsCount: records.length,
        ),
      );

      final response = await http.post(
        Uri.parse('$API_BASE_URL$ATTENDANCE_ENDPOINT/batch'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'records': records.map((r) => r.toJson()).toList(),
          'timestamp': DateTime.now().toIso8601String(),
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = jsonDecode(response.body);

        _notifyListeners(
          SyncEvent(
            status: SyncStatus.success,
            message: '동기화 완료',
            recordsCount: records.length,
          ),
        );

        return SyncResult(
          success: true,
          message: 'Sync completed successfully',
          syncedCount: records.length,
          failedCount: 0,
          serverResponse: responseData,
        );
      } else {
        throw 'Server error: ${response.statusCode}';
      }
    } catch (e) {
      _notifyListeners(
        SyncEvent(
          status: SyncStatus.failed,
          message: '동기화 실패: $e',
          recordsCount: records.length,
        ),
      );

      return SyncResult(
        success: false,
        message: 'Sync failed: $e',
        syncedCount: 0,
        failedCount: records.length,
      );
    }
  }

  /// 배치 동기화
  static Future<SyncResult> syncBatch(
    List<SyncItem> items,
    String authToken,
  ) async {
    try {
      final isConnected = await isOnline();
      if (!isConnected) {
        return SyncResult(
          success: false,
          message: 'No network connection',
          syncedCount: 0,
          failedCount: items.length,
        );
      }

      int syncedCount = 0;
      int failedCount = 0;

      for (var item in items) {
        try {
          final response = await http.post(
            Uri.parse('$API_BASE_URL${item.endpoint}'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $authToken',
            },
            body: jsonEncode(item.data),
          ).timeout(const Duration(seconds: 30));

          if (response.statusCode == 200 || response.statusCode == 201) {
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch (e) {
          failedCount++;
        }
      }

      return SyncResult(
        success: failedCount == 0,
        message: 'Batch sync completed',
        syncedCount: syncedCount,
        failedCount: failedCount,
      );
    } catch (e) {
      return SyncResult(
        success: false,
        message: 'Batch sync failed: $e',
        syncedCount: 0,
        failedCount: items.length,
      );
    }
  }

  /// 동기화 재시도 (지수 백오프)
  static Future<SyncResult> syncWithRetry(
    List<SyncItem> items,
    String authToken, {
    int maxRetries = 3,
    Duration initialDelay = const Duration(seconds: 1),
  }) async {
    SyncResult? lastResult;

    for (int i = 0; i < maxRetries; i++) {
      lastResult = await syncBatch(items, authToken);

      if (lastResult.success) {
        return lastResult;
      }

      if (i < maxRetries - 1) {
        final delay = initialDelay * (2 << i); // 지수 백오프
        await Future.delayed(delay);
      }
    }

    return lastResult ?? SyncResult(
      success: false,
      message: 'Max retries exceeded',
      syncedCount: 0,
      failedCount: items.length,
    );
  }
}

/// 동기화 상태
enum SyncStatus {
  idle,
  syncing,
  success,
  failed,
  offline,
  retrying,
}

/// 동기화 이벤트
class SyncEvent {
  final SyncStatus status;
  final String message;
  final int recordsCount;
  final DateTime timestamp;

  SyncEvent({
    required this.status,
    required this.message,
    required this.recordsCount,
  }) : timestamp = DateTime.now();
}

/// 동기화 결과
class SyncResult {
  final bool success;
  final String message;
  final int syncedCount;
  final int failedCount;
  final Map<String, dynamic>? serverResponse;

  SyncResult({
    required this.success,
    required this.message,
    required this.syncedCount,
    required this.failedCount,
    this.serverResponse,
  });

  int get totalCount => syncedCount + failedCount;
  double get successRate => totalCount > 0 ? (syncedCount / totalCount) * 100 : 0;
}

/// 동기화 항목
class SyncItem {
  final String endpoint;
  final Map<String, dynamic> data;
  final String id;

  SyncItem({
    required this.endpoint,
    required this.data,
    required this.id,
  });
}

/// 근태 기록 동기화 모델
class AttendanceRecordSync {
  final String id;
  final String userId;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final double latitude;
  final double longitude;
  final bool wifiVerified;
  final String? signature;

  AttendanceRecordSync({
    required this.id,
    required this.userId,
    required this.checkInTime,
    this.checkOutTime,
    required this.latitude,
    required this.longitude,
    required this.wifiVerified,
    this.signature,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'check_in_time': checkInTime.toIso8601String(),
    'check_out_time': checkOutTime?.toIso8601String(),
    'latitude': latitude,
    'longitude': longitude,
    'wifi_verified': wifiVerified,
    'signature': signature,
  };

  factory AttendanceRecordSync.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordSync(
      id: json['id'],
      userId: json['user_id'],
      checkInTime: DateTime.parse(json['check_in_time']),
      checkOutTime: json['check_out_time'] != null
          ? DateTime.parse(json['check_out_time'])
          : null,
      latitude: json['latitude'],
      longitude: json['longitude'],
      wifiVerified: json['wifi_verified'],
      signature: json['signature'],
    );
  }
}

/// 동기화 리스너
abstract class SyncListener {
  void onSyncEvent(SyncEvent event);
}

/// 기본 동기화 리스너 구현
class DefaultSyncListener implements SyncListener {
  final Function(SyncEvent)? onEvent;

  DefaultSyncListener({this.onEvent});

  @override
  void onSyncEvent(SyncEvent event) {
    print('[Sync] ${event.status}: ${event.message}');
    onEvent?.call(event);
  }
}

// connectivity_plus 사용을 위한 추가 import
// import 'package:connectivity_plus/connectivity_plus.dart';
