import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { getKoreaTimeISO, normalizeFileName, getDataDirectory, ensureDirectoryExists } from "../utils/common";

/**
 * ===================================
 * 🎬 동영상 업로드 및 관리 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 동영상 파일 업로드 처리 (multer 사용)
 * 2. 중복 파일명 처리 (자동으로 (1), (2) 추가)
 * 3. 동영상 폴더 및 메타데이터 관리
 * 4. 동영상 삭제 (폴더 전체 삭제)
 * 
 * 📝 API 수정 가이드:
 * - 파일 저장 경로 변경: storage.destination 함수 수정
 * - 파일명 규칙 변경: normalizeFileName 함수 수정
 * - 업로드 제한 변경: multer limits 옵션 수정
 * - 삭제 로직 변경: handleVideoDelete 함수 수정
 */

// ========================================
// 🛠️ 유틸리티 함수들
// ========================================

// getKoreaTimeISO 함수는 ../utils/common.ts에서 import하여 사용

/**
 * 파일명을 안전하게 정규화하��� 함수 (한글 지원)
 * 
 * 📝 수정 포인트:
 * - 허용할 특수문자 변경: 정규식 패턴 수정
 * - 파일명 길이 제한: 여기에 추가 로직 구현
 * - 금지 단어 필터링: 여기에 추가 로직 구현
 * 
 * @param {string} fileName - 원본 파일명
 * @returns {string} 정규화된 파일명
 */
function normalizeFileName(fileName: string): string {
  try {
    console.log('🔍 Original fileName:', fileName);

    // 확장자 분리
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    // 파일명을 UTF-8로 정규화
    let normalized = baseName.normalize('NFC').trim();

    // 한국�� 인코딩 문제 복구 시도
    if (normalized.includes('ì') || normalized.includes('ë') || normalized.includes('°')) {
      try {
        const buffer = Buffer.from(normalized, 'latin1');
        normalized = buffer.toString('utf8');
        console.log('🔧 Decoded normalized:', normalized);
      } catch (decodeError) {
        console.log('⚠️ Decode failed, keeping original');
      }
    }

    // 공백을 언더스코어로 변경 (파일시스템 호환성)
    normalized = normalized.replace(/\s+/g, '_');

    console.log('✅ Final normalized:', normalized);
    return normalized || 'unnamed';
  } catch (error) {
    console.error('❌ normalizeFileName error:', error);
    return 'unnamed';
  }
}

// ========================================
// 📊 타입 정의
// ========================================

/**
 * 업로드 데이터 인터페이스
 * 
 * 📝 수정 포인트:
 * - 새로운 메타데이터 추가 시 이 인터페이���에 필드 추가
 * - 파일 정보 구조 변경 시 여기 수정
 */
interface UploadData {
  id: string;                    // 고유 식별자
  fileName: string;              // 원본 파일명
  fileSize: number;              // 파일 크기 (바이트)
  fileType: string;              // MIME 타입
  duration: number;              // 동영상 길이 (초)
  timestamp: number;             // 업로드 타임스탬프
  metadata?: {                   // 선택적 메타데이터
    width?: number;              // 동영상 가로 해상도
    height?: number;             // 동영상 세로 해상도
    fps?: number;                // 프레임 레이트 (향후 확장용)
  };
}

// ========================================
// 🗂️ 파일 시스템 설정
// ========================================

// 데이터 저장 디렉토리 경로 (프로젝트 루트/data)
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads-all.json');

/**
 * Multer 파일 저장 설정
 * 
 * 📝 수정 포인트:
 * - 저장 경로 변경: destination 함수의 DATA_DIR 수정
 * - 파일명 규칙 변경: filename 함수 수정
 * - 중복 처리 로직 변경: destination 함수의 while 루프 수정
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // data 디렉토리 생성 (없으면)
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 동영상 파일명을 정규화
    const normalizedName = normalizeFileName(file.originalname);
    let videoFolderName = normalizedName;
    let videoFolderPath = path.join(DATA_DIR, videoFolderName);

    // 🔄 중복 폴더 처리: (1), (2), (3) 형태로 번호 추가
    let counter = 1;
    while (fs.existsSync(videoFolderPath)) {
      videoFolderName = `${normalizedName}(${counter})`;
      videoFolderPath = path.join(DATA_DIR, videoFolderName);
      counter++;
    }

    // 폴더 생성
    if (!fs.existsSync(videoFolderPath)) {
      fs.mkdirSync(videoFolderPath, { recursive: true });
    }

    // Express 요청 객체에 폴더 정보 저장 (나중에 사용)
    (req as any).videoFolder = videoFolderName;
    (req as any).videoFolderPath = videoFolderPath;

    console.log(`📁 Created video folder: ${videoFolderPath}`);
    cb(null, videoFolderPath);
  },
  
  filename: (req, file, cb) => {
    // 파일명 인코딩 문제 해결
    let cleanedName = file.originalname;

    // 한국어 인코딩 문제 복구
    if (cleanedName.includes('ì') || cleanedName.includes('ë') || cleanedName.includes('°')) {
      try {
        const buffer = Buffer.from(cleanedName, 'latin1');
        cleanedName = buffer.toString('utf8');
        console.log('🔧 Corrected filename:', cleanedName);
      } catch (error) {
        console.log('⚠️ Failed to correct filename, using original');
      }
    }

    cb(null, cleanedName);
  }
});

/**
 * 파일 필터 - 동영상 파일만 허용
 * 
 * 📝 수정 포인트:
 * - 허용할 파일 형��� 변경: mimetype 조건 수정
 * - 파일 크기 제한 변경: limits.fileSize 수정
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('동영상 파일만 업로드 가능합니다.'));
  }
};

/**
 * Multer 미들웨어 설정
 * 
 * 📝 수정 포인트:
 * - 파일 크기 제한 변경: limits.fileSize 값 수정
 * - 메모리 사용��� 조정: 큰 파일 처리 시 성능 고려
 */
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB 제한 (필요 시 수정)
  }
}).single('video'); // 'video' 필드명으로 단일 파일 업로드

// ========================================
// 💾 데이터 저장 함수들
// ========================================

/**
 * 업로드 데이터를 JSON 파일에 저장
 * 
 * 📝 수정 포인트:
 * - 저장 데이터 구조 변경: uploadRecord 객체 수정
 * - 인덱스 파일 구조 변경: globalData 구조 수정
 * - 로컬 파일 저장 로직 변경: localUploadData 구조 수정
 * 
 * @param {UploadData} uploadData - 저장할 업로드 데이터
 * @param {string} filePath - 저장된 파일의 실제 경로
 * @param {string} videoFolder - 동영상 폴더���
 * @returns {object} 저장된 레코드 정보
 */
function saveUploadData(uploadData: UploadData, filePath?: string, videoFolder?: string) {
  // data 디렉토리 초기화
  initializeDataFiles();

  // 업로드 레코드 생성
  const uploadRecord = {
    ...uploadData,
    filePath: filePath || null,
    videoFolder: videoFolder || null,
    uploadedAt: getKoreaTimeISO(),
    status: 'uploaded'
  };

  // 1. 전역 인덱��� 파일 업데이트 (uploads-all.json)
  const globalFileContent = fs.readFileSync(UPLOADS_FILE, 'utf8');
  const globalData = JSON.parse(globalFileContent);
  globalData.uploads.push(uploadRecord);
  globalData.lastUpdated = getKoreaTimeISO();
  fs.writeFileSync(UPLOADS_FILE, JSON.stringify(globalData, null, 2));

  // 2. 개별 동영상 ���더에 메타데이터 저장
  if (videoFolder) {
    const videoFolderPath = path.join(DATA_DIR, videoFolder);
    const localUploadsFile = path.join(videoFolderPath, `${videoFolder}-uploads.json`);

    const localUploadData = {
      videoFolder: videoFolder,
      uploadRecord: uploadRecord,
      savedAt: getKoreaTimeISO()
    };

    fs.writeFileSync(localUploadsFile, JSON.stringify(localUploadData, null, 2));
    console.log(`💾 Local upload data saved: ${localUploadsFile}`);
  }

  console.log(`📋 Global upload data updated: ${UPLOADS_FILE}`);
  return uploadRecord;
}

/**
 * 데이터 디렉토리 및 인덱스 파일 초기화
 * 
 * 📝 수정 포인트:
 * - 초기 데이터 구조 변경: initialData 객체 수정
 * - 다른 인덱스 파일 추가: 여기에 추가 생성 로직 구현
 */
function initializeDataFiles() {
  // data 디렉토리 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory:', DATA_DIR);
  }

  // uploads-all.json 인덱스 파일 생성
  if (!fs.existsSync(UPLOADS_FILE)) {
    const initialData = {
      uploads: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(UPLOADS_FILE, JSON.stringify(initialData, null, 2));
    console.log('���� Created uploads index file:', UPLOADS_FILE);
  }
}

// ========================================
// 🌐 API 핸들러 함수들
// ========================================

/**
 * 동영상 파일 업로드 처리 핸들러
 * 
 * 📝 수정 포인트:
 * - 응답 데이터 구조 변경: response 객체 수정
 * - 추가 처리 로직: 파일 압축, 썸네일 생성 등 여기에 추가
 * - 에러 처리 개선: try-catch 블록 내부 수정
 * 
 * @route POST /api/upload-file
 * @param {Request} req - Express 요청 객체 (multer로 처리된 파일 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleVideoFileUpload: RequestHandler = (req, res) => {
  try {
    // 업로드된 파일 검증
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '동영상 파일이 업로드되지 않았습니다.'
      });
    }

    // 클라이언트에서 전송된 메타데이�� 추출
    const duration = parseFloat(req.body.duration) || 0;
    const width = req.body.width ? parseInt(req.body.width) : undefined;
    const height = req.body.height ? parseInt(req.body.height) : undefined;

    // 파일명 인코딩 문제 최종 해결
    let correctedFileName = req.file.originalname;
    if (correctedFileName.includes('ì') || correctedFileName.includes('ë') || correctedFileName.includes('°')) {
      try {
        const buffer = Buffer.from(correctedFileName, 'latin1');
        correctedFileName = buffer.toString('utf8');
        console.log('✅ Final corrected fileName:', correctedFileName);
      } catch (error) {
        console.log('⚠️ Failed to correct fileName in upload handler');
      }
    }

    // 업로드 데이터 구성
    const uploadData: UploadData = {
      id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: correctedFileName,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      duration: duration,
      timestamp: Date.now(),
      metadata: {
        width: width,
        height: height,
        fps: undefined // 향후 확장용
      }
    };

    console.log(`🎬 Video file uploaded: ${req.file.path}`);

    // 데이터베이스에 저장 (JSON 파일)
    const savedData = saveUploadData(uploadData, req.file.path, (req as any).videoFolder);

    // 성공 응답
    const response = {
      success: true,
      message: '동영상 파일이 성공적으로 서버에 저장되었습니다.',
      videoId: uploadData.id,
      uploadedAt: savedData.uploadedAt,
      filePath: req.file.path,
      videoFolder: (req as any).videoFolder,
      processedData: {
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        duration: uploadData.duration,
        status: 'uploaded'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Video file upload error:', error);
    res.status(500).json({
      success: false,
      message: '동영상 파일 업로드 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 동영상 폴더 삭제 처리 핸들러
 * 
 * 📝 수정 포인트:
 * - 삭제 확인 로직 추가: 여기에 추가 검증 구현
 * - 백업 생성: 삭제 전 백업 로직 여기에 추가
 * - 관련 데이터 정리: 다른 연관 파일들 삭제 로직 추가
 * 
 * @route DELETE /api/video
 * @param {Request} req - Express 요청 객체 (videoId, videoFileName 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleVideoDelete: RequestHandler = (req, res) => {
  try {
    const { videoId, videoFileName } = req.body;
    
    // 필수 파라미터 검증
    if (!videoFileName) {
      return res.status(400).json({
        success: false,
        message: '비디오 파일명이 제공되지 않았습니다.'
      });
    }

    // 파일명 정규화하여 폴더명 찾기
    const normalizedName = normalizeFileName(videoFileName);
    
    // 가능한 모든 폴더명 검사 (원본, (1), (2), (3) 등)
    const possibleFolders = [normalizedName];
    for (let i = 1; i <= 10; i++) {
      possibleFolders.push(`${normalizedName}(${i})`);
    }
    
    let deletedFolder = null;
    let deletedPath = null;

    // 🔍 존재하는 폴더 찾기 및 삭제
    for (const folderName of possibleFolders) {
      const folderPath = path.join(DATA_DIR, folderName);
      if (fs.existsSync(folderPath)) {
        // 폴더 전체 삭제 (재귀적으로)
        fs.rmSync(folderPath, { recursive: true, force: true });
        deletedFolder = folderName;
        deletedPath = folderPath;
        console.log(`🗑️ Deleted video folder: ${folderPath}`);
        break;
      }
    }
    
    // 폴더를 찾지 못한 경우
    if (!deletedFolder) {
      return res.status(404).json({
        success: false,
        message: '삭제할 비디오 폴더를 찾을 수 없습니다.'
      });
    }

    // 📋 전역 인덱스에서도 해당 항목 제거
    if (fs.existsSync(UPLOADS_FILE)) {
      try {
        const globalFileContent = fs.readFileSync(UPLOADS_FILE, 'utf8');
        const globalData = JSON.parse(globalFileContent);
        
        // videoId 또는 fileName으로 항목 찾아서 제거
        globalData.uploads = globalData.uploads.filter((upload: any) => 
          upload.id !== videoId && !upload.fileName.includes(normalizedName)
        );
        
        globalData.lastUpdated = getKoreaTimeISO();
        fs.writeFileSync(UPLOADS_FILE, JSON.stringify(globalData, null, 2));
        console.log(`📋 Updated global index: removed ${normalizedName}`);
      } catch (error) {
        console.warn('⚠️ uploads-all.json 업데이트 중 오류:', error);
      }
    }

    // 성공 응답
    res.json({
      success: true,
      message: '비디오 폴더가 성공적으로 삭제되었습니다.',
      deletedFolder: deletedFolder,
      deletedPath: deletedPath
    });

  } catch (error) {
    console.error('❌ Video delete error:', error);
    res.status(500).json({
      success: false,
      message: '비디오 삭제 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * ===================================
 * 📝 API 사용법 및 수정 가이드
 * ===================================
 * 
 * 🔧 주요 수정 포인트:
 * 
 * 1. 파일 저장 경로 변경:
 *    - DATA_DIR 상수 수정
 *    - storage.destination 함수 수정
 * 
 * 2. 파일명 처리 규칙 변경:
 *    - normalizeFileName 함수 수정
 *    - 중복 처리 로직 수정
 * 
 * 3. 업로드 제한 변경:
 *    - multer limits 옵션 수정
 *    - fileFilter 함수 수정
 * 
 * 4. 응답 데이터 구조 변경:
 *    - handleVideoFileUpload의 response 객체 수정
 *    - 클라이언트에서 받는 데이터 구조도 함께 수정 필요
 * 
 * 5. 삭제 로직 변경:
 *    - handleVideoDelete 함수 수정
 *    - 백업이나 추가 검증 로직 구현
 */
