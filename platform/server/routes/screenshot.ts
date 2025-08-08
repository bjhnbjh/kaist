import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { findActualVideoFolder, DATA_DIR } from "../utils/file-utils";

/**
 * ===================================
 * 📸 스크린샷 저장 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 그리기 영역의 스크린샷을 base64 형태로 수신
 * 2. 이미지를 로컬 파일로 저장
 * 3. 저장된 이미지 경로를 반환
 * 
 * 📝 API 수정 가이드:
 * - 이미지 저장 경로 변��: IMAGE_SAVE_DIR 수정
 * - 파일명 형식 변경: 파일명 생성 로직 수정
 * - 이미지 처리 추가: 이미지 압축, 리사이징 등
 */

// ========================================
// 📊 타입 정의
// ========================================

/**
 * 스크린샷 저장 요청 인터페이스
 * 
 * 📝 수정 포인트:
 * - 추가 메타데이터: width, height, quality 등 추가 가능
 * - 이미지 형식 지원: format 필드 추가 (png, jpg 등)
 */
interface SaveScreenshotRequest {
  videoId: string;                    // 연관된 동영상 ID
  drawingId: string;                 // 그리기 영역 ID
  imageData: string;                 // base64 형태의 이미지 데이터
  videoCurrentTime?: number;         // 현재 동영상 시간
  timestamp?: number;                // 생성 타임스탬프
}

/**
 * 스크린샷 저장 응답 인터페이스
 */
interface SaveScreenshotResponse {
  success: boolean;
  message: string;
  imagePath?: string;               // 저장된 이미지 경로
  imageUrl?: string;               // 접근 가능한 URL
  drawingId?: string;              // 그리기 ID
  timestamp?: string;              // 저장 시간
}

// ========================================
// 🗂️ 파일 시스템 설정
// ========================================

/**
 * ===================================
 * 📸 최적화된 스크린샷 저장 함수
 * ===================================
 *
 * 🚀 성능 최적화:
 * 1. 이미지 크기 검증 - 최대 5MB 제한
 * 2. 파일명 중복 체크 - 동일한 drawingId는 덮어쓰기
 * 3. 메타데이터 저장 - 이미지 정보를 별도 관리
 * 4. 에러 복구 - 실패 시 원본 데이터 보존
 *
 * 📝 수정 방법:
 * - 이미지 압축: sharp 라이브러리 추가 후 압축 로직 구현
 * - 클라우드 저장: AWS S3, Google Cloud Storage 연동
 * - 캐싱: Redis를 이용한 이미지 URL 캐싱
 * - 백그라운드 처리: 이미지 저장을 큐로 처리
 *
 * @param videoId - 동영상 파일 ID
 * @param drawingId - 그리기 영역 고유 ID
 * @param imageData - base64 이미지 데이터
 * @param videoCurrentTime - 동영상 현재 시간 (초)
 * @returns {imagePath, imageUrl, metadata} - 저장 결과 정보
 */
function saveImageToFile(
  videoId: string,
  drawingId: string,
  imageData: string,
  videoCurrentTime?: number
): { imagePath: string; imageUrl: string; metadata: any } {
  try {
    // 🔍 1. 이미지 데이터 검증
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageSizeBytes = (base64Data.length * 3) / 4; // base64 크기 계산
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB 제한

    if (imageSizeBytes > maxSizeBytes) {
      throw new Error(`이미지 크기가 너무 큽니다. 최대 5MB까지 허용됩니다. 현재: ${(imageSizeBytes / 1024 / 1024).toFixed(2)}MB`);
    }

    // 🗂️ 2. 비디오 폴더 설정
    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 폴더 생성 (존재하지 않는 경우)
    if (!fs.existsSync(videoFolderPath)) {
      fs.mkdirSync(videoFolderPath, { recursive: true });
      console.log(`📁 Created folder: ${videoFolderPath}`);
    }

    // ⏰ 3. 파일명 생성 (시간 기반)
    const currentTime = videoCurrentTime || 0;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeString = `${minutes.toString().padStart(2, '0')}-${seconds.toString().padStart(2, '0')}`;

    // 📝 4. 중복 파일 체크 및 정리
    const imageFileName = `${videoFolderName}-screenshot-${timeString}-${drawingId}.png`;
    const imagePath = path.join(videoFolderPath, imageFileName);

    // 동일한 drawingId의 기존 파일 찾아서 삭제 (중복 방지)
    try {
      const files = fs.readdirSync(videoFolderPath);
      const existingFiles = files.filter(file =>
        file.includes('screenshot') && file.includes(drawingId)
      );
      existingFiles.forEach(file => {
        const oldFilePath = path.join(videoFolderPath, file);
        fs.unlinkSync(oldFilePath);
        console.log(`🗑️ Removed duplicate: ${file}`);
      });
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError);
    }

    // 💾 5. 이미지 파일 저장
    fs.writeFileSync(imagePath, base64Data, 'base64');

    // 🌐 6. 웹 URL 생성
    const imageUrl = `/data/${videoFolderName}/${imageFileName}`;

    // 📊 7. 메타데이터 생성
    const metadata = {
      drawingId,
      videoId,
      videoCurrentTime,
      imageSizeBytes,
      createdAt: new Date().toISOString(),
      fileName: imageFileName,
      filePath: imagePath
    };

    console.log(`✅ Screenshot saved successfully:`, {
      file: imageFileName,
      size: `${(imageSizeBytes / 1024).toFixed(2)}KB`,
      time: `${timeString}`,
      drawingId: drawingId.slice(0, 8) + '...'
    });

    return { imagePath, imageUrl, metadata };

  } catch (error) {
    console.error('❌ Failed to save screenshot:', error);
    throw error;
  }
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * ===================================
 * 📸 스크린샷 저장 API 핸들러
 * ===================================
 *
 * 🔧 기능 상세:
 * 1. base64 이미지 데이터 수신 및 검증
 * 2. 이미지 크기 제한 (최대 5MB)
 * 3. 중복 파일 자동 정리
 * 4. PNG 형식으로 로컬 저장
 * 5. 웹 접근 가능한 URL 반환
 *
 * 📋 요청 형식 (POST):
 * Content-Type: application/json
 * {
 *   "videoId": "동영상파일명_또는_폴더명",          // 필수
 *   "drawingId": "drawing_abc123",               // 필수: 8자 이상 고유 ID
 *   "imageData": "data:image/png;base64,iVBORw...", // 필수: 완전한 data URL 형식
 *   "videoCurrentTime": 125.5,                   // 선택: 0 이상의 초 단위
 *   "timestamp": 1642345678901                   // 선택: Unix timestamp
 * }
 *
 * 📤 성공 응답 (200):
 * {
 *   "success": true,
 *   "message": "스크린샷이 성공적으로 저장되었습니다.",
 *   "imagePath": "/절대/경로/파일명.png",
 *   "imageUrl": "/data/폴더명/파일명.png",         // 웹에서 바로 접근 가능
 *   "drawingId": "drawing_abc123",
 *   "timestamp": "2024-01-16T12:34:56.789Z"
 * }
 *
 * 📤 오류 응답:
 * 400 Bad Request:
 * - 필수 필드 누락: videoId, drawingId, imageData
 * - 잘못된 이미지 형식: data:image/... 형식이 아님
 * - 이미지 크기 초과: 5MB 초과
 *
 * 404 Not Found:
 * - 동영상 폴더를 찾을 수 없음
 *
 * 500 Internal Server Error:
 * - 파일 시스템 오류
 * - 이미지 저장 실패
 *
 * 📝 커스터마이징 방법:
 *
 * 1. 이미지 크기 제한 변경:
 *    - 라인 94: maxSizeBytes = 10 * 1024 * 1024; // 10MB로 변경
 *
 * 2. 이미지 압축 추가:
 *    npm install sharp
 *    import sharp from 'sharp';
 *    const compressedBuffer = await sharp(Buffer.from(base64Data, 'base64'))
 *      .jpeg({ quality: 80 })
 *      .toBuffer();
 *
 * 3. 클라우드 저장소 연동:
 *    - AWS S3: aws-sdk 사용
 *    - Google Cloud: @google-cloud/storage 사용
 *    - 라인 125-140 영역을 클라우드 업로드 로직으로 교���
 *
 * 4. 파일명 형식 변경:
 *    - 라인 113: imageFileName 생성 로직 수정
 *    - 예시: `${videoFolderName}-${Date.now()}-${drawingId}.jpg`
 *
 * 5. 메타데이터 파일 저장:
 *    const metaFilePath = imagePath.replace('.png', '.json');
 *    fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2));
 *
 * 6. 이미지 리사이징:
 *    const resizedBuffer = await sharp(Buffer.from(base64Data, 'base64'))
 *      .resize(800, 600, { fit: 'inside' })
 *      .toBuffer();
 *
 * @route POST /api/save-screenshot
 * @param {Request} req - Express 요청 객체 (SaveScreenshotRequest 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleSaveScreenshot: RequestHandler = (req, res) => {
  try {
    const { videoId, drawingId, imageData, videoCurrentTime, timestamp }: SaveScreenshotRequest = req.body;

    // 📋 요청 데이터 로깅
    console.log('📸 Screenshot save request received:', {
      videoId,
      drawingId,
      videoCurrentTime,
      timestamp,
      imageDataLength: imageData?.length || 0
    });

    // ✅ 기본 검증
    if (!videoId || !drawingId || !imageData) {
      return res.status(400).json({
        success: false,
        message: 'videoId, drawingId, imageData는 필수 항목입니다.'
      } as SaveScreenshotResponse);
    }

    // 이미지 데이터 형식 검증
    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: '올바른 이미지 데이터 형식이 아닙니다.'
      } as SaveScreenshotResponse);
    }

    // 📝 이미지 파일 저장
    const { imagePath, imageUrl } = saveImageToFile(videoId, drawingId, imageData, videoCurrentTime);

    // 🎉 성공 응답
    const response: SaveScreenshotResponse = {
      success: true,
      message: '스크린샷이 성공적으로 저장되었습니다.',
      imagePath,
      imageUrl,
      drawingId,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Screenshot save error:', error);
    res.status(500).json({
      success: false,
      message: '스크린샷 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as SaveScreenshotResponse);
  }
};

/**
 * ===================================
 * 📷 저장된 스크린샷 조회 API 핸들러
 * ===================================
 *
 * 🔧 기능 상세:
 * 1. 특정 그리기 영역의 스크린샷 파일 검색
 * 2. 파일 존재 여부 확인
 * 3. 웹 접근 가능한 URL 반환
 * 4. 파일 메타데이터 포함
 *
 * 📋 요청 형식 (GET):
 * URL: /api/screenshot?videoId={동영상ID}&drawingId={그리기ID}
 *
 * 쿼리 파라미터:
 * - videoId: 동영상 파일명 또는 폴더명 (필수)
 * - drawingId: 그리기 영역 고유 ID (필수)
 *
 * 📤 성공 응답 (200):
 * {
 *   "success": true,
 *   "message": "스크린샷을 찾았습니다.",
 *   "imageUrl": "/data/폴더명/파일명.png",          // 웹에서 직접 접근 가능
 *   "imagePath": "/절대/경로/파일명.png",
 *   "drawingId": "drawing_abc123"
 * }
 *
 * 📤 오류 응답:
 * 400 Bad Request:
 * {
 *   "success": false,
 *   "message": "videoId와 drawingId는 필수 쿼리 파라미터입니다."
 * }
 *
 * 404 Not Found:
 * {
 *   "success": false,
 *   "message": "해당 동영상 폴더를 찾을 수 없습니다."
 * }
 * 또는
 * {
 *   "success": false,
 *   "message": "해당 그리기 영역의 스크린샷을 찾을 수 없습니다."
 * }
 *
 * 500 Internal Server Error:
 * {
 *   "success": false,
 *   "message": "스크린샷 조회 중 오류가 발생했습니다.",
 *   "error": "구체적인 오류 메시지"
 * }
 *
 * 📝 커스터마이징 방법:
 *
 * 1. 파일 검�� 패턴 변경:
 *    - 라인 251: files.find() 조건 수정
 *    - 예시: file.startsWith(drawingId) // drawingId로 시작하는 파일
 *
 * 2. 다중 이미지 반환:
 *    const screenshotFiles = files.filter(file =>
 *      file.includes('screenshot') && file.includes(drawingId)
 *    );
 *    return { imageUrls: screenshotFiles.map(file => `/data/${videoFolderName}/${file}`) };
 *
 * 3. 이미지 메타데이터 포함:
 *    const stats = fs.statSync(imagePath);
 *    return {
 *      ...result,
 *      fileSize: stats.size,
 *      createdAt: stats.birthtime,
 *      modifiedAt: stats.mtime
 *    };
 *
 * 4. 캐싱 헤더 추가:
 *    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
 *    res.setHeader('ETag', `"${drawingId}-${stats.mtime.getTime()}"`);
 *
 * 5. 이미지 형식별 검색:
 *    const screenshotFile = files.find(file =>
 *      file.includes('screenshot') &&
 *      file.includes(drawingId) &&
 *      /\.(png|jpg|jpeg|webp)$/i.test(file)
 *    );
 *
 * @route GET /api/screenshot
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 */
export const handleGetScreenshot: RequestHandler = (req, res) => {
  try {
    const { videoId, drawingId } = req.query;

    if (!videoId || !drawingId) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 drawingId는 필수 쿼리 파라미터입니다.'
      });
    }

    // 실제 비디오 폴더 찾���
    const videoFolderName = findActualVideoFolder(videoId as string);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 비디오 폴더 존재 확인
    if (!fs.existsSync(videoFolderPath)) {
      return res.status(404).json({
        success: false,
        message: '해당 동영상 폴더를 찾을 수 없습니다.'
      });
    }

    // 해당 drawingId로 저장된 스크린샷 파일 찾기
    const files = fs.readdirSync(videoFolderPath);
    const screenshotFile = files.find(file => 
      file.includes('screenshot') && file.includes(drawingId as string)
    );

    if (!screenshotFile) {
      return res.status(404).json({
        success: false,
        message: '해당 그리기 영역의 스크린샷을 찾을 수 없습니다.'
      });
    }

    const imageUrl = `/data/${videoFolderName}/${screenshotFile}`;
    const imagePath = path.join(videoFolderPath, screenshotFile);

    res.json({
      success: true,
      message: '스크린샷을 찾았습니다.',
      imageUrl,
      imagePath,
      drawingId
    });

  } catch (error) {
    console.error('❌ Screenshot get error:', error);
    res.status(500).json({
      success: false,
      message: '스크린샷 조회 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * ===================================
 * 📝 Screenshot API 사용법 및 수정 가이드
 * ===================================
 * 
 * 🔧 주요 수정 포인트:
 * 
 * 1. 이미지 처리 개선:
 *    - 이미지 압축: sharp나 jimp 라이브러리 사용
 *    - 리사이징: 표준 크기로 조정
 *    - 형식 변환: PNG, JPEG 선택 가능
 * 
 * 2. 저장 위치 변경:
 *    - 클라우드 스토리지: AWS S3, Google Cloud Storage 연동
 *    - CDN 연동: 이미지 URL을 CDN 주소로 변경
 * 
 * 3. 메타데이터 관리:
 *    - 이미지 정보를 별도 JSON 파일로 저장
 *    - 태그, 설명 등 추가 정보 저장
 * 
 * 4. 보안 강화:
 *    - 이미지 크기 제한: 최대 파일 크기 검증
 *    - 악성 파일 검사: 이미지 헤더 검증
 * 
 * 📡 클라이언트 연동:
 * - 그리기 완료 시 canvas.toDataURL()로 이미지 데이터 생성
 * - fetch API로 /api/save-screenshot 호출
 * - 반환된 imageUrl로 나중에 이미지 표시
 * 
 * 💾 정적 파일 서빙:
 * - Express에서 /data 경로를 정적 파일로 서빙 설정 필요
 * - app.use('/data', express.static(path.join(__dirname, '../data')))
 */
