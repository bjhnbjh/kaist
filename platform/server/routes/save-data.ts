import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { normalizeFileName, findActualVideoFolder, getKoreaTimeISO, DATA_DIR } from "../utils/file-utils";

/**
 * ===================================
 * 💾 편집 데이터 저장 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 동영상 편집 세션의 모든 데이터 저장
 * 2. 객체 정보, 그리기 데이터, 메타데이터 통합 관리
 * 3. 버전 관리 (같은 비디오에 대한 여러 저��본 관리)
 * 4. 전역 인덱스와 개별 폴더 저장
 * 
 * 📝 API 수정 가이드:
 * - 저장 데이터 구조 변경: SaveDataRequest 인터페이스 수정
 * - 버전 관리 방식 변경: 버전 증가 로직 수정
 * - 파일 저장 위치 변경: 폴더 구조 수정
 * - 인덱스 구조 변경: 전역 인덱스 파일 형식 수정
 */

// ========================================
// 🛠️ 유틸리티 함수들
// ========================================

/**
 * 한국시간(KST) 기준으로 ISO 문자열 반환
 * @returns {string} KST 시간대의 ISO 문자열
 */
function getKoreaTimeISO(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().replace('Z', '+09:00');
}

/**
 * 파일명을 안전하게 정규화하는 함수 (upload API와 동일)
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
 * 같은 파일명으로 중복 업로드된 경우 정확한 폴더를 찾음
 */
function findActualVideoFolder(videoFileName: string): string {
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

// ========================================
// 📊 타입 정의
// ========================================

/**
 * 편집 데이터 ���장 요청 인터페이스
 * 
 * 📝 수정 포인트:
 * - 새로운 데이터 타입 추가: 이 인터페이스��� 필드 추가
 * - 객체나 그리기 구조 변경: 배열 요소 타입 수정
 * - 메타데이터 확장: 새로운 메타정보 필드 추가
 */
interface SaveDataRequest {
  videoId: string;                      // 동영상 고유 ID
  videoFileName: string;                // 동영상 파일명
  objects: Array<{                      // 탐지된/추가된 객체들
    id: string;
    name: string;
    code?: string;
    additionalInfo?: string;
    dlReservoirDomain?: string;
    category?: string;
    confidence?: number;
    selected?: boolean;
    videoCurrentTime?: number;          // 객체 생성 시점
  }>;
  drawings: Array<{                     // 그리기 영역들
    id: string;
    type: "path" | "rectangle";
    color: string;
    points: Array<{ x: number; y: number }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
    videoCurrentTime?: number;          // 그리기 시점
  }>;
  duration: number;                     // 동영상 길이
  totalFrames: number;                  // 총 프레임 수
  timestamp: number;                    // 저장 요청 타임스탬프
}

// ========================================
// 🗂️ 파일 시스템 설��
// ========================================

// DATA_DIR은 공통 유틸리티에서 가져옴
const SAVED_DATA_INDEX = path.join(DATA_DIR, 'saved-data-all.json');

/**
 * 저장 데이터 디렉토리 및 인덱스 파일 초기화
 * 
 * 📝 수정 포인트:
 * - 초기 인덱스 구조 변경: initialData 객체 수정
 * - 추가 인덱스 파일: 다른 타입의 인덱스 파일 생성
 */
function initializeSaveDataFiles() {
  // data 디렉토리 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory:', DATA_DIR);
  }

  // saved-data-all.json 인덱스 파일 생성
  if (!fs.existsSync(SAVED_DATA_INDEX)) {
    const initialData = {
      savedProjects: [],                // 저장된 프로젝트 목록
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(SAVED_DATA_INDEX, JSON.stringify(initialData, null, 2));
    console.log('📄 Created saved-data index file:', SAVED_DATA_INDEX);
  }
}

// ========================================
// 💾 데이터 저장 함수들
// ========================================

/**
 * 편집 데이터를 동영상 폴더에 저장
 * 
 * 📝 수정 포인트:
 * - 버전 관리 방식 변경: 버전 증가 로직 수정
 * - 프로젝트 레코드 구조 변경: projectRecord 객�� 수정
 * - 파일명 규칙 변경: 저장 파일명 형식 수정
 * 
 * @param {SaveDataRequest} saveData - 저장할 편집 데이터
 * @returns {object} 저장된 프로젝트 레코드
 */
function saveEditedData(saveData: SaveDataRequest) {
  initializeSaveDataFiles();

  // 실제 업로드된 동영상 폴더 찾기
  const actualFolderName = findActualVideoFolder(saveData.videoFileName);
  const videoFolderPath = path.join(DATA_DIR, actualFolderName);

  // 동영상 폴더가 없으면 생성
  if (!fs.existsSync(videoFolderPath)) {
    fs.mkdirSync(videoFolderPath, { recursive: true });
    console.log(`📁 Created video folder: ${videoFolderPath}`);
  }

  // 동영상 폴더 내에 "동영상이름-saved-data.json" 저장
  const savedDataFile = path.join(videoFolderPath, `${actualFolderName}-saved-data.json`);

  // 📊 새 저장 데이터 생성
  const projectRecord = {
    ...saveData,
    videoFolder: actualFolderName,
    savedAt: getKoreaTimeISO(),
    version: 1
  };

  // 🔄 기존 파일이 있으면 버전 증가
  if (fs.existsSync(savedDataFile)) {
    try {
      const existingContent = fs.readFileSync(savedDataFile, 'utf8');
      const existingData = JSON.parse(existingContent);
      projectRecord.version = (existingData.version || 1) + 1;
      console.log(`🔄 Updated project in folder ${actualFolderName}, version: ${projectRecord.version}`);
    } catch (error) {
      console.warn('⚠️ Error reading existing saved data, creating new:', error);
      projectRecord.version = 1;
    }
  } else {
    console.log(`✨ Created new project in folder ${actualFolderName}`);
  }

  // 💾 동영상 폴더에 저장
  fs.writeFileSync(savedDataFile, JSON.stringify(projectRecord, null, 2));
  console.log(`💾 Project data saved to: ${savedDataFile}`);

  // 📋 전역 인덱스 업데이트
  updateProjectIndex(projectRecord);

  return projectRecord;
}

/**
 * 전역 프로젝트 인덱스 업데이트
 * 
 * 📝 수정 포인트:
 * - 인덱스 레코드 구조 변경: indexRecord 객체 수정
 * - 검색/필터링 정보 추가: 추가 메타데이터 포함
 * - 중복 처리 로직 변경: 기존 항목 찾기 조건 수정
 * 
 * @param {object} projectRecord - 업데이트할 프로젝트 레코드
 */
function updateProjectIndex(projectRecord: any) {
  try {
    const indexContent = fs.readFileSync(SAVED_DATA_INDEX, 'utf8');
    const indexData = JSON.parse(indexContent);

    // 같은 비디오ID의 기존 레코드가 있으면 업데이트, 없으면 추가
    const existingIndex = indexData.savedProjects.findIndex(
      (project: any) => project.videoId === projectRecord.videoId
    );

    // 📝 ��덱스용 요약 레코드 생성
    const indexRecord = {
      videoId: projectRecord.videoId,
      videoFileName: projectRecord.videoFileName,
      videoFolder: projectRecord.videoFolder,
      version: projectRecord.version,
      savedAt: projectRecord.savedAt,
      objectCount: projectRecord.objects.length,
      drawingCount: projectRecord.drawings.length,
      duration: projectRecord.duration,
      totalFrames: projectRecord.totalFrames
    };

    if (existingIndex !== -1) {
      // 🔄 기존 항목 업데이트
      indexData.savedProjects[existingIndex] = indexRecord;
      console.log(`🔄 Updated index for video: ${projectRecord.videoId}`);
    } else {
      // ✨ 새 항목 추가
      indexData.savedProjects.push(indexRecord);
      console.log(`✨ Added new index entry for video: ${projectRecord.videoId}`);
    }

    indexData.lastUpdated = getKoreaTimeISO();
    fs.writeFileSync(SAVED_DATA_INDEX, JSON.stringify(indexData, null, 2));
    console.log(`📋 Global index updated: ${SAVED_DATA_INDEX}`);

  } catch (error) {
    console.error('❌ Error updating project index:', error);
  }
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * 편집 데이터 저장 API 핸들러
 * 
 * 📝 수정 포인트:
 * - 요청 검증 강화: 필수 필드나 데이터 유효성 검증 추가
 * - 응답 구조 변경: response 객체에 더 많은 정보 포함
 * - 후처리 로직 추가: 저장 후 추가 작업 (알림, 백업 등)
 * 
 * @route POST /api/save-data
 * @param {Request} req - Express 요청 객체 (SaveDataRequest 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleSaveData: RequestHandler = (req, res) => {
  try {
    const saveData: SaveDataRequest = req.body;
    
    // 📋 요청 데이터 로깅
    console.log('💾 Save data request received:', {
      videoId: saveData.videoId,
      videoFileName: saveData.videoFileName,
      objectCount: saveData.objects.length,
      drawingCount: saveData.drawings.length,
      duration: saveData.duration
    });

    // ✅ 필수 필드 검증
    if (!saveData.videoId || !saveData.videoFileName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 videoFileName은 필수 항목입니다.'
      });
    }

    // 📊 데이터 유효성 간단 검증
    if (!Array.isArray(saveData.objects) || !Array.isArray(saveData.drawings)) {
      return res.status(400).json({
        success: false,
        message: 'objects와 drawings는 배열이어야 합니다.'
      });
    }
    
    // 💾 로컬 DB(JSON 파일)에 저장
    const savedProject = saveEditedData(saveData);
    
    // 🎉 성공 응답
    const response = {
      success: true,
      message: '편집 데이터가 성공적으로 DB에 저장되었습니다.',
      videoId: saveData.videoId,
      projectVersion: savedProject.version,
      savedAt: savedProject.savedAt,
      videoFolder: savedProject.videoFolder,
      statistics: {
        objectCount: saveData.objects.length,
        drawingCount: saveData.drawings.length,
        duration: saveData.duration,
        totalFrames: saveData.totalFrames
      },
      details: {
        isNewProject: savedProject.version === 1,
        hasObjects: saveData.objects.length > 0,
        hasDrawings: saveData.drawings.length > 0
      }
    };
    
    res.json(response);

  } catch (error) {
    console.error('❌ Save data error:', error);
    res.status(500).json({
      success: false,
      message: '편집 데이터 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * ===================================
 * 📝 Save Data API 사용법 및 수정 가이드
 * ===================================
 * 
 * 🔧 주요 수정 ��인트:
 * 
 * 1. 저장 데이터 구조 변경:
 *    - SaveDataRequest 인터페이스 수정
 *    - objects나 drawings ��열의 요소 타입 변경
 * 
 * 2. 버전 관리 방식 변���:
 *    - saveEditedData 함수의 버전 증가 로직 수정
 *    - 날짜 기반이나 다른 버전 관리 방식 구현
 * 
 * 3. 파일 저장 위치 변경:
 *    - DATA_DIR 상수 수정
 *    - 폴더 구조나 파일명 규칙 변경
 * 
 * 4. 인덱스 구조 변경:
 *    - updateProjectIndex 함수의 indexRecord 수정
 *    - 검색이나 필터링을 위한 추가 메타데이터 포함
 * 
 * 5. 응답 구조 변경:
 *    - handleSaveData의 response 객체 수정
 *    - 클라이언트에서 받는 데이터 구조도 함께 수정 필요
 * 
 * 📡 클라이언트 연동:
 * - client/components/VideoPlayer.tsx의 saveDataToDb 함수에서 호출
 * - "최종저장" 버튼 클릭 시 이 API가 호출됨
 * - WebVTT 저장과 함께 순차적으로 실행됨
 */
