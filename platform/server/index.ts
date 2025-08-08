import express from "express";
import cors from "cors";
import path from "path";
// 핵심 API 라��터들만 import (demo 제거)
import { handleDrawingSubmission, handleCoordinateLinking, handleCoordinateCancellation, handleCoordinateUpdate, handleCoordinateDelete } from "./routes/drawing";
import { handleVideoFileUpload, handleVideoDelete, uploadMiddleware } from "./routes/upload";
import { handleWebVTTSave } from "./routes/webvtt";
import { handleSaveData } from "./routes/save-data";
import { handleVttCoordinatesRead } from "./routes/vtt-coordinates";
import { handleFilenameCheck } from "./routes/check-filename";
import { handleSaveScreenshot, handleGetScreenshot } from "./routes/screenshot";

/**
 * ===================================
 * 🚀 GS1 동영상 객체 탐지 시스템 API 서버
 * ===================================
 * 
 * 📍 API 엔드포인트 목록:
 *
 * 1. POST /api/upload-file      - 동영상 파일 업로드 (multer 사용)
 * 2. DELETE /api/video          - 동영상 및 관련 폴더 삭제
 * 3. POST /api/drawing          - 그리기 데이터 처리 (객체 영역 그리기)
 * 4. POST /api/drawing/link     - 좌표와 객체명 연결
 * 5. POST /api/drawing/cancel   - 임시 좌표 취소/삭제
 * 6. POST /api/coordinate/update - 좌표 파일 객체 이름 업데이트
 * 7. POST /api/coordinate/delete - 좌표 파일 객체 삭제
 * 8. POST /api/webvtt           - WebVTT 자막 파일 생성/업데이트
 * 9. POST /api/save-data        - 편집 데이터 JSON 저장
 * 10. GET /api/vtt-coordinates  - VTT 파일에서 좌표 데이터 읽기
 * 11. GET /api/check-filename   - 파일명 충돌 체크 및 새 이름 제안
 * 12. POST /api/save-screenshot - 그리기 영역 스크린샷 저장 (base64 이미지)
 * 13. GET /api/screenshot       - 저장된 스크린샷 조회
 * 14. GET /api/ping             - 서버 상태 체크
 * 
 * 📂 데이터 저장 구조:
 * data/
 * ├── 동영상파일명/                    (기본 폴더)
 * │   ├── 동영상파일명.mp4
 * │   ├── 동영상파일명-webvtt.vtt
 * │   ├── 동영상파일명-좌표.json      (좌표 정보)
 * │   ├── 동영상파일명-saved-data.json
 * │   └── 동영상파일명-uploads.json
 * ├── 동영상파일명(1)/                (중복 업로드 시)
 * │   └── ... (같은 구조)
 * ├── uploads-all.json (전체 업로드 인덱스)
 * └── saved-data-all.json (전체 저장 데이터 인덱스)
 */

export function createServer() {
  const app = express();

  // ========================================
  // 🔧 미들웨어 설정
  // ========================================
  
  // CORS 설��� - 클라이언트에서 API 호출 허용
  app.use(cors());
  
  // JSON 파싱 미들웨어 - 큰 용량 파일 처리를 위해 50MB 제한
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 한글 처리를 위한 UTF-8 인코딩 응답 헤더 설정
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // 📸 정적 파일 서빙 - data 폴더의 이미지와 동영상 파일 접근 허용
  // /data/폴더명/파일명 형태로 접근 가능
  app.use('/data', express.static(path.join(__dirname, '../data')));

  // ========================================
  // 🌐 API 라우트 정의
  // ========================================

  /**
   * 서버 상태 체크용 엔드포인트
   * GET /api/ping
   * 용도: 서버가 정상 작동하는지 확인
   */
  app.get("/api/ping", (_req, res) => {
    res.json({ 
      message: "GS1 Video Object Detection Server is running!",
      timestamp: new Date().toISOString()
    });
  });

  /**
   * 🎬 동영상 파일 업로드
   * POST /api/upload-file
   * 
   * 📝 수정 방법:
   * - server/routes/upload.ts의 handleVideoFileUpload 함수 수정
   * - multer 설정 변경 시 uploadMiddleware 수정
   * - 파일 저장 경로 변경 시 storage.destination 수정
   */
  app.post("/api/upload-file", uploadMiddleware, handleVideoFileUpload);

  /**
   * 🗑️ 동영상 삭제
   * DELETE /api/video
   * 
   * 📝 수정 방법:
   * - server/routes/upload.ts의 handleVideoDelete 함수 수정
   * - 삭제 로직 변경 시 해당 함수 내부 수정
   */
  app.delete("/api/video", handleVideoDelete);

  /**
   * 🎨 그리기 데이터 처리
   * POST /api/drawing
   *
   * 📝 수정 방법:
   * - server/routes/drawing.ts의 handleDrawingSubmission 함수 수정
   * - 그리기 데이터 처리 로직 변경 시 해당 파일 수정
   */
  app.post("/api/drawing", handleDrawingSubmission);

  /**
   * 🔗 좌표와 객체명 연결
   * POST /api/drawing/link
   */
  app.post("/api/drawing/link", handleCoordinateLinking);

  /**
   * 🗑️ 임시 좌표 취소/삭제
   * POST /api/drawing/cancel
   */
  app.post("/api/drawing/cancel", handleCoordinateCancellation);

  /**
   * 🔄 좌표 파일 객체 이름 업데이트
   * POST /api/coordinate/update
   */
  app.post("/api/coordinate/update", handleCoordinateUpdate);

  /**
   *  좌표 파일 객체 삭제
   * POST /api/coordinate/delete
   */
  app.post("/api/coordinate/delete", handleCoordinateDelete);

  /**
   * 📄 WebVTT 자막 파일 생성
   * POST /api/webvtt
   * 
   * 📝 수정 방법:
   * - server/routes/webvtt.ts의 handleWebVTTSave 함수 수정
   * - VTT 형식 변경 시 generateCompleteVttContent 함수 수정
   * - 시간 형식 변경 시 formatDuration 함수 수정
   */
  app.post("/api/webvtt", handleWebVTTSave);

  /**
   * 💾 편집 데이터 저장
   * POST /api/save-data
   *
   * 📝 수정 방법:
   * - server/routes/save-data.ts의 handleSaveData 함수 수정
   * - 저장 데이터 구조 변경 시 SaveDataRequest 인터페이스 수정
   */
  app.post("/api/save-data", handleSaveData);

  /**
   * 📍 VTT 좌표 데이터 읽기
   * GET /api/vtt-coordinates
   *
   * 📝 수정 방법:
   * - server/routes/vtt-coordinates.ts의 handleVttCoordinatesRead 함수 수정
   * - 좌표 데이터 파싱 로직 변경 시 extractCoordinatesFromVtt 함수 수정
   */
  app.get("/api/vtt-coordinates", handleVttCoordinatesRead);

  /**
   * 📍 파일명 충돌 체크 및 새 이름 제안
   * GET /api/check-filename?filename=example.mp4
   *
   * 📝 수정 방법:
   * - server/routes/check-filename.ts의 handleFilenameCheck 함수 수정
   * - 파일명 생성 규칙 변경 시 해당 함수 수정
   */
  app.get("/api/check-filename", handleFilenameCheck);

  /**
   * 📸 그리기 영역 스크린샷 저장
   * POST /api/save-screenshot
   *
   * 📋 요청 데이터 (JSON):
   * {
   *   "videoId": "동영상파일명",           // 필수: 연관된 동영상 ID
   *   "drawingId": "drawing_abc123",      // 필수: 그리기 영역 고유 ID
   *   "imageData": "data:image/png;base64,iVBORw0KGgoAAAA...", // 필수: base64 이미지 데이터
   *   "videoCurrentTime": 125.5,          // 선택: 동영상 현재 시간 (초)
   *   "timestamp": 1642345678901          // 선택: 생성 타임스탬프
   * }
   *
   * 📤 응답 데이터:
   * {
   *   "success": true,
   *   "message": "스크린샷이 성공적으로 저장되었습니다.",
   *   "imagePath": "/절대/경로/파일명.png",
   *   "imageUrl": "/data/폴더명/파일명.png",  // 웹에서 접근 가능한 URL
   *   "drawingId": "drawing_abc123",
   *   "timestamp": "2024-01-16T12:34:56.789Z"
   * }
   *
   * 📝 수정 방법:
   * - server/routes/screenshot.ts의 handleSaveScreenshot 함수 수정
   * - 이미지 저장 경로나 처리 로직 변경 시 해당 파일 수정
   * - 이미지 압축이나 리사이징 기능 추가 시 해당 함수에서 처리
   */
  app.post("/api/save-screenshot", handleSaveScreenshot);

  /**
   * 📷 저장된 스크린샷 조회
   * GET /api/screenshot?videoId=example&drawingId=abc123
   *
   * 📋 쿼리 파라미터:
   * - videoId: 동영상 파일명 (필수)
   * - drawingId: 그리기 영역 ID (필수)
   *
   * 📤 응답 데이터 (성공 시):
   * {
   *   "success": true,
   *   "message": "스크린샷을 찾았습니다.",
   *   "imageUrl": "/data/폴더명/파일명.png",
   *   "imagePath": "/절대/경로/파일명.png",
   *   "drawingId": "drawing_abc123"
   * }
   *
   * 📤 응답 데이터 (실패 시):
   * {
   *   "success": false,
   *   "message": "해당 그리기 영역의 스크린샷을 찾을 수 없습니다."
   * }
   *
   * 📝 수정 방법:
   * - server/routes/screenshot.ts의 handleGetScreenshot 함수 수정
   * - 이미지 조회 로직이나 파일명 형식 변경 시 해당 파일 수정
   */
  app.get("/api/screenshot", handleGetScreenshot);

  return app;
}

/**
 * ===================================
 * 🔧 API 수정 가이드
 * ===================================
 * 
 * 1. 새로운 API 추가:
 *    - server/routes/ 폴더에 새 파일 생성
 *    - 여기 index.ts에 import 및 route 추가
 * 
 * 2. 기존 API 수���:
 *    - 각 routes/ 폴더의 해당 파일에서 핸들러 함수 수정
 *    - 인터페이스 변경 시 shared/types.ts도 함께 수정
 * 
 * 3. 클라이언트에서 API 호출:
 *    - client/hooks/useVideoUpload.ts (메인 로직)
 *    - client/components/VideoPlayer.tsx (WebVTT, 그리기 관련)
 * 
 * 4. API URL 변경:
 *    - 프론트엔드: window.location.origin 기반으로 자동 설정
 *    - 다른 도메인 사용 시 각 API 호출 부분에서 baseURL 수정 필요
 */
