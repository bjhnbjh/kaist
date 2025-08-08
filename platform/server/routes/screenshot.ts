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
 * 스크린샷 저장을 위한 이미지 데이터 처리
 * base64 데이터를 파일로 저장
 */
function saveImageToFile(
  videoId: string, 
  drawingId: string, 
  imageData: string, 
  videoCurrentTime?: number
): { imagePath: string; imageUrl: string } {
  try {
    // 실제 업로드된 비디오 폴더 찾기
    const videoFolderName = findActualVideoFolder(videoId);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 폴더가 없으면 생성
    if (!fs.existsSync(videoFolderPath)) {
      fs.mkdirSync(videoFolderPath, { recursive: true });
    }

    // 이미지 데이터에서 헤더 제거 (data:image/png;base64, 부분)
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // 현재 시간을 이용한 파일명 생성
    const currentTime = videoCurrentTime || 0;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeString = `${minutes.toString().padStart(2, '0')}-${seconds.toString().padStart(2, '0')}`;
    
    // 이미지 파일명 생성: {videoFileName}-screenshot-{시간}-{drawingId}.png
    const imageFileName = `${videoFolderName}-screenshot-${timeString}-${drawingId}.png`;
    const imagePath = path.join(videoFolderPath, imageFileName);

    // base64 데이터를 파일로 저장
    fs.writeFileSync(imagePath, base64Data, 'base64');

    // 웹에서 접근 가능한 URL 생성 (정적 파일 서빙용)
    const imageUrl = `/data/${videoFolderName}/${imageFileName}`;

    console.log(`📸 Screenshot saved: ${imagePath}`);
    
    return { imagePath, imageUrl };
    
  } catch (error) {
    console.error('❌ Failed to save screenshot:', error);
    throw error;
  }
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * 스크린샷 저장 핸들러
 * 
 * 📝 수정 포인트:
 * - 이미지 검증: 이미지 크기, 형식 검증 추가
 * - 압축 처리: 이미지 압축 로직 추가
 * - 메타데이터 저장: 이미지 정보를 별도 JSON 파일로 저장
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
 * 저장된 스크린샷 조회 핸들러
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

    // 실제 비디오 폴더 찾기
    const videoFolderName = findActualVideoFolder(videoId as string);
    const videoFolderPath = path.join(DATA_DIR, videoFolderName);

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
