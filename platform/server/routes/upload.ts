import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";

interface UploadData {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  duration: number;
  timestamp: number;
  metadata?: {
    width?: number;
    height?: number;
    fps?: number;
  };
}

// 데이터 저장 디렉토리 설정
const DATA_DIR = path.join(process.cwd(), 'data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads.json');

// multer 설정 - 비디오 파일 저장
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // videos 디렉토리가 없으면 생성
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    // 파일명을 timestamp와 원본 이름으로 설정
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const newFileName = `${timestamp}-${baseName}${extension}`;
    cb(null, newFileName);
  }
});

// 파일 필터 - 비디오 파일만 허용
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('비디오 파일만 업로드 가능합니다.'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB 제한
  }
}).single('video');

// 디렉토리 및 파일 초기화 함수
function initializeDataFiles() {
  // data 디렉토리가 없으면 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory:', DATA_DIR);
  }

  // videos 디렉토리가 없으면 생성
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    console.log('Created videos directory:', VIDEOS_DIR);
  }

  // uploads.json 파일이 없으면 생성
  if (!fs.existsSync(UPLOADS_FILE)) {
    const initialData = {
      uploads: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(UPLOADS_FILE, JSON.stringify(initialData, null, 2));
    console.log('Created uploads.json file:', UPLOADS_FILE);
  }
}

// 업로드 데이터를 파일에 저장
function saveUploadData(uploadData: UploadData, filePath?: string) {
  initializeDataFiles();

  // 기존 데이터 읽기
  const fileContent = fs.readFileSync(UPLOADS_FILE, 'utf8');
  const data = JSON.parse(fileContent);

  // 새 업로드 데이터 추가
  const uploadRecord = {
    ...uploadData,
    filePath: filePath || null,
    uploadedAt: new Date().toISOString(),
    status: 'uploaded'
  };

  data.uploads.push(uploadRecord);
  data.lastUpdated = new Date().toISOString();

  // 파일에 저장
  fs.writeFileSync(UPLOADS_FILE, JSON.stringify(data, null, 2));
  console.log('Upload data saved to:', UPLOADS_FILE);

  return uploadRecord;
}

// 비디오 파일 업로드 처리 (실제 파일 저장)
export const handleVideoFileUpload: RequestHandler = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '비디오 파일이 업로드되지 않았습니다.'
      });
    }

    const uploadData: UploadData = {
      id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      duration: 0, // 클라이언트에서 추출된 duration을 받을 예정
      timestamp: Date.now(),
      metadata: {
        // 추후 비디오 메타데이터 추가
      }
    };

    console.log('Video file uploaded:', req.file.path);

    // 로컬 파일에 저장
    const savedData = saveUploadData(uploadData, req.file.path);

    const response = {
      success: true,
      message: '비디오 파일이 성공적으로 서버에 저장되었습니다.',
      videoId: uploadData.id,
      uploadedAt: savedData.uploadedAt,
      filePath: req.file.path,
      processedData: {
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        duration: uploadData.duration,
        status: 'uploaded'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Video file upload error:', error);
    res.status(500).json({
      success: false,
      message: '비디오 파일 업로드 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 기존의 메타데이터만 받는 엔드포인트 (호환성 유지)
export const handleVideoUpload: RequestHandler = (req, res) => {
  try {
    const uploadData: UploadData = req.body;

    console.log('Video upload received:', uploadData);

    // 로컬 파일에 저장
    const savedData = saveUploadData(uploadData);

    const response = {
      success: true,
      message: '비디오가 성공적으로 업로드되어 로컬에 저장되었습니다.',
      videoId: uploadData.id,
      uploadedAt: savedData.uploadedAt,
      savedToFile: UPLOADS_FILE,
      processedData: {
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        duration: uploadData.duration,
        status: 'uploaded'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({
      success: false,
      message: '비디오 업로드 처리 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
