/**
 * ===================================
 * 🌐 API 설정 및 클라이언트 헬퍼
 * ===================================
 * 
 * 이 파일에서 모든 API 설정을 중앙 관리합니다.
 * 
 * 🔧 API 서버 변경 시 이 파일만 수정하면 됩니다.
 */

/**
 * 🌐 API 서버 URL 가져오기
 * 
 * 🔧 수정 방법:
 * 1. 환경변수 사용: .env 파일에 VITE_API_URL 설정
 * 2. 직접 설정: return 문의 URL 변경
 * 3. 조건부 설정: 개발/운영 환경 분리
 * 
 * @returns {string} API 서버 URL
 */
export const getApiUrl = (): string => {
  // 🎯 환경변수 우선, 없으면 현재 도메인 사용
  return import.meta.env.VITE_API_URL || window.location.origin;
  
  // 🔧 외부 API 서버 사용 예시:
  // return "https://your-api-server.com";
  
  // 🔧 개발/운영 ��경 분리 예시:
  // return import.meta.env.DEV 
  //   ? 'http://localhost:3001'  // 개발환경
  //   : window.location.origin;  // 운영환경
};

/**
 * 🔐 기본 fetch 옵션
 * 
 * 모든 API 호출에 공통으로 적용되는 설정
 */
export const defaultFetchOptions: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
    // 🔐 인증 토큰이 필요한 경우 추가:
    // 'Authorization': `Bearer ${getAuthToken()}`,
  },
  // 🍪 쿠키를 포함해야 하는 경우:
  // credentials: 'include',
};

/**
 * 📡 API 호출 헬퍼 함수
 * 
 * @param endpoint - API 엔드포인트 (예: '/api/drawing')
 * @param options - fetch 옵션
 * @returns Promise<Response>
 */
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${getApiUrl()}${endpoint}`;
  
  const mergedOptions: RequestInit = {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
    
    // 📊 API 호출 로깅 (개발환경에서만)
    if (import.meta.env.DEV) {
      console.log(`🌐 API Call: ${options.method || 'GET'} ${endpoint}`, {
        status: response.status,
        ok: response.ok,
      });
    }
    
    return response;
  } catch (error) {
    console.error(`❌ API Call Failed: ${endpoint}`, error);
    throw error;
  }
};

/**
 * 📡 주요 API 엔드포인트 상수
 * 
 * 🔧 새로운 API 추가 시 여기에 추가하세요
 */
export const API_ENDPOINTS = {
  // 🎨 그리기 관련
  DRAWING: '/api/drawing',
  DRAWING_LINK: '/api/drawing/link',
  DRAWING_CANCEL: '/api/drawing/cancel',
  
  // 📍 좌표 관련
  COORDINATE_UPDATE: '/api/coordinate/update',
  COORDINATE_DELETE: '/api/coordinate/delete',
  VTT_COORDINATES: '/api/vtt-coordinates',
  
  // 📁 파일 관련
  UPLOAD_FILE: '/api/upload-file',
  DELETE_VIDEO: '/api/video',
  CHECK_FILENAME: '/api/check-filename',
  
  // 💾 데이터 관리
  SAVE_DATA: '/api/save-data',
  WEBVTT: '/api/webvtt',
  
  // 🔍 기타
  PING: '/api/ping',
} as const;

/**
 * 🛠️ API 응답 타입 가드
 */
export const isApiSuccess = (response: any): response is { success: true; data: any } => {
  return response && response.success === true;
};

export const isApiError = (response: any): response is { success: false; error: string } => {
  return response && response.success === false;
};

/**
 * 📝 API 응답 표준 타입
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  timestamp?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
