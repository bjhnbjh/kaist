# 🔧 API 설정 및 수정 가이드

## 📍 **API URL 설정 위치**

### **1. 프론트엔드 API 호출 위치**

#### **A. VideoPlayer.tsx** (주요 API 호출)
```typescript
// 📍 위치: platform/client/components/VideoPlayer.tsx

/**
 * 🌐 API 서버 URL 설정 함수
 * 
 * 🔧 수정 방법:
 * 1. 개발환경: 로컬 서버 사용
 * 2. 운영환경: 외부 API 서버 사용
 * 3. 환경변수: .env 파일 활용
 */
const getApiUrl = () => {
  // 🎯 현재 설정 (같은 도메인 사용)
  return window.location.origin;
  
  // 🔧 다른 API 서버 사용 시 수정 예시:
  // return "https://your-api-server.com";
  // 
  // 🔧 환경변수 사용 예시:
  // return process.env.REACT_APP_API_URL || window.location.origin;
  //
  // 🔧 조건부 설정 예시:
  // return process.env.NODE_ENV === 'development' 
  //   ? 'http://localhost:3001'  // 개발용 API 서버
  //   : window.location.origin;  // 운영용 (같은 도메인)
};

/**
 * 📡 주요 API 엔드포인트들:
 * 
 * 1. POST /api/drawing          - 그리기 데이터 전송
 * 2. POST /api/drawing/link     - 좌표와 객체명 연결  
 * 3. POST /api/drawing/cancel   - 임시 좌표 취소
 * 4. POST /api/coordinate/update - 좌표 파일 업데이트
 * 5. POST /api/coordinate/delete - 좌표 파일 삭제
 * 6. POST /api/webvtt           - WebVTT 자막 생성
 * 7. POST /api/save-data        - 편집 데이터 저장
 * 8. GET  /api/vtt-coordinates  - VTT 좌표 데이터 읽기
 * 9. POST /api/upload-file      - 동영상 업로드
 * 10. DELETE /api/video         - 동영상 삭제
 */
```

#### **B. useVideoUpload.ts** (업로드 관련 API)
```typescript
// 📍 위치: platform/client/hooks/useVideoUpload.ts

/**
 * 🔧 API URL 설정 (라인 100, 147, 475 등)
 * 
 * 현재 설정:
 * const apiUrl = window.location.origin;
 * 
 * 수정 방법:
 * const apiUrl = "https://your-api-server.com";  // 외부 서버
 * 또는
 * const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
 */
```

### **2. 환경변수 설정 방법**

#### **A. 개발 환경 (.env.development)**
```bash
# 📍 파일 위치: platform/.env.development
VITE_API_URL=http://localhost:3001
REACT_APP_API_URL=http://localhost:3001
```

#### **B. 운영 환경 (.env.production)**
```bash
# 📍 파일 위치: platform/.env.production  
VITE_API_URL=https://your-production-api.com
REACT_APP_API_URL=https://your-production-api.com
```

### **3. 서버 API 엔드포인트 위치**

#### **A. 메인 서버 설정**
```typescript
// 📍 위치: platform/server/index.ts

/**
 * 🚀 서버 API 라우트 정의
 * 
 * 모든 API는 "/api/" 접두사를 사용합니다.
 * 
 * 🔧 새로운 API 추가 방법:
 * 1. server/routes/ 폴더에 새 파일 생성
 * 2. 여기서 import 및 라우트 등록
 * 3. 클라이언트에서 호출
 */

// 예시: 새로운 API 추가
app.post("/api/new-endpoint", handleNewEndpoint);
```

#### **B. 각 API 라우트 ���일들**
```typescript
// 📍 위치: platform/server/routes/

/**
 * 📁 API 라우트 파일 구조:
 * 
 * ├── drawing.ts         - 그리기 관련 API
 * ├── upload.ts          - 업로드 관련 API  
 * ├── webvtt.ts          - WebVTT 관련 API
 * ├── save-data.ts       - 데이터 저장 API
 * ├── vtt-coordinates.ts - 좌표 데이터 API
 * └── check-filename.ts  - 파일명 체크 API
 */
```

## 🔄 **API 서버 변경 시 수정해야 할 파일들**

### **1. 프론트엔드 수정**
```typescript
// 📍 수정할 파일들:
// 1. client/components/VideoPlayer.tsx    - getApiUrl() 함수
// 2. client/hooks/useVideoUpload.ts       - apiUrl 변수들 (여러 위치)

// 🔧 일괄 수정 방법:
// 1. 전역 API 설정 파일 생성
// 2. 모든 컴포넌트에서 import하여 사용

// 📁 새 파일: client/config/api.ts
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || window.location.origin;
};

// 사용법:
import { getApiUrl } from '@/config/api';
const apiUrl = getApiUrl();
```

### **2. 서버 설정 수정**
```typescript
// 📍 위치: platform/server/index.ts

/**
 * 🔧 CORS 설정 (다른 도메인에서 접근 시 필요)
 */
app.use(cors({
  origin: [
    'http://localhost:8080',          // 개발용 프론트엔드
    'https://your-frontend-domain.com' // 운영용 프론트엔드
  ],
  credentials: true
}));
```

## 🚀 **배포 환경별 설정**

### **1. 로컬 개발환경**
```bash
# 프론트엔드: http://localhost:8080
# 백엔드: http://localhost:8080 (같은 포트)
# API 호출: window.location.origin 사용
```

### **2. 분리 개발환경**
```bash
# 프론트엔드: http://localhost:3000
# 백엔드: http://localhost:3001  
# API 호출: 'http://localhost:3001' 직접 지정
```

### **3. 운영환경**
```bash
# 프론트엔드: https://yourdomain.com
# 백엔드: https://api.yourdomain.com
# API 호출: 환경변수 또는 설정 파일 사용
```

## 🛠️ **API 오류 해결 가이드**

### **1. CORS 오류**
```typescript
// 📍 서버 설정 (server/index.ts)
app.use(cors({
  origin: true,  // 개발용 (모든 도메인 허용)
  // origin: ['https://yourdomain.com'],  // 운영용 (특정 도메인만)
  credentials: true
}));
```

### **2. 404 오류**
```typescript
// 📍 확인사항:
// 1. API 엔드포인트가 server/index.ts에 등록되어 있는지
// 2. 라우트 핸들러가 올바르게 export되어 있는지  
// 3. URL 경로가 정확한지 (/api/ 접두사 포함)
```

### **3. 파일 업로드 오류**
```typescript
// 📍 확인사항:
// 1. multer 미들웨어 설정 (server/routes/upload.ts)
// 2. 파일 크기 제한 (50MB)
// 3. 업로드 디렉토리 권한
```

## 📝 **API 응답 형식**

### **표준 응답 구조**
```typescript
// ✅ 성공 응답
{
  "success": true,
  "message": "작업이 성공적으로 완료되었습니다.",
  "data": { /* 실제 데이터 */ },
  "timestamp": "2024-01-01T12:00:00.000Z"
}

// ❌ 오류 응답  
{
  "success": false,
  "message": "오류가 발생했습니다.",
  "error": "상세 오류 정보",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔐 **보안 고려사항**

### **1. API 키 관리**
```typescript
// ❌ 잘못된 방법: 클라이언트에 하드코딩
const apiKey = "secret-key-12345";

// ✅ 올바른 방법: 서버에서만 관리
// 클라이언트에서는 인증 토큰만 사용
```

### **2. 환경변수 보안**
```bash
# ✅ 서버 환경변수 (.env)
API_SECRET_KEY=your-secret-key
DATABASE_URL=your-db-connection

# ❌ 클라이언트 환경변수에 비밀정보 저장 금지
# VITE_API_SECRET=secret  # 이렇게 하면 브라우저에 노출됨
```

---

## 💡 **빠른 수정 체크리스트**

- [ ] `getApiUrl()` 함수 수정 (VideoPlayer.tsx)
- [ ] `useVideoUpload.ts`의 apiUrl 변수들 수정
- [ ] 환경변수 설정 (.env 파일)
- [ ] CORS 설정 (다른 도메인 사용 시)
- [ ] 서버 API 엔드포인트 확인
- [ ] 네트워크 탭에서 API 호출 확인
- [ ] 브라우저 콘솔에서 오류 확인
