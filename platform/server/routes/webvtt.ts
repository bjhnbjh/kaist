import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { getKoreaTimeISO, normalizeFileName, formatDuration, getDataDirectory, ensureDirectoryExists } from "../utils/common";

/**
 * ===================================
 * 📄 WebVTT 자막 파일 생성 API (한국어 형식)
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 탐지된 객체 정보를 WebVTT 형식으로 변환
 * 2. 한국어 줄별 형식으로 객체 정보 저장
 * 3. 좌표 정보 포함 (position과 polygon)
 * 4. 간단하고 명확한 VTT 구조
 */

// ========================================
// 🛠️ 유틸리티 함수들
// ========================================

// 유틸리티 함수들은 ../utils/common.ts에서 import하여 사용

// ========================================
// 📊 타입 정의
// ========================================

/**
 * WebVTT 생성에 필요한 데이터 인터페이스
 */
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
    videoCurrentTime?: number;
    finallink?: string;
    coordinates?: {
      type: "path" | "rectangle" | "click";
      points?: Array<{ x: number; y: number }>;
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      clickPoint?: { x: number; y: number };
    };
    position?: any;
    polygon?: any;
  }>;
  duration: number;
  timestamp: number;
}

// ========================================
// 🗂️ 파일 시스템 설정
// ========================================

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * WebVTT 저장 디렉토리 초기화
 */
function initializeWebVTTFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ========================================
// 🎯 핵심 로직 함수들
// ========================================

/**
 * VTT에서 기존 객체 정보 추출 (새로운 한국어 형식)
 */
function extractObjectsFromVtt(content: string): any[] {
  const objects: any[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Object(숫자) 형태의 객체 시작 찾기
    if (line.startsWith('Object(') && line.includes(')')) {
      const obj: any = {
        id: `existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      // 다음 줄들에서 JSON 데이터 파싱
      let j = i + 1;
      if (j < lines.length && lines[j].trim() === '{') {
        j++; // '{' 다음 줄부터 시작
        
        while (j < lines.length && lines[j].trim() !== '}') {
          const dataLine = lines[j].trim();
          
          if (dataLine.includes('"이름"')) {
            const match = dataLine.match(/"이름":"([^"]+)"/);
            if (match) obj.name = match[1];
          } else if (dataLine.includes('"시간"')) {
            const match = dataLine.match(/"시간":([0-9.]+)/);
            if (match) obj.videoCurrentTime = parseFloat(match[1]);
          } else if (dataLine.includes('"code"')) {
            const match = dataLine.match(/"code":"([^"]+)"/);
            if (match) obj.code = match[1];
          } else if (dataLine.includes('"catefory"')) {
            const match = dataLine.match(/"catefory":"([^"]+)"/);
            if (match) obj.category = match[1];
          } else if (dataLine.includes('"도메인"')) {
            const match = dataLine.match(/"도메인":"([^"]+)"/);
            if (match) obj.dlReservoirDomain = match[1];
          } else if (dataLine.includes('"정보"')) {
            const match = dataLine.match(/"정보":"([^"]+)"/);
            if (match) obj.additionalInfo = match[1];
          } else if (dataLine.includes('"position"')) {
            try {
              const positionMatch = dataLine.match(/"position":(.+),?$/);
              if (positionMatch && positionMatch[1] !== 'null') {
                obj.position = JSON.parse(positionMatch[1].replace(/,$/, ''));
              }
            } catch (e) {
              console.warn('Failed to parse position data:', dataLine);
            }
          } else if (dataLine.includes('"polygon"')) {
            try {
              const polygonMatch = dataLine.match(/"polygon":(.+)$/);
              if (polygonMatch && polygonMatch[1] !== 'null') {
                obj.polygon = JSON.parse(polygonMatch[1]);
              }
            } catch (e) {
              console.warn('Failed to parse polygon data:', dataLine);
            }
          }
          
          j++;
        }
        
        if (obj.name) {
          objects.push(obj);
        }
      }
    }
  }

  return objects;
}

/**
 * 객체들을 시간 중복 방지하며 결합 (좌표 정보 포함)
 */
function combineObjectsWithTimeDeduplication(existingObjects: any[], newObjects: any[]): any[] {
  const combined = [...existingObjects];
  
  newObjects.forEach(newObj => {
    // 같은 이름의 기존 객체가 있는지 확인
    const existingIndex = combined.findIndex(existing => existing.name === newObj.name);
    
    if (existingIndex !== -1) {
      // 기존 객체 업데이트 (좌표 정보 포함)
      const existingObj = combined[existingIndex];
      combined[existingIndex] = { 
        ...existingObj, 
        ...newObj,
        // 좌표 정보 병합 - 새로운 좌표가 있으면 사용, 없으면 기존 유지
        coordinates: newObj.coordinates || newObj.position || existingObj.coordinates || existingObj.position,
        position: newObj.coordinates || newObj.position || existingObj.coordinates || existingObj.position,
        polygon: newObj.polygon || existingObj.polygon
      };
    } else {
      // 새로운 객체 추가 - 시간 중복 방지
      const currentTime = newObj.videoCurrentTime || 0;
      
      // 같은 시간에 다른 객체가 있는지 확인 (0.1초 오차 허용)
      const timeConflict = combined.find(obj => Math.abs((obj.videoCurrentTime || 0) - currentTime) < 0.1);
      
      if (timeConflict) {
        // 시간이 겹치면 0.1초씩 조정하여 중복 방지
        let adjustedTime = currentTime;
        while (combined.find(obj => Math.abs((obj.videoCurrentTime || 0) - adjustedTime) < 0.1)) {
          adjustedTime += 0.1;
        }
        newObj.videoCurrentTime = adjustedTime;
        console.log(`⏰ Time adjusted: ${currentTime}s -> ${adjustedTime}s for object "${newObj.name}"`);
      }
      
      // 좌표 정보 통합
      newObj.position = newObj.coordinates || newObj.position;
      
      combined.push(newObj);
    }
  });
  
  // 시간순으로 정렬
  return combined.sort((a, b) => (a.videoCurrentTime || 0) - (b.videoCurrentTime || 0));
}

/**
 * 완전한 WebVTT 파일 내용 생성 (새로운 한국어 형식)
 */
function generateCompleteVttContent(data: WebVTTData, objects: any[]): string {
  const vttLines = ['WEBVTT'];
  vttLines.push('NOTE');
  vttLines.push(`동영상: ${data.videoFileName}`);
  vttLines.push(`생성일: ${getKoreaTimeISO()}`);
  vttLines.push(`탐지된 객체 수: ${objects.length}`);
  vttLines.push('');

  // 객체 정보를 NOTE 섹션에 한국어 형태로 표시 (각 객체별로 번호와 함께)
  if (objects.length > 0) {
    objects.forEach((obj, index) => {
      const objectNumber = index + 1;
      vttLines.push(`Object(${objectNumber})`);
      vttLines.push('{');
      vttLines.push(`"이름":"Object(${objectNumber})${objectNumber}",`);
      vttLines.push(`"시간":${obj.videoCurrentTime || 0},`);
      vttLines.push(`"code":"${obj.code || ('CODE_RECT-' + Math.floor(Math.random() * 1000))}",`);
      vttLines.push(`"catefory":"${obj.category || "기타"}",`);
      vttLines.push(`"도메인":"${obj.dlReservoirDomain || "http://www.naver.com"}",`);
      vttLines.push(`"정보":"${obj.additionalInfo || "AI가 자동으로 탐지한 객체입니다."}",`);
      vttLines.push(`"finallink":"${(obj.dlReservoirDomain || "http://www.naver.com")}/00/${obj.code || ('CODE_RECT-' + Math.floor(Math.random() * 1000))}",`);
      
      // 좌표 정보 추가 - position과 polygon 모두 포함
      if (obj.coordinates || obj.position) {
        const coords = obj.coordinates || obj.position;
        vttLines.push(`"position":${JSON.stringify(coords)},`);
      } else {
        vttLines.push(`"position":null,`);
      }
      
      vttLines.push(`"polygon":${obj.polygon ? JSON.stringify(obj.polygon) : 'null'}`);
      vttLines.push('}');
      vttLines.push(''); // 객체 간 구분을 위한 빈 줄
    });
  }

  // VTT 타임라인 영역은 간소화하여 불필요한 자막 정보 제거
  if (objects.length > 0) {
    // 간단한 요약 정보만 표시
    vttLines.push('1');
    vttLines.push(`00:00:00.000 --> ${formatDuration(data.duration)}`);
    vttLines.push(`탐지된 객체: ${objects.length}개`);
    vttLines.push('');
  } else {
    vttLines.push('1');
    vttLines.push(`00:00:00.000 --> ${formatDuration(data.duration)}`);
    vttLines.push('탐지된 객체가 없습니다.');
    vttLines.push('');
  }

  return vttLines.join('\n');
}

/**
 * 기존 VTT와 새로운 데이터를 병합하여 업데이트된 VTT 생성
 */
function createUpdatedVttContent(existingContent: string, newData: WebVTTData): string {
  // 기존 객체들 추출
  const existingObjects = extractObjectsFromVtt(existingContent);
  
  // 새로운 객체들과 병합 (시간 중복 방지)
  const allObjects = combineObjectsWithTimeDeduplication(existingObjects, newData.objects);
  
  // 새로운 VTT 파일 생성
  return generateCompleteVttContent(newData, allObjects);
}

/**
 * WebVTT 파일을 로컬에 저장
 */
function saveWebVTTFile(webvttData: WebVTTData) {
  initializeWebVTTFiles();

  // WebVTT 콘텐츠 생성
  const vttContent = generateCompleteVttContent(webvttData, webvttData.objects);

  // 동영상 파일명을 정규화하여 폴더 찾기
  const normalizedName = normalizeFileName(webvttData.videoFileName);
  const videoFolderPath = path.join(DATA_DIR, normalizedName);

  // 동영상 폴더가 없으면 생성
  if (!fs.existsSync(videoFolderPath)) {
    fs.mkdirSync(videoFolderPath, { recursive: true });
  }

  // VTT 파일 업데이트 (기존 파일과 비교하여 변경된 부분만 반영)
  const singleVttFileName = `${normalizedName}-webvtt.vtt`;
  const singleVttFilePath = path.join(videoFolderPath, singleVttFileName);

  let finalVttContent = '';

  // 기존 VTT 파일이 있으면 기존 객체들과 병합
  if (fs.existsSync(singleVttFilePath)) {
    const existingContent = fs.readFileSync(singleVttFilePath, 'utf8');
    finalVttContent = createUpdatedVttContent(existingContent, webvttData);
    console.log(`🔄 Updated existing VTT file: ${singleVttFilePath}`);
  } else {
    // 첫 번째 저장인 경우 그대로 사용
    finalVttContent = vttContent;
    console.log(`✨ Created new VTT file: ${singleVttFilePath}`);
  }

  // 파일 저장 (UTF-8 인코딩으로)
  fs.writeFileSync(singleVttFilePath, finalVttContent, { encoding: 'utf8' });

  // 파일 레코드 정보 생성
  const fileRecord = {
    videoId: webvttData.videoId,
    videoFileName: webvttData.videoFileName,
    vttFileName: singleVttFileName,
    filePath: singleVttFilePath,
    videoFolder: normalizedName,
    objectCount: webvttData.objects.length,
    duration: webvttData.duration,
    createdAt: getKoreaTimeISO(),
    objects: webvttData.objects
  };

  console.log(`✅ WebVTT file saved successfully: ${singleVttFilePath}`);
  return { filePath: singleVttFilePath, fileName: singleVttFileName, fileRecord };
}

// ========================================
// 🌐 API 핸들러
// ========================================

/**
 * WebVTT 파일 저장 API 핸들러
 * 
 * @route POST /api/webvtt
 * @param {Request} req - Express 요청 객체 (WebVTTData 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleWebVTTSave: RequestHandler = (req, res) => {
  try {
    const webvttData: WebVTTData = req.body;

    // 요청 데이터 로깅
    console.log('📄 WebVTT save request received:', {
      videoId: webvttData.videoId,
      videoFileName: webvttData.videoFileName,
      objectCount: webvttData.objects.length,
      duration: webvttData.duration
    });

    // 필수 필드 검증
    if (!webvttData.videoId || !webvttData.videoFileName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 videoFileName은 필수 항목입니다.'
      });
    }

    // 로컬 파일에 저장
    const saveResult = saveWebVTTFile(webvttData);

    // 성공 응답
    const response = {
      success: true,
      message: 'WebVTT 파일이 성공적으로 로컬에 저장되었습니다.',
      videoId: webvttData.videoId,
      fileName: saveResult.fileName,
      filePath: saveResult.filePath,
      savedAt: new Date().toISOString(),
      objectCount: webvttData.objects.length,
      details: {
        videoFolder: saveResult.fileRecord.videoFolder,
        duration: webvttData.duration,
        hasExistingFile: fs.existsSync(saveResult.filePath)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('❌ WebVTT save error:', error);
    res.status(500).json({
      success: false,
      message: 'WebVTT 파일 저장 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * ===================================
 * 📝 WebVTT API 사용법 및 수정 가이드
 * ===================================
 * 
 * 주요 변경사항:
 * 1. VTT 형식을 한국어 줄별 형식으로 변경
 * 2. Object(1), Object(2) 형태로 객체 번호 표시
 * 3. 좌표 정보 (position, polygon) 포함
 * 4. 불필요한 자막 정보 제거하여 간소화
 * 5. 기존 파일과 새로운 데이터 병합 지원
 */
