import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

interface WebVTTData {
  videoId: string;
  videoFileName: string;
  objects: Array<{
    id: string;
    name: string;
    code?: string;
    additionalInfo?: string;
    dlReservoirDomain?: string;
    category?: string;
    confidence?: number;
  }>;
  duration: number;
  timestamp: number;
}

// 데이터 저장 디렉토리 설정
const DATA_DIR = path.join(process.cwd(), 'data');
const WEBVTT_DIR = path.join(DATA_DIR, 'webvtt');
const WEBVTT_INDEX_FILE = path.join(DATA_DIR, 'webvtt-index.json');

// 디렉토리 및 파일 초기화 함수
function initializeWebVTTFiles() {
  // data 디렉토리가 없으면 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // webvtt 디렉토리가 없으면 생성
  if (!fs.existsSync(WEBVTT_DIR)) {
    fs.mkdirSync(WEBVTT_DIR, { recursive: true });
    console.log('Created webvtt directory:', WEBVTT_DIR);
  }

  // webvtt-index.json 파일이 없으면 생성
  if (!fs.existsSync(WEBVTT_INDEX_FILE)) {
    const initialIndex = {
      files: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(WEBVTT_INDEX_FILE, JSON.stringify(initialIndex, null, 2));
    console.log('Created webvtt-index.json file:', WEBVTT_INDEX_FILE);
  }
}

// WebVTT 파일을 로컬에 저장
function saveWebVTTFile(webvttData: WebVTTData) {
  initializeWebVTTFiles();

  // WebVTT 콘텐츠 생성
  const vttContent = generateWebVTTContent(webvttData);

  // 파일명 생성 (비디오ID + 타임스탬프)
  const fileName = `${webvttData.videoId}_${Date.now()}.vtt`;
  const filePath = path.join(WEBVTT_DIR, fileName);

  // WebVTT 파일 저장
  fs.writeFileSync(filePath, vttContent, 'utf8');

  // 인덱스 파일 업데이트
  const indexContent = fs.readFileSync(WEBVTT_INDEX_FILE, 'utf8');
  const indexData = JSON.parse(indexContent);

  const fileRecord = {
    videoId: webvttData.videoId,
    videoFileName: webvttData.videoFileName,
    vttFileName: fileName,
    filePath: filePath,
    objectCount: webvttData.objects.length,
    duration: webvttData.duration,
    createdAt: new Date().toISOString(),
    objects: webvttData.objects
  };

  // 같은 비디오ID의 기존 파일이 있으면 덮어쓰기
  const existingIndex = indexData.files.findIndex((file: any) => file.videoId === webvttData.videoId);
  if (existingIndex !== -1) {
    // 기존 파일 삭제
    try {
      if (fs.existsSync(indexData.files[existingIndex].filePath)) {
        fs.unlinkSync(indexData.files[existingIndex].filePath);
      }
    } catch (error) {
      console.log('기존 파일 삭제 실패:', error);
    }
    indexData.files[existingIndex] = fileRecord;
  } else {
    indexData.files.push(fileRecord);
  }

  indexData.lastUpdated = new Date().toISOString();

  fs.writeFileSync(WEBVTT_INDEX_FILE, JSON.stringify(indexData, null, 2));

  console.log('WebVTT file saved:', filePath);
  return { filePath, fileName, fileRecord };
}

export const handleWebVTTSave: RequestHandler = (req, res) => {
  try {
    const webvttData: WebVTTData = req.body;

    console.log('WebVTT save request received:', {
      videoId: webvttData.videoId,
      videoFileName: webvttData.videoFileName,
      objectCount: webvttData.objects.length,
      duration: webvttData.duration
    });

    // 로컬 파일에 저장
    const saveResult = saveWebVTTFile(webvttData);

    const response = {
      success: true,
      message: 'WebVTT 파일이 성공적으로 로컬에 저장되었습니다.',
      videoId: webvttData.videoId,
      fileName: saveResult.fileName,
      filePath: saveResult.filePath,
      savedAt: new Date().toISOString(),
      objectCount: webvttData.objects.length
    };

    res.json(response);
  } catch (error) {
    console.error('WebVTT save error:', error);
    res.status(500).json({
      success: false,
      message: 'WebVTT 파일 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function generateWebVTTContent(data: WebVTTData): string {
  const vttLines = ['WEBVTT', ''];
  
  // 객체 정보를 시간대별로 정리
  if (data.objects.length > 0) {
    // 전체 비디오 구간에 대한 객체 정보
    vttLines.push('00:00:00.000 --> ' + formatDuration(data.duration));
    vttLines.push(`탐지된 객체들: ${data.objects.map(obj => obj.name).join(', ')}`);
    vttLines.push('');
    
    // 각 객체별 상세 정보
    data.objects.forEach((obj, index) => {
      const startTime = formatDuration((data.duration / data.objects.length) * index);
      const endTime = formatDuration((data.duration / data.objects.length) * (index + 1));
      
      vttLines.push(`${startTime} --> ${endTime}`);
      vttLines.push(`${obj.name}`);
      if (obj.code) vttLines.push(`코드: ${obj.code}`);
      if (obj.category) vttLines.push(`카테고리: ${obj.category}`);
      if (obj.dlReservoirDomain) vttLines.push(`도메인: ${obj.dlReservoirDomain}`);
      if (obj.additionalInfo) vttLines.push(`정보: ${obj.additionalInfo}`);
      vttLines.push('');
    });
  } else {
    vttLines.push('00:00:00.000 --> ' + formatDuration(data.duration));
    vttLines.push('탐지된 객체가 없습니다.');
    vttLines.push('');
  }
  
  return vttLines.join('\n');
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
