import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { normalizeFileName, findActualVideoFolder, DATA_DIR } from "../utils/file-utils";

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
// 🛠️ 공통 유틸리티 사용
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
 * 실제 업로드된 비디오 폴더명 찾기 함수
 * 같은 파일명으로 중복 업로드된 경우 정확한 폴더를 찾기
 */
function findActualVideoFolder(videoFileName: string): string {
  const DATA_DIR = path.join(process.cwd(), 'data');
  const normalizedName = normalizeFileName(videoFileName);
  let actualFolderName = normalizedName;

  // 기본 폴더가 있는지 확인
  const baseFolderPath = path.join(DATA_DIR, normalizedName);
  if (fs.existsSync(baseFolderPath)) {
    return normalizedName;
  }

  // 중복 폴더들 중에서 찾기 (1), (2), (3) 등
  for (let i = 1; i <= 20; i++) {
    const candidateFolderName = `${normalizedName}(${i})`;
    const candidateFolderPath = path.join(DATA_DIR, candidateFolderName);

    if (fs.existsSync(candidateFolderPath)) {
      // 해당 폴더에 실제 영상 파일이 있는지 확인
      const videoFilePath = path.join(candidateFolderPath, videoFileName);
      if (fs.existsSync(videoFilePath)) {
        // 가장 최근에 수정된 폴더를 사용
        actualFolderName = candidateFolderName;
      }
    }
  }

  return actualFolderName;
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
  let currentObjectLines: string[] = [];
  let isCollectingObject = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'COORDINATES_DATA_START') {
      inCoordinatesSection = true;
      continue;
    } else if (line === 'COORDINATES_DATA_END') {
      inCoordinatesSection = false;
      // 마지막 객체 처리
      if (currentObjectLines.length > 0) {
        processCollectedObject(currentObjectLines, coordinates);
        currentObjectLines = [];
      }
      continue;
    } else if (inCoordinatesSection) {
      if (line.startsWith('object')) {
        // 이전 객체 처리
        if (currentObjectLines.length > 0) {
          processCollectedObject(currentObjectLines, coordinates);
        }
        // 새 객체 시작
        currentObjectLines = [];
        isCollectingObject = true;
      } else if (isCollectingObject && line) {
        currentObjectLines.push(line);
      }
    }
  }

  return coordinates;
}

/**
 * 수집된 객체 라인들을 파싱하여 좌표 배열에 추가
 */
function processCollectedObject(objectLines: string[], coordinates: any[]): void {
  try {
    const jsonString = objectLines.join('\n');
    const objectData = JSON.parse(jsonString);

    // Transform to the format expected by client
    const transformedData = {
      "이름": objectData["이름"] || objectData.name,
      "시간": objectData["시간"] || objectData.videoTime,
      "code": objectData.code,
      "catefory": objectData["catefory"] || objectData.category,
      "도메인": objectData["도메인"] || objectData.domain,
      "정보": objectData["정보"] || objectData.info,
      "finallink": objectData.finallink,
      "position": objectData.position,
      "polygon": objectData.polygon
    };
    coordinates.push(transformedData);
  } catch (e) {
    console.warn('Failed to parse coordinates data:', objectLines.join(' '));
  }
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
    const { videoId, videoFileName, videoFolder } = req.query as any;

    // 필수 파라미터 검증
    if (!videoId || !videoFileName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 videoFileName 파라미터가 필요합니다.'
      });
    }

    // VTT 파일 경로 생성 (videoFolder 우선 사용)
    const actualFolderName = videoFolder || findActualVideoFolder(videoFileName);
    const videoFolderPath = path.join(DATA_DIR, actualFolderName);
    const vttFilePath = path.join(videoFolderPath, `${actualFolderName}-webvtt.vtt`);

    console.log('🔍 VTT 좌표 읽기 요청:', {
      videoId,
      videoFileName,
      videoFolder,
      actualFolderName,
      vttFilePath,
      folderExists: fs.existsSync(path.join(DATA_DIR, actualFolderName)),
      vttFileExists: fs.existsSync(vttFilePath)
    });

    // VTT 파일 존재 확인
    if (!fs.existsSync(vttFilePath)) {
      console.log(`📄 VTT 파일이 아직 생성되지 않음: ${vttFilePath}`);
      return res.status(404).json({
        success: false,
        message: 'VTT 파일이 아직 생성되지 않았습니다.',
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
