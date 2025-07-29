// React 기능 가져오기
import { useRef, memo } from "react";
// 아이콘 가져오기
import { Upload, Plus } from "lucide-react";

// 컴포넌트가 받을 수 있는 속성들의 타입
interface UploadAreaProps {
  isUploading: boolean; // 현재 업로드 중인지
  onFileSelect: (file: File) => void; // 파일 선택 시 실행할 함수
  completedUploads: number; // 완료된 업로드 개수
}

// 파일 업로드 영역 컴포넌트
const UploadArea = memo(function UploadArea({
  isUploading,
  onFileSelect,
  completedUploads,
}: UploadAreaProps) {
  // 숨겨진 파일 input에 접근하기 위한 참조
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 업로드 영역 클릭 시 파일 선택창 열기
  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // 파일이 선택되었을 때 처리
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      onFileSelect(file);
      event.target.value = ""; // 같은 파일 재선택 가능하도록 초기화
    }
  };

  return (
    <div className="card">
      {/* 제목 */}
      <div className="card-title">
        동영상 업로드
        {completedUploads > 0 && (
          <span className="completed-count">({completedUploads}개 완료)</span>
        )}
      </div>

      {/* 업로드 영역 */}
      <div
        className="upload-area"
        onClick={!isUploading ? handleUploadClick : undefined}
      >
        {/* 아이콘 */}
        <div className="upload-icon">
          {isUploading ? (
            <div className="spinner" />
          ) : completedUploads > 0 ? (
            <Plus style={{ width: 48, height: 48 }} />
          ) : (
            <Upload style={{ width: 48, height: 48 }} />
          )}
        </div>

        {/* 안내 텍스트 */}
        <div className="upload-text">
          {isUploading
            ? "업로드 중..."
            : completedUploads > 0
              ? "다른 동영상 추가하기"
              : "동영상 파일을 선택하세요"}
        </div>

        {/* 지원 형식 안내 */}
        <div className="upload-description">
          MP4, AVI, MOV 형식 지원
        </div>

        {/* 업로드 버튼 */}
        {!isUploading && (
          <button
            className="upload-button"
            onClick={(e) => {
              e.stopPropagation();
              handleUploadClick(e);
            }}
          >
            {completedUploads > 0 ? "추가 업로드" : "파일 선택"}
          </button>
        )}
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
});

export default UploadArea;
