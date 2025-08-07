import express from "express";
import cors from "cors";
// 핵심 API 라우터들만 import (demo 제거)
import { handleDrawingSubmission } from "./routes/drawing";
import { handleVideoFileUpload, handleVideoDelete, uploadMiddleware } from "./routes/upload";
import { handleWebVTTSave } from "./routes/webvtt";
import { handleSaveData } from "./routes/save-data";

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
 * 4. POST /api/webvtt           - WebVTT 자막 파일 생성/업데이트
 * 5. POST /api/save-data        - 편집 데이터 JSON 저장
 * 6. GET /api/vtt-coordinates   - VTT 파일에서 좌표 데이터 읽기
 * 
 * 📂 데이터 저장 구조:
 * data/
 * ├── 동영상파일명/
 * │   ├── 동영상파일명.mp4
 * │   ├── 동영상파일명-webvtt.vtt
 * │   ├── 동영상파일명-saved-data.json
 * │   └── 동영상파일명-uploads.json
 * └── uploads-all.json (전체 업로드 인덱스)
 */

export function createServer() {
  const app = express();

  // ========================================
  // 🔧 미들웨어 설정
  // ========================================
  
  // CORS 설정 - 클라이언트에서 API 호출 허용
  app.use(cors());
  
  // JSON 파싱 미들웨어 - 큰 용량 파일 처리를 위해 50MB 제한
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 한글 처리를 위한 UTF-8 인코딩 응답 헤더 설정
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // ========================================
  // 🌐 API 라우트 정의
  // ========================================

  /**
   * 서버 상태 체크용 엔드포인트
   * GET /api/ping
   * ��도: 서버가 정상 작동하는지 확인
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
   * 🎨 ���리기 데이터 처리
   * POST /api/drawing
   * 
   * 📝 수정 방법:
   * - server/routes/drawing.ts의 handleDrawingSubmission 함수 수정
   * - 그리기 데이터 처리 로직 변경 시 해당 파일 수정
   */
  app.post("/api/drawing", handleDrawingSubmission);

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
 * 2. 기존 API 수정:
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
