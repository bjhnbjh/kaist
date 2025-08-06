import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

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
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads.json');

// 디렉토리 및 파일 초기화 함수
function initializeDataFiles() {
  // data 디렉토리가 없으면 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory:', DATA_DIR);
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
function saveUploadData(uploadData: UploadData) {
  initializeDataFiles();

  // 기존 데이터 읽기
  const fileContent = fs.readFileSync(UPLOADS_FILE, 'utf8');
  const data = JSON.parse(fileContent);

  // 새 업로드 데이터 추가
  const uploadRecord = {
    ...uploadData,
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
