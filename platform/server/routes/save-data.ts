import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

interface SaveDataRequest {
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
    selected?: boolean;
  }>;
  drawings: Array<{
    id: string;
    type: "path" | "rectangle";
    color: string;
    points: Array<{ x: number; y: number }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
  }>;
  duration: number;
  totalFrames: number;
  timestamp: number;
}

// 데이터 저장 디렉토리 설정
const DATA_DIR = path.join(process.cwd(), 'data');
const SAVED_DATA_FILE = path.join(DATA_DIR, 'saved-data.json');

// 디렉토리 및 파일 초기화 함수
function initializeSaveDataFiles() {
  // data 디렉토리가 없으면 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory:', DATA_DIR);
  }
  
  // saved-data.json 파일이 없으면 생성
  if (!fs.existsSync(SAVED_DATA_FILE)) {
    const initialData = {
      savedProjects: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(SAVED_DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('Created saved-data.json file:', SAVED_DATA_FILE);
  }
}

// 편집 데이터를 DB(JSON 파일)에 저장
function saveEditedData(saveData: SaveDataRequest) {
  initializeSaveDataFiles();
  
  // 기존 데이터 읽기
  const fileContent = fs.readFileSync(SAVED_DATA_FILE, 'utf8');
  const data = JSON.parse(fileContent);
  
  // 새 저장 데이터 생성
  const projectRecord = {
    ...saveData,
    savedAt: new Date().toISOString(),
    version: 1
  };
  
  // 같은 비디오ID의 기존 프로젝트가 있으면 업데이트, 없으면 추가
  const existingIndex = data.savedProjects.findIndex((project: any) => project.videoId === saveData.videoId);
  
  if (existingIndex !== -1) {
    // 기존 프로젝트 업데이트 (버전 증가)
    const existingProject = data.savedProjects[existingIndex];
    projectRecord.version = (existingProject.version || 1) + 1;
    data.savedProjects[existingIndex] = projectRecord;
    console.log(`Updated existing project for video ${saveData.videoId}, version: ${projectRecord.version}`);
  } else {
    // 새 프로젝트 추가
    data.savedProjects.push(projectRecord);
    console.log(`Added new project for video ${saveData.videoId}`);
  }
  
  data.lastUpdated = new Date().toISOString();
  
  // 파일에 저장
  fs.writeFileSync(SAVED_DATA_FILE, JSON.stringify(data, null, 2));
  console.log('Project data saved to:', SAVED_DATA_FILE);
  
  return projectRecord;
}

export const handleSaveData: RequestHandler = (req, res) => {
  try {
    const saveData: SaveDataRequest = req.body;
    
    console.log('Save data request received:', {
      videoId: saveData.videoId,
      videoFileName: saveData.videoFileName,
      objectCount: saveData.objects.length,
      drawingCount: saveData.drawings.length,
      duration: saveData.duration
    });
    
    // 로컬 DB(JSON 파일)에 저장
    const savedProject = saveEditedData(saveData);
    
    const response = {
      success: true,
      message: '편집 데이터가 성공적으로 DB에 저장되었습니다.',
      videoId: saveData.videoId,
      projectVersion: savedProject.version,
      savedAt: savedProject.savedAt,
      savedToFile: SAVED_DATA_FILE,
      statistics: {
        objectCount: saveData.objects.length,
        drawingCount: saveData.drawings.length,
        duration: saveData.duration,
        totalFrames: saveData.totalFrames
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Save data error:', error);
    res.status(500).json({
      success: false,
      message: '편집 데이터 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
