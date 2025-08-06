// 프로젝트 전체에서 사용하는 공통 타입들을 정의하는 파일
// 중복된 타입 정의를 방지하고 일관성을 유지하기 위해 생성

// 탐지된 객체의 정보를 담는 타입
export interface DetectedObject {
  id: string; // 객체의 고유 식별자
  name: string; // 객체 이름
  confidence: number; // AI가 판단한 신뢰도 (0~1 사이의 숫자)
  selected: boolean; // 사용자가 선택했는지 여부
  startTime: number; // 객체가 나타나는 시작 시간 (초 단위)
  endTime: number; // 객체가 사라지는 종료 시간 (초 단위)
  code?: string; // 객체 코드 (선택사항)
  additionalInfo?: string; // 추가 정보 (선택사항)
  dlReservoirDomain?: string; // 관련 웹사이트 도메인 (선택사항)
  category?: string; // 객체 카테고리 (선택사항)
}

// 업로드된 비디오의 정보를 담는 타입
export interface VideoInfo {
  id: string; // 비디오의 고유 식별자
  file: File; // 실제 비디오 파일 객체
  duration: number; // 비디오 길이 (초 단위)
  currentTime: number; // 현재 재생 시간 (초 단위)
  detectedObjects: DetectedObject[]; // �� 비디오에서 탐지된 객체들
  totalObjectsCreated: number; // 총 생성된 객체 수
  uploadDate: Date; // 업로드된 날짜와 시간
}

// 업로드 진행 상황을 나타내는 타입
export interface UploadItem {
  id: string; // 업로드 항목의 고유 식별자
  filename: string; // 업로드할 파일의 이름
  size: number; // 파일 크기 (바이트 단위)
  progress: number; // 업로드 진행률 (0~100%)
  status: "uploading" | "processing" | "completed" | "error"; // 현재 상태
  uploadSpeed?: number; // 업로드 속도 (선택사항)
  timeRemaining?: number; // 남은 시간 (선택사항)
  uploadDate?: Date; // 업로드 시작 날짜 (선택사항)
}
