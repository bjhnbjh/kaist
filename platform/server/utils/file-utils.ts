import fs from "fs";
import path from "path";

/**
 * ===================================
 * 📁 파일 시스템 유틸리티 함수들
 * ===================================
 * 
 * 이 파일의 기능:
 * 1. 파일명 정규화 (한글 지원)
 * 2. 실제 업로드된 비디오 폴더 찾기
 * 3. 한국시간 처리
 * 4. 기타 파일 시스템 유틸리티
 * 
 * 📝 수정 가이드:
 * - 파일명 규칙 변경: normalizeFileName 함수 수정
 * - 폴더 검색 범위 변경: findActualVideoFolder 함수의 루프 범위 수정
 * - 시간대 변경: getKoreaTimeISO 함수 수정
 */

// ========================================
// 📊 상수 정의
// ========================================

// 데이터 저장 디렉토리 경로
export const DATA_DIR = path.join(process.cwd(), 'data');

// ========================================
// 🕐 시간 관련 함수들
// ========================================

/**
 * 한국시간(KST) 기준으로 ISO 문자열 반환
 * @returns {string} KST 시간대의 ISO 문자열
 */
export function getKoreaTimeISO(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().replace('Z', '+09:00');
}

// ========================================
// 📝 파일명 처리 함수들
// ========================================

/**
 * 파일명을 안전하게 정규화하는 함수 (한글 지원)
 * 
 * 📝 수정 포인트:
 * - 허용할 특수문자 변경: 정규식 패턴 수정
 * - 파일명 길이 제한: 여기에 추가 로직 구현
 * - 금지 단어 필터링: 여기에 추가 로직 구현
 * 
 * @param {string} fileName - 원본 파일명
 * @returns {string} 정규화된 파일명
 */
export function normalizeFileName(fileName: string): string {
  try {
    // 확장자 분리
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    // 파일명을 UTF-8로 정규화하고 불필요한 공백 제거
    let normalized = baseName.normalize('NFC').trim();

    // 한국어 인코딩 문제 복구 시도
    if (normalized.includes('ì') || normalized.includes('ë') || normalized.includes('°')) {
      try {
        const buffer = Buffer.from(normalized, 'latin1');
        normalized = buffer.toString('utf8');
        console.log('🔧 Decoded normalized:', normalized);
      } catch (decodeError) {
        console.log('⚠️ Decode failed, keeping original');
      }
    }

    // 특수문자를 안전한 문자로 대체
    normalized = normalized
      .replace(/[<>:"/\\|?*]/g, '_')  // 파일시스템에서 금지된 문자들
      .replace(/\s+/g, '_')           // 공백을 언더스코어로
      .replace(/[^\w가-힣\-_.()]/g, '') // 한글, 영숫자, 일부 특수문자만 허용
      .replace(/_{2,}/g, '_')         // 연속된 언더스코어 정리
      .replace(/^_+|_+$/g, '');       // 앞뒤 언더스코어 제거

    return normalized || 'unnamed';
  } catch (error) {
    console.error('❌ normalizeFileName error:', error);
    return 'unnamed';
  }
}

// ========================================
// 📁 폴더 관련 함수들
// ========================================

/**
 * 실제 업로드된 비디오 폴더명 찾기 함수
 * 같은 파일명으로 중복 업로드된 경우 정확한 폴더를 찾음
 * 
 * 📝 수정 포인트:
 * - 검색 범위 변경: 루프 최대값 수정 (현재 20)
 * - 폴더 선택 기준 변경: 최신/최초/크기 등 다른 기준 적용
 * - 캐싱 추가: 자주 사용되는 경우 캐시 로직 구현
 * 
 * @param {string} videoFileName - 동영상 파일명
 * @returns {string} 실제 폴더명
 */
export function findActualVideoFolder(videoFileName: string): string {
  const normalizedName = normalizeFileName(videoFileName);

  console.log(`🔍 Finding folder for video: ${videoFileName}`);
  console.log(`📁 Normalized name: ${normalizedName}`);

  // 모든 가능한 폴더를 검사하고 가장 오래된(기본) 폴더를 우선 선택
  const candidateFolders = [normalizedName]; // 기본 폴더 우선

  // 중복 폴더들 추가 (1), (2), (3) 등
  for (let i = 1; i <= 20; i++) {
    candidateFolders.push(`${normalizedName}(${i})`);
  }

  // 각 폴더를 확인하고 비디오 파일이 있는 첫 번째 폴더 반환
  for (const folderName of candidateFolders) {
    const folderPath = path.join(DATA_DIR, folderName);

    if (fs.existsSync(folderPath)) {
      const videoFilePath = path.join(folderPath, videoFileName);

      if (fs.existsSync(videoFilePath)) {
        console.log(`✅ Found video in folder: ${folderPath}`);

        // VTT 파일 존재 여부도 로그로 확인
        const vttFilePath = path.join(folderPath, `${folderName}-webvtt.vtt`);
        const hasVtt = fs.existsSync(vttFilePath);
        console.log(`📄 VTT file exists: ${hasVtt} at ${vttFilePath}`);

        return folderName;
      } else {
        console.log(`⚠️ Folder exists but no video file: ${videoFilePath}`);
      }
    }
  }

  // 비디오 파일을 찾지 못한 경우 기본 폴더명 반환
  console.log(`❌ Video file not found in any folder for: ${videoFileName}`);
  console.log(`📁 Using fallback folder: ${normalizedName}`);
  return normalizedName;
}

/**
 * 데이터 디렉토리 초기화
 * 
 * 📝 수정 포인트:
 * - 초기 디렉토리 구조 변경: 추가 폴더 생성
 * - 권한 설정: mkdir 옵션에 mode 추가
 */
export function initializeDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory:', DATA_DIR);
  }
}

/**
 * ===================================
 * 📝 File Utils 사용법 및 수정 가이드
 * ===================================
 * 
 * 🔧 주요 함수별 용도:
 * 
 * 1. normalizeFileName():
 *    - 업로드된 파일명을 안전하게 변환
 *    - 한글 인코딩 문제 자동 해결
 *    - 파일시스템 호환성 확보
 * 
 * 2. findActualVideoFolder():
 *    - 중복 업로드된 동영상의 정확한 폴더 찾기
 *    - (1), (2) 형태의 중복 폴더 처리
 *    - 실제 파일 존재 여부 확인
 * 
 * 3. getKoreaTimeISO():
 *    - 한국 시간대 기준 ISO 문자열 생성
 *    - 로그 및 메타데이터에 사용
 * 
 * 📡 사용 예시:
 * ```typescript
 * import { normalizeFileName, findActualVideoFolder } from '../utils/file-utils';
 * 
 * const safeName = normalizeFileName('한글 파일명.mp4');
 * const actualFolder = findActualVideoFolder('한글 파일명.mp4');
 * ```
 */
