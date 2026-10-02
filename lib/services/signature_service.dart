import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

/// 디지털 서명 서비스
/// Canvas를 사용한 서명 생성 및 저장
class SignatureService {
  static Future<String?> captureSignature(Uint8List imageBytes) async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final file = File('${directory.path}/signature_$timestamp.png');

      await file.writeAsBytes(imageBytes);
      return file.path;
    } catch (e) {
      print('서명 저장 오류: $e');
      return null;
    }
  }

  static Future<img.Image?> loadSignatureImage(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        return img.decodeImage(await file.readAsBytes());
      }
    } catch (e) {
      print('서명 이미지 로드 오류: $e');
    }
    return null;
  }

  static Future<void> deleteSignature(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (e) {
      print('서명 삭제 오류: $e');
    }
  }
}

/// 서명 그리기 위젯
class SignaturePad extends StatefulWidget {
  final VoidCallback onSignatureChanged;
  final Function(Uint8List) onSignatureSaved;

  const SignaturePad({
    Key? key,
    required this.onSignatureChanged,
    required this.onSignatureSaved,
  }) : super(key: key);

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  final List<Offset?> _points = [];

  @override
  void initState() {
    super.initState();
  }

  void _clear() {
    setState(() {
      _points.clear();
    });
    widget.onSignatureChanged();
  }

  Future<void> _save() async {
    final imageBytes = await SignaturePainter(points: _points).saveImage();
    widget.onSignatureSaved(imageBytes);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey),
            borderRadius: BorderRadius.circular(8),
          ),
          child: GestureDetector(
            onPanUpdate: (details) {
              setState(() {
                _points.add(details.localPosition);
              });
              widget.onSignatureChanged();
            },
            onPanEnd: (details) {
              setState(() {
                _points.add(null);
              });
            },
            child: CustomPaint(
              painter: SignaturePainter(points: _points),
              size: Size.infinite,
              child: Container(
                width: double.infinity,
                height: 200,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            ElevatedButton.icon(
              onPressed: _clear,
              icon: const Icon(Icons.clear),
              label: const Text('지우기'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.grey,
              ),
            ),
            ElevatedButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.check),
              label: const Text('저장'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class SignaturePainter extends CustomPainter {
  final List<Offset?> points;

  SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(SignaturePainter oldDelegate) {
    return oldDelegate.points != points;
  }

  Future<Uint8List> saveImage() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, 400, 200));

    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawRect(Rect.fromLTWH(0, 0, 400, 200), paint);

    paint
      ..color = Colors.black
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }

    final picture = recorder.endRecording();
    final image = await picture.toImage(400, 200);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    return byteData!.buffer.asUint8List();
  }
}
