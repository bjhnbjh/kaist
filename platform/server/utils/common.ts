import fs from "fs";
import path from "path";

/**
 * ===================================
 * 🛠️ 서버 공통 유틸리티 함수들
 * ===================================
 * 
 * 이 파일은 서버의 여러 라우트에서 공통으로 사용되는
 * 유틸리티 함수들을 모아놓은 모듈입니다.
 * 
 * 주요 기능:
 * - 한국 시간 처리
 * - 파일명 정규화
 * - 시간 형식 변환
 * - 디렉토리 관리
 */

// ========================================
// 🌏 시간 관련 유틸리티
// ========================================

/**
 * 한국���간(KST) 기준으로 ISO 문자열 반환
 * 
 * 사용처: 모든 서버 로그 및 데이터 타임스탬프
 * 
 * @returns {string} KST 시간대의 ISO 문자열 (예: "2024-01-01T12:00:00.000+09:00")
 */
export function getKoreaTimeISO(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().replace('Z', '+09:00');
}

/**
 * 초 단위 시간을 WebVTT 형식으로 변환
 * 
 * 사용처: WebVTT 자막 파일 생성
 * 
 * @param {number} seconds - 초 단위 시간
 * @returns {string} MM:SS:HH 형식의 시간 문자열 (예: "02:30:50")
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100); // 밀리초를 100분의 1초 단위로

  return `${totalMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

// ========================================
// 📁 파일 시스템 유틸리티
// ========================================

/**
 * 데이터 디렉토리 경로 반환
 * 
 * 사용처: 모든 파일 저장 작업
 * 
 * @returns {string} 데이터 디렉토리��� 절대 경로
 */
export function getDataDirectory(): string {
  return path.join(process.cwd(), 'data');
}

/**
 * 디렉토리가 존재하지 않으면 생성
 * 
 * 사용처: 파일 저장 전 디렉토리 보장
 * 
 * @param {string} dirPath - 생성할 디렉토리 경로
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

/**
 * 파일명을 안전하게 정규화하는 함수 (한글 지원)
 * 
 * 기능:
 * - 한글 파일명 UTF-8 정규화
 * - 인코딩 문제 자동 복구
 * - 파일시스템 호환성 보장
 * - 특수문자 및 공백 처리
 * 
 * 사용처: 모든 파일 저장 작업
 * 
 * @param {string} fileName - 원본 파일명
 * @returns {string} 정규화된 파일명
 */
export function normalizeFileName(fileName: string): string {
  try {
    console.log('🔍 Original fileName:', fileName);

    // 확장자 분리
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);

    // 파일명을 UTF-8로 정규화
    let normalized = baseName.normalize('NFC').trim();

    // 한국어 인코딩 문제 복구 시도 (latin1 -> utf8 변환)
    if (normalized.includes('ì') || normalized.includes('ë') || normalized.includes('°')) {
      try {
        const buffer = Buffer.from(normalized, 'latin1');
        normalized = buffer.toString('utf8');
        console.log('🔧 Decoded normalized:', normalized);
      } catch (decodeError) {
        console.log('⚠️ Decode failed, keeping original');
      }
    }

    // 파일시스템 안전성을 위한 문자 정리
    normalized = normalized
      .replace(/[<>:"/\\|?*]/g, '_')    // 파일시스템에서 금지된 문자들
      .replace(/\s+/g, '_')             // 공백을 언더스코어로
      .replace(/[^\w가-힣\-_.()]/g, '') // 한글, 영숫자, 일부 특수문자만 허용
      .replace(/_{2,}/g, '_')           // 연속된 언더스코어 정리
      .replace(/^_+|_+$/g, '');         // 앞뒤 언더스코어 제거

    console.log('✅ Final normalized:', normalized);
    return normalized || 'unnamed';
  } catch (error) {
    console.error('❌ normalizeFileName error:', error);
    return 'unnamed';
  }
}

// ========================================
// 🔄 데이터 변환 유틸리티
// ========================================

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 * 
 * 사용처: 업로드 진행상황 표시
 * 
 * @param {number} bytes - 바이트 단위 파일 크기
 * @returns {string} 읽기 쉬운 형태의 파일 크기 (예: "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 고유 ID 생성
 * 
 * 사용처: 객체, 업로드, 그리기 영역 등의 고유 식별자
 * 
 * @param {string} prefix - ID 접두사 (예: "video", "obj", "drawing")
 * @returns {string} 고유 ID (예: "video-1234567890-abc123def")
 */
export function generateUniqueId(prefix: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${randomString}`;
}

/**
 * ===================================
 * 📝 사용법 안내
 * ===================================
 * 
 * 이 유틸리티 모듈을 사용하려면:
 * 
 * ```typescript
 * import { 
 *   getKoreaTimeISO, 
 *   normalizeFileName, 
 *   getDataDirectory,
 *   ensureDirectoryExists 
 * } from '../utils/common';
 * 
 * // 한국 시간 타임스탬프
 * const timestamp = getKoreaTimeISO();
 * 
 * // 안��한 파일명으로 변환
 * const safeName = normalizeFileName(originalFileName);
 * 
 * // 데이터 디렉토리 보장
 * const dataDir = getDataDirectory();
 * ensureDirectoryExists(dataDir);
 * ```
 */
