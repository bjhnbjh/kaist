import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

/**
 * ===================================
 * 📄 WebVTT 자막 파일 생성 API
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 탐지된 객체 정보를 WebVTT 형식으로 변환
 * 2. 시간 중복 방지 (같은 시간의 객체들을 0.1초씩 조정)
 * 3. 기존 VTT 파일과 새로운 객체 정보 병합
 * 4. 한글 파일명 지원 및 안전한 파일 저장
 * 
 * 📝 API 수정 가이드:
 * - VTT 형식 변경: generateCompleteVttContent 함��� 수정
 * - 시간 형식 변경: formatDuration 함수 수정
 * - 병합 로직 변경: combineObjectsWithTimeDeduplication 함수 수정
 * - 파일 저장 경로 변경: DATA_DIR 상수 및 경로 로직 수정
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
 * 파일명을 안전하게 정규화하는 함수 (한글 지원)
 * 업로드 API와 동일한 로직 사용
 * 
 * @param {string} fileName - 원본 파일명
 * @returns {string} 정규화된 파일명
 */
function normalizeFileName(fileName: string): string {
  // 확장자 분리
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  // 파일명을 UTF-8로 정규화하고 불필요한 공백 제거
  let normalized = baseName.normalize('NFC').trim();

  // 특수문자를 안전한 문자로 대체
  normalized = normalized
    .replace(/[<>:"/\\|?*]/g, '_')  // 파일시스템에서 금지된 문자들
    .replace(/\s+/g, '_')           // 공백을 언더스코어로
    .replace(/[^\w가-힣\-_.()]/g, '') // 한글, 영숫자, 일부 특수문자만 허용
    .replace(/_{2,}/g, '_')         // 연속된 언더스코어 정리
    .replace(/^_+|_+$/g, '');       // 앞뒤 언더스코어 제거

  return normalized || 'unnamed';
}

/**
 * 초 단위 시간을 WebVTT 형식으로 변환
 * 
 * 📝 수정 포인트:
 * - 시간 형식 변경: ��환 형식 수정 (��재: MM:SS:HH)
 * - 밀리초 정밀도 변경: ms 계산 로직 수정
 * 
 * @param {number} seconds - 초 단위 시간
 * @returns {string} MM:SS:HH 형식의 시간 문자열
 */
function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100); // 밀리초를 100분의 1초 단위로

  return `${totalMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

// ========================================
// 📊 타입 정의
// ========================================

/**
 * WebVTT 생성에 필요한 데이터 인터페이스
 * 
 * 📝 수정 포인트:
 * - 새로운 객체 속성 추가: objects 배열의 객체 타입에 필드 추가
 * - 메타데이터 추가: 이 인터페이스에 새로운 필드 추가
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
    videoCurrentTime?: number;  // 객체가 생성된 동영상 시점
    finallink?: string;  // 최�� 링크
    coordinates?: {  // 그리기 좌표 정보 (VTT에만 저장, 화면에는 표시 안함)
      type: "path" | "rectangle" | "click";
      points?: Array<{ x: number; y: number }>;
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      clickPoint?: { x: number; y: number };
    };
    position?: any;  // 좌표들
    polygon?: any;   // 추후 API를 통해 가져올 폴리곤 데이터
  }>;
  duration: number;
  timestamp: number;
}

// ========================================
// 🗂️ 파일 시스템 설정
// ========================================

// 데이터 저장 디렉토리 설정 (upload API와 동일)
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * WebVTT 저장 디렉토리 초기화
 * 
 * 📝 수정 포인트:
 * - 저장 경로 변경: DATA_DIR 수정
 * - 권한 설정: mkdir 옵션에 mode 추가
 */
function initializeWebVTTFiles() {
  // data 디렉토리가 없으면 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ========================================
// 🎯 핵심 로직 함수들
// ========================================

/**
 * VTT에서 기존 객체 정보 추출 (단순화된 파싱)
 * 
 * 📝 수정 포인트:
 * - ��싱 규칙 변���: 이모지 패턴이나 라벨 형식 변경 시 여기 수정
 * - 새로운 속성 파싱: 새로운 객체 속성 추가 시 파싱 로직 추가
 * 
 * @param {string} content - 기존 VTT 파일 내용
 * @returns {Array} 파싱된 객체 정보 배열
 */
function extractObjectsFromVtt(content: string): any[] {
  const objects: any[] = [];
  const lines = content.split('\n');

  // 📍 좌표 데이터 추출 (NOTE 섹션에서)
  const coordinatesMap = new Map();
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
        const coordData = JSON.parse(line);
        coordinatesMap.set(coordData.objectId, coordData.coordinates);
      } catch (e) {
        console.warn('Failed to parse coordinates data:', line);
      }
      continue;
    }

    // 🎯 이모지로 시작하는 객체 이름 라인 찾기
    if (line.startsWith('🎯')) {
      const obj: any = {
        name: line.replace('🎯 ', ''),
        id: `existing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // 이전 라인에서 시간 정보 찾기
      if (i > 0 && lines[i-1].includes('-->')) {
        const timeMatch = lines[i-1].match(/^([\d:]+)\s*-->/);
        if (timeMatch) {
          const startTime = timeMatch[1];
          const timeParts = startTime.split(':');
          obj.videoCurrentTime = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]) + parseInt(timeParts[2]) / 100;
        }
      }

      // 다음 라인들에서 추가 정보 수집
      for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) {
        const infoLine = lines[j].trim();
        if (infoLine.startsWith('🔧 코드:')) {
          obj.code = infoLine.replace('🔧 코드: ', '');
        } else if (infoLine.startsWith('📂 카테고리:')) {
          obj.category = infoLine.replace('📂 카테고리: ', '');
        } else if (infoLine.startsWith('🌐 도메인:')) {
          obj.dlReservoirDomain = infoLine.replace('🌐 도메인: ', '');
        } else if (infoLine.startsWith('💡 정보:')) {
          obj.additionalInfo = infoLine.replace('💡 정보: ', '');
        }
      }

      // 📍 저장된 좌표 정보가 있으면 추가
      if (coordinatesMap.has(obj.id)) {
        obj.coordinates = coordinatesMap.get(obj.id);
      }

      objects.push(obj);
    }
  }

  return objects;
}

/**
 * 객체들을 시간 중복 방지하며 결합
 * 
 * 📝 수정 포인트:
 * - 시간 조정 간격 변경: 0.1초를 다른 값으로 수정
 * - 병합 규칙 변경: 같은 이름 객체 처리 로직 수정
 * - 정렬 기준 변경: sort 함수의 비교 로직 수정
 * 
 * @param {Array} existingObjects - 기존 객체들
 * @param {Array} newObjects - 새로운 객체들
 * @returns {Array} 병합되고 시간 조정된 객체 배열
 */
function combineObjectsWithTimeDeduplication(existingObjects: any[], newObjects: any[]): any[] {
  const combined = [...existingObjects];
  
  newObjects.forEach(newObj => {
    // 같은 이름의 기존 객체가 있는지 확인
    const existingIndex = combined.findIndex(existing => existing.name === newObj.name);
    
    if (existingIndex !== -1) {
      // 🔄 기존 객체 업데이트 (정보만 갱신, 시간은 유지하지 않음)
      combined[existingIndex] = { ...combined[existingIndex], ...newObj };
    } else {
      // ✨ 새로운 객체 추가 - 시간 중복 방지
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
      
      combined.push(newObj);
    }
  });
  
  // ⏱️ 시간순으로 정렬
  return combined.sort((a, b) => (a.videoCurrentTime || 0) - (b.videoCurrentTime || 0));
}

/**
 * 완전한 WebVTT 파일 내용 생성
 * 
 * 📝 수정 포인트:
 * - VTT 헤더 형식 변경: NOTE 섹션 내용 수정
 * - 객체 정보 표시 형식 변경: objectInfo 배열 구성 수정
 * - 이모지 사용 변경: 각 정보별 이모지 수정
 * 
 * @param {WebVTTData} data - VTT 생성용 데이터
 * @param {Array} objects - 표시할 객체 배열
 * @returns {string} 완성된 WebVTT 파일 내용
 */
function generateCompleteVttContent(data: WebVTTData, objects: any[]): string {
  const vttLines = ['WEBVTT'];
  vttLines.push('NOTE');
  vttLines.push(`동영상: ${data.videoFileName}`);
  vttLines.push(`생성일: ${getKoreaTimeISO()}`);
  vttLines.push(`탐지된 객체 수: ${objects.length}`);

  // 📍 객체 정보를 NOTE 섹션에 한국어 형태로 표시 (각 객체별로 ��호와 함께)
  if (objects.length > 0) {
    objects.forEach((obj, index) => {
      const objectNumber = index + 1;
      vttLines.push(`Object(${objectNumber})`);
      vttLines.push('{');
      vttLines.push(`"이름":"Object(${objectNumber})${objectNumber}",`);
      vttLines.push(`"시간":${obj.videoCurrentTime || 0},`);
      vttLines.push(`"code":"${obj.code || `CODE_RECT-${Math.floor(Math.random() * 1000)}`}",`);
      vttLines.push(`"catefory":"${obj.category || "기타"}",`);
      vttLines.push(`"도메인":"${obj.dlReservoirDomain || "http://www.naver.com"}",`);
      vttLines.push(`"정보":"${obj.additionalInfo || "AI가 자동으로 탐지한 객체입니다."}",`);
      vttLines.push(`"finallink":"${obj.dlReservoirDomain || "http://www.naver.com"}/00/${obj.code || `CODE_RECT-${Math.floor(Math.random() * 1000)}`}",`);

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

  vttLines.push('');

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
 * 
 * 📝 수정 포인트:
 * - 헤더 업데이트 로직 변경: 헤더 정보 수정/추가
 * - 병합 전략 변경: 기존 vs 새로운 객체 처리 방식 수정
 * 
 * @param {string} existingContent - 기존 VTT 파일 내용
 * @param {WebVTTData} newData - 새로운 객체 데이터
 * @returns {string} 업데이트된 VTT 파일 내용
 */
function createUpdatedVttContent(existingContent: string, newData: WebVTTData): string {
  // 📄 기존 객체들 추출
  const existingObjects = extractObjectsFromVtt(existingContent);
  
  // 🔄 새로운 객체들과 병합 (시간 중복 방지)
  const allObjects = combineObjectsWithTimeDeduplication(existingObjects, newData.objects);
  
  // ✨ 새로운 VTT 파일 생��
  return generateCompleteVttContent(newData, allObjects);
}

/**
 * WebVTT 파일을 로컬에 저장
 * 
 * 📝 수정 포인트:
 * - 파일 저장 위치 변경: 폴더 구조 변경
 * - 파일명 규칙 변경: VTT 파일명 형식 수정
 * - 백업 로직 추가: 기존 파일 백업 후 저장
 * 
 * @param {WebVTTData} webvttData - 저장할 WebVTT 데이터
 * @returns {object} 저장 결과 정보
 */
function saveWebVTTFile(webvttData: WebVTTData) {
  initializeWebVTTFiles();

  // 📄 WebVTT 콘텐츠 생성
  const vttContent = generateCompleteVttContent(webvttData, webvttData.objects);

  // 📁 동영상 파일명을 정규화하여 폴더 찾기
  const normalizedName = normalizeFileName(webvttData.videoFileName);
  const videoFolderPath = path.join(DATA_DIR, normalizedName);

  // 동영상 폴더가 없으면 생성
  if (!fs.existsSync(videoFolderPath)) {
    fs.mkdirSync(videoFolderPath, { recursive: true });
  }

  // 💾 VTT 파일 업데이트 (기존 파일과 비교하여 변경된 부분만 반영)
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

  // 📝 파일 저장 (UTF-8 인코딩으로)
  fs.writeFileSync(singleVttFilePath, finalVttContent, { encoding: 'utf8' });

  // 📊 파일 레코드 정보 생성
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
 * 📝 수정 포인트:
 * - 요청 검증 로직 추가: 필수 필드 검증 강화
 * - 응답 형식 변경: response 객체 구조 수정
 * - 에러 처리 개선: 더 상세한 에러 메시지 제공
 * 
 * @route POST /api/webvtt
 * @param {Request} req - Express 요청 객체 (WebVTTData 포함)
 * @param {Response} res - Express 응답 객체
 */
export const handleWebVTTSave: RequestHandler = (req, res) => {
  try {
    const webvttData: WebVTTData = req.body;

    // 📋 요청 데이터 로깅
    console.log('📄 WebVTT save request received:', {
      videoId: webvttData.videoId,
      videoFileName: webvttData.videoFileName,
      objectCount: webvttData.objects.length,
      duration: webvttData.duration
    });

    // ✅ 필수 필드 검증
    if (!webvttData.videoId || !webvttData.videoFileName) {
      return res.status(400).json({
        success: false,
        message: 'videoId와 videoFileName은 필수 항목입니다.'
      });
    }

    // 💾 로컬 파일에 저장
    const saveResult = saveWebVTTFile(webvttData);

    // 🎉 성공 응답
    const response = {
      success: true,
      message: 'WebVTT 파일이 성공적으로 로컬에 저장되었���니다.',
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
 * 🔧 주요 수정 포인트:
 * 
 * 1. VTT 형식 변경:
 *    - generateCompleteVttContent 함수의 vttLines 배열 수정
 *    - 이모지나 라벨 형식 변경
 * 
 * 2. 시간 형식 변경:
 *    - formatDuration 함수 수정
 *    - 현재: MM:SS:HH (분:초:100분의1초)
 * 
 * 3. 객체 병합 로직 변경:
 *    - combineObjectsWithTimeDeduplication 함수 수정
 *    - 시간 조정 간격이나 병합 규칙 변경
 * 
 * 4. 파일 저장 위치 변경:
 *    - DATA_DIR 상수 수정
 *    - 폴더 구조나 파일명 규칙 변경
 * 
 * 5. API 응답 구조 변경:
 *    - handleWebVTTSave의 response 객체 수정
 *    - 클라이언트에서 받는 데이터 구조도 함께 수정 필요
 * 
 * 📡 클라이언트 연동:
 * - client/components/VideoPlayer.tsx의 sendWebVTTToApi 함수에서 호출
 * - 응답 데이터 구조 변경 시 해당 함수도 함께 수정 필요
 */
