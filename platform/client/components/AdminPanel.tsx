// React 기능 가져오기
import React, { useState, memo } from "react";
// 아이콘들 가져오기
import { Play, BarChart3, Check, Search, RefreshCw } from "lucide-react";
// 공통 타입 가져오기
import type { DetectedObject, VideoInfo } from "@shared/types";

// 컴포넌트 속성 타입
interface AdminPanelProps {
  objects: DetectedObject[];
  onOpenVideoPlayer: () => void;
  onDeleteSelected: () => void;
  onDownloadWebVTT: () => void;
  onRunObjectDetection: () => void;
  hasSelectedObjects: boolean;
  hasVideo: boolean;
  videoId?: string;
  isDetecting?: boolean;
  detectionProgress?: number;
  onClose?: () => void;
  selectedVideo?: VideoInfo | null;
  hasRunDetection?: boolean;
}

// 관리자 패널 컴포넌트
const AdminPanel = memo(function AdminPanel({
  objects,
  onOpenVideoPlayer,
  onDownloadWebVTT,
  onRunObjectDetection,
  hasVideo,
  isDetecting = false,
  onClose,
  selectedVideo,
  hasRunDetection = false,
}: AdminPanelProps) {
  // 객체 검색어 상태
  const [objectSearchQuery, setObjectSearchQuery] = useState("");
  // 탐지 완료 메시지 표시 상태
  const [showCompletionMessage, setShowCompletionMessage] = useState(true);

  // 객체 검색 필터링
  const filteredObjects = objects.filter((obj) =>
    obj.name.toLowerCase().includes(objectSearchQuery.toLowerCase()),
  );

  // 탐지 완료 시 3초 후 메시지 숨기기
  React.useEffect(() => {
    if (!isDetecting && objects.length > 0 && showCompletionMessage) {
      const timer = setTimeout(() => {
        setShowCompletionMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (isDetecting) {
      setShowCompletionMessage(true);
    }
  }, [isDetecting, objects.length, showCompletionMessage]);

  return (
    <div className="admin-panel">
      {/* 헤더 */}
      <div className="admin-header">
        <div>
          <div className="admin-title">객체 관리 패널</div>
          <div className="admin-subtitle">
            탐지된 객체들을 관리하고 제어할 수 있습니다
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="close-button">
            ✕
          </button>
        )}
      </div>

      {hasVideo && (
        <>
          {/* 선택된 동영상 정보 */}
          {selectedVideo && (
            <div className="video-info-section">
              <div className="section-title">선택된 동영상 정보</div>
              <div className="video-info-grid">
                <div className="info-row">
                  <span className="info-label">제목:</span>
                  <span className="info-value">{selectedVideo.file.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">파일 크기:</span>
                  <span className="info-value">
                    {(selectedVideo.file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">업로드 날짜:</span>
                  <span className="info-value">
                    {selectedVideo.uploadDate.toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">탐지된 객체:</span>
                  <span className="info-value success">{objects.length}개</span>
                </div>
              </div>
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="admin-actions">
            <button
              onClick={onOpenVideoPlayer}
              className="admin-button primary"
            >
              <Play style={{ width: 14, height: 14 }} />
              탐지된 객체 수정
            </button>

            <button
              onClick={onRunObjectDetection}
              className="admin-button primary"
              style={{
                background: isDetecting ? "#9ca3af" : "#10b981",
                cursor: isDetecting ? "not-allowed" : "pointer",
              }}
              disabled={isDetecting}
            >
              <BarChart3 style={{ width: 14, height: 14 }} />
              {isDetecting ? "탐지 중..." : "객체 탐지 실행"}
            </button>
          </div>

          {/* 객체 탐지 진행도 */}
          {isDetecting && (
            <div className="detection-progress">
              <div className="spinner green" />
              <div className="progress-text">객체 탐지 실행 중...</div>
            </div>
          )}

          {/* 탐지 완료 메시지 */}
          {!isDetecting &&
            hasRunDetection &&
            objects.length > 0 &&
            showCompletionMessage && (
              <div className="completion-message">
                <Check style={{ width: 20, height: 20, color: "#10b981" }} />
                <div className="completion-text">
                  객체 탐지 완료!
                </div>
              </div>
            )}

          {/* 객체 목록 헤더 */}
          <div className="objects-header">
            <div className="section-title">
              탐지된 객체들 ({hasRunDetection ? objects.length : 0}개)
            </div>
            {hasRunDetection && objects.length > 0 && (
              <div className="search-container">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="객체 검색..."
                  value={objectSearchQuery}
                  onChange={(e) => setObjectSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            )}
          </div>

          {/* 객체 목록 */}
          {!hasRunDetection || objects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">
                {!hasRunDetection
                  ? "객체 탐지를 실행하세요"
                  : "탐지된 객체가 없습니다"}
              </div>
              <div className="empty-description">
                "객체 탐지 실행" 버튼을 클릭하면
                <br />
                {!hasRunDetection
                  ? "AI가 동영상에서 객체들을 찾아냅니다"
                  : "영역을 그려서 객체를 추가해보세요"}
              </div>
            </div>
          ) : (
            <div className="objects-grid">
              {filteredObjects.map((object) => (
                <div key={object.id} className="object-item">
                  <div className="object-indicator" />
                  <div className="object-info">
                    <div className="object-name">{object.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 비디오가 없을 때 */}
      {!hasVideo && (
        <div className="no-video-state">
          <div className="no-video-icon">📹</div>
          <div className="no-video-title">동영상을 업로드하세요</div>
          <div className="no-video-description">
            업로드 후 객체 탐지 결과를 확인할 수 있습니다
          </div>
        </div>
      )}
    </div>
  );
});

export default AdminPanel;
