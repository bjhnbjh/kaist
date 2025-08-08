/**
 * ===================================
 * 🧪 API 테스트 유틸리티
 * ===================================
 * 
 * API 연결 상태를 확인하고 테스트하는 함수들
 * 
 * 🔧 사용법:
 * 1. 브라우저 콘솔에서 testApiConnection() 실행
 * 2. 각 API 엔드포인트별 테스트 실행
 */

import { getApiUrl, apiCall, API_ENDPOINTS } from '../config/api';

/**
 * 🔍 API 서버 연결 테스트
 * 
 * @returns Promise<boolean> 연결 성공 여부
 */
export const testApiConnection = async (): Promise<boolean> => {
  try {
    console.log(`🌐 API 서버 테스트 시작: ${getApiUrl()}`);
    
    const response = await apiCall(API_ENDPOINTS.PING);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API 서버 연�� 성공:', data);
      return true;
    } else {
      console.log('❌ API 서버 응답 오류:', response.status, data);
      return false;
    }
  } catch (error) {
    console.error('❌ API 서버 연결 실패:', error);
    return false;
  }
};

/**
 * 📊 모든 API 엔드포인트 상태 확인
 */
export const checkAllEndpoints = async (): Promise<void> => {
  console.log('🔍 모든 API 엔드포인트 상태 확인 시작...');
  
  const endpoints = [
    { name: 'Ping', url: API_ENDPOINTS.PING, method: 'GET' },
    { name: 'VTT Coordinates', url: API_ENDPOINTS.VTT_COORDINATES, method: 'GET' },
    { name: 'Check Filename', url: `${API_ENDPOINTS.CHECK_FILENAME}?filename=test.mp4`, method: 'GET' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await apiCall(endpoint.url, { method: endpoint.method });
      const status = response.ok ? '✅' : '❌';
      console.log(`${status} ${endpoint.name}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint.name}: 연결 실패`);
    }
  }
};

/**
 * 🔧 API 설정 정보 출력
 */
export const showApiConfig = (): void => {
  console.log('🔧 현재 API 설정:');
  console.log('📍 API URL:', getApiUrl());
  console.log('🌍 환경변수 VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('🏠 현재 도메인:', window.location.origin);
  console.log('🛠️ 개발 모드:', import.meta.env.DEV);
  
  console.log('\n📡 사용 가능한 엔드포인트:');
  Object.entries(API_ENDPOINTS).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
};

/**
 * 🚀 API 성능 테스트
 */
export const performanceTest = async (): Promise<void> => {
  console.log('🚀 API 성능 테스트 시작...');
  
  const startTime = performance.now();
  const requests = 5;
  const promises = [];
  
  for (let i = 0; i < requests; i++) {
    promises.push(apiCall(API_ENDPOINTS.PING));
  }
  
  try {
    await Promise.all(promises);
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / requests;
    
    console.log(`✅ 성능 테스트 완료:`);
    console.log(`  요청 수: ${requests}`);
    console.log(`  총 시간: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`  평균 응답 시간: ${avgTime.toFixed(2)}ms`);
  } catch (error) {
    console.error('❌ 성능 테스트 실패:', error);
  }
};

// 🌐 전역 함수로 등록 (개발 환경에서만)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).testApi = {
    connection: testApiConnection,
    checkAll: checkAllEndpoints,
    config: showApiConfig,
    performance: performanceTest,
  };
  
  console.log('🧪 API 테스트 함수가 등록되었습니다:');
  console.log('  testApi.connection() - 연결 테스트');
  console.log('  testApi.checkAll() - 모든 엔드포인트 확인');
  console.log('  testApi.config() - 설정 정보 확인');
  console.log('  testApi.performance() - 성능 테스트');
}
