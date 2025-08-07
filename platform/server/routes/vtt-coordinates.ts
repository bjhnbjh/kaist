import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

/**
 * ===================================
 * 📍 VTT 좌표 데이터 읽기 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. VTT 파일에서 좌표 정보 추출
 * 2. 비디오 재생 시간에 맞는 좌표 데이터 제공
 * 3. 오버레이 표시용 좌표 데이터 반환
 */

// ========================================
// 🛠️ 유틸리티 함수들
// ========================================

/**
 * 파일명을 안전하게 정규화하는 함수 (한글 지원)
 * @param {string} fileName - 원본 파일명
 * @returns {string} 정규화된 파일명
 */
function normalizeFileName(fileName: string): string {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  let normalized = baseName.normalize('NFC').trim();
  normalized = normalized
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^\w가-힣\-_.()]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'unnamed';
}

/**
 * VTT 파일에서 좌표 데이터 추출
 * @param {string} content - VTT 파일 내용
 * @returns {Array} 좌표 데이터 배열
 */
function extractCoordinatesFromVtt(content: string): any[] {
  const coordinates: any[] = [];
  const lines = content.split('\n');

  let inCoordinatesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'COORDINATES_DATA_START') {
      inCoordinatesSection = true;
      continue;
    } else if (line === 'COORDINATES_DATA_END') {
      inCoordinatesSection = false;
      continue;
    } else if (inCoordinatesSection && line.startsWith('{')) {
      try {
        const objectData = JSON.parse(line);
        // Transform to the format expected by client
        const transformedData = {
          objectName: objectData.name,
          videoTime: objectData.videoTime,
          code: objectData.code,
          category: objectData.category,
          domain: objectData.domain,
          info: objectData.info,
          finallink: objectData.finallink,
          position: objectData.position,
          polygon: objectData.polygon,
          coordinates: objectData.position  // For backward compatibility
        };
        coordinates.push(transformedData);
      } catch (e) {
        console.warn('Failed to parse object data:', line);
      }
    }
  }

  return coordinates;
}

// ========================================
// 📊 타입 정의
// ========================================

interface CoordinatesRequest {
  videoId: string;
  videoFileName: string;
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * VTT 좌표 데이터 읽기 핸들러
 * 
 * @route GET /api/vtt-coordinates?videoId=xxx&videoFileName=xxx
 * @param {Request} req - Express 요청 객체
 * @param {Response} res - Express 응답 객체
 */
export const handleVttCoordinatesRead: RequestHandler = (req, res) => {
  try {
    const { videoId, videoFileName } = req.query as any;

    // 필수 파라미터 검증
    if (!videoId || !videoFileName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 videoFileName 파라미터가 필요합니다.'
      });
    }

    // VTT 파일 경로 생성
    const DATA_DIR = path.join(process.cwd(), 'data');
    const normalizedName = normalizeFileName(videoFileName);
    const videoFolderPath = path.join(DATA_DIR, normalizedName);
    const vttFilePath = path.join(videoFolderPath, `${normalizedName}-webvtt.vtt`);

    console.log('🔍 VTT 좌표 읽기 요청:', {
      videoId,
      videoFileName,
      vttFilePath
    });

    // VTT 파일 존재 확인
    if (!fs.existsSync(vttFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'VTT 파일을 찾을 수 없습니다.',
        filePath: vttFilePath
      });
    }

    // VTT 파일 읽기
    const vttContent = fs.readFileSync(vttFilePath, 'utf8');
    
    // 좌표 데이터 추출
    const coordinates = extractCoordinatesFromVtt(vttContent);

    console.log(`📍 추출된 좌표 데이터: ${coordinates.length}개`);

    // 성공 응답
    const response = {
      success: true,
      message: 'VTT 좌표 데이터를 성공적으로 읽어왔습니다.',
      videoId,
      videoFileName,
      coordinatesCount: coordinates.length,
      coordinates: coordinates,
      readAt: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ VTT 좌표 읽기 오류:', error);
    res.status(500).json({
      success: false,
      message: 'VTT 좌표 데이터 읽기 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
