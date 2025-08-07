// React 기능 가져오기
import React, { useState, memo } from "react";
import { createPortal } from "react-dom";
// 아이콘들 가져오기
import {
  CheckCircle,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
// 공통 타입 가져오기
import type { UploadItem } from "@shared/types";

// 컴포넌트 속성 타입
interface UploadProgressProps {
  uploads: UploadItem[];
  onVideoSelect?: (uploadId: string) => void;
  selectedVideoId?: string;
  adminPanelVisible?: boolean;
  onDeleteVideo?: (uploadId: string) => void;
}

// 파일 크기를 읽기 쉬운 형태로 변환
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 날짜를 읽기 쉬운 형태로 변환
const formatUploadDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
};

// 상태에 따른 텍스트
const getStatusText = (status: string): string => {
  switch (status) {
    case "uploading":
      return "업로드 중";
    case "processing":
      return "처리 중";
    case "completed":
      return "완료";
    case "error":
      return "오류";
    default:
      return "대기 중";
  }
};

// 상태에 따른 아이콘
const getStatusIcon = (status: string) => {
  switch (status) {
    case "uploading":
    case "processing":
      return <div className="spinner" />;
    case "completed":
      return (
        <CheckCircle style={{ width: 16, height: 16, color: "#10b981" }} />
      );
    case "error":
      return <div style={{ width: 16, height: 16, color: "#ef4444" }}>❌</div>;
    default:
      return <Upload style={{ width: 16, height: 16, color: "#6b7280" }} />;
  }
};

// 업로드 진행 상황 컴포넌트
const UploadProgress = memo(function UploadProgress({
  uploads,
  onVideoSelect,
  selectedVideoId,
  adminPanelVisible = true,
  onDeleteVideo,
}: UploadProgressProps) {
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  // 삭제 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const itemsPerPage = 4;

  // 페이지 변경 시 첫 페이지로 이동
  React.useEffect(() => {
    setCurrentPage(1);
  }, [uploads.length]);

  // 업로드가 없으면 표시하지 않음
  if (uploads.length === 0) return null;

  // 완료된 업로드 확인
  const completedUploads = uploads.filter(
    (upload) => upload.status === "completed",
  );
  const hasCompletedUploads = completedUploads.length > 0;

  // 페이지네이션 계산
  const totalPages = Math.ceil(uploads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUploads = uploads.slice(startIndex, endIndex);

  // 비디오 클릭 처리
  const handleVideoClick = (uploadId: string, status: string) => {
    if (status === "completed" && onVideoSelect) {
      if (selectedVideoId === uploadId) {
        onVideoSelect("");
      } else {
        onVideoSelect(uploadId);
      }
    }
  };

  // 삭제 버튼 클릭 처리
  const handleDeleteClick = (e: React.MouseEvent, uploadId: string) => {
    e.stopPropagation();
    setVideoToDelete(uploadId);
    setShowDeleteModal(true);
    setDeleteConfirmed(false);
  };

  // 삭제 확인
  const confirmDelete = () => {
    if (videoToDelete && onDeleteVideo && deleteConfirmed) {
      onDeleteVideo(videoToDelete);
      setShowDeleteModal(false);
      setVideoToDelete(null);
      setDeleteConfirmed(false);
    }
  };

  // 삭제 취소
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setVideoToDelete(null);
    setDeleteConfirmed(false);
  };

  return (
    <div className="card">
      {/* 제목 */}
      <div className="progress-header">
        <div className="card-title">업로드 진행 상황</div>
      </div>

      {/* 업로드 목록 */}
      <div className="progress-container">
        {currentUploads.map((upload) => (
          <div
            key={upload.id}
            className={`progress-item ${upload.status === "completed" ? "clickable" : ""} ${selectedVideoId === upload.id && adminPanelVisible ? "selected" : ""}`}
            onClick={() => handleVideoClick(upload.id, upload.status)}
          >
            {/* 파일 정보 */}
            <div className="progress-header">
              <div className="progress-filename">{upload.filename}</div>
              <div className="progress-status-container">
                <div className="progress-status">
                  {getStatusIcon(upload.status)}
                  {getStatusText(upload.status)}
                </div>

                {/* 삭제 버튼 */}
                {selectedVideoId === upload.id &&
                  upload.status === "completed" && (
                    <button
                      onClick={(e) => handleDeleteClick(e, upload.id)}
                      className="delete-button"
                      title="영상 삭제"
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                      삭제
                    </button>
                  )}
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${upload.progress}%` }}
              />
            </div>

            {/* 파일 정보 */}
            <div className="progress-info">
              <span>
                {upload.uploadDate && formatUploadDate(upload.uploadDate) + " "}
                {formatFileSize(upload.size)}
              </span>
            </div>

            {/* 완료 메시지 */}
            {upload.status === "completed" && (
              <div className="completed-message">
                ✅ 업로드 완료 - 클릭하여 관리자 패널 열기
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>

          <span className="pagination-info">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* 안내 메시지 */}
      {hasCompletedUploads && !selectedVideoId && adminPanelVisible && (
        <div className="help-message">
          💡 완료된 동영상을 클릭하면 관리자 패널이 나타납니다
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal &&
        videoToDelete &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>삭�� 확인</h3>
              <p>진짜 삭제하시겠습니까?</p>

              <div className="confirm-checkbox">
                <input
                  type="checkbox"
                  id="confirm-video-delete"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                />
                <label htmlFor="confirm-video-delete">
                  상기 내용을 확인했습니다
                </label>
              </div>

              <div className="modal-buttons">
                <button onClick={cancelDelete} className="btn-cancel">
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={!deleteConfirmed}
                  className={`btn-delete ${deleteConfirmed ? "enabled" : "disabled"}`}
                >
                  삭제
                </button>
              </div>

              {!deleteConfirmed && (
                <div className="warning-text">
                  ⚠️ 체크박스를 선택해야 삭제할 수 있습니다
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

export default UploadProgress;
