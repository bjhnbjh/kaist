// React 기본 기능 가져오기
// React는 사용자 인터페이스를 만들기 위한 자바스크립트 라이브러리입니다
// useState는 컴포넌트에서 상태(데이터)를 관리할 때 사용하는 React 훅입니다
import React, { useState } from "react";

// 다른 컴포넌트들 가져오기
// 각 컴포넌트는 특정 기능을 담당하는 재사용 가능한 UI 조각입니다
import UploadArea from "@/components/UploadArea"; // 파일 업로드를 담당하는 컴포넌트
import UploadProgress from "@/components/UploadProgress"; // 업로드 진행상황을 보여주는 컴포넌트
import AdminPanel from "@/components/AdminPanel"; // 관리자 기능을 제공하는 컴포넌트
import VideoPlayer from "@/components/VideoPlayer"; // 동영상을 재생하고 편집하는 컴포넌트

// 커스텀 훅 가져오기
// 훅(Hook)은 React에서 상태와 기능을 관리하는 특별한 함수입니다
import { useVideoUpload } from "@/hooks/useVideoUpload";

/**
 * Index 컴포넌트 - 애플리케이션의 메인 페이지
 *
 * 이 컴포넌트는 동영상 객체 탐지 시스템의 전체 화면을 구성합니다.
 * 사용자가 동영상을 업로드하고, AI가 객체를 탐지하며,
 * 결과를 관리할 수 있는 인터페이스를 제공합니다.
 */
export default function Index() {
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // useVideoUpload 커스텀 훅에서 필요한 상태와 함수들을 가져오기
  // 구조 분해 할당(destructuring)을 사용하여 객체에서 필요한 속성들만 추출
  const {
    // === 상태(State) 값들 ===
    // 상태는 컴포넌트가 기억하고 있는 데이터입니다
    selectedVideo, // 현재 선택된 동영상의 정보
    selectedVideoId, // 선택된 동영상의 고유 ID
    uploads, // 업로드된 파일들의 목록 (배열)
    isUploading, // 현재 업로드가 진행 중인지 여부
    completedUploads, // 완료된 업로드의 개수
    showVideoPlayer, // 동영상 플레이어 모달을 보여줄지 여부
    showDeleteModal, // 삭제 확인 모달을 보여줄지 여부
    detectedObjects, // AI가 탐지한 객체들의 목록
    hasSelectedObjects, // 선택된 객체가 있는지 여부
    adminPanelVisible, // 관리자 패널이 보이는지 여부
    isDetecting, // 현재 객체 탐지가 진행 중인지 여부
    detectionProgress, // 객체 탐지 진행률 (0-100%)
    panelAnimating, // 패널이 애니메이션 중인지 여부
    panelClosing, // 패널이 닫히는 중인지 여부
    hasRunDetection, // 객체 탐지를 한 번이라도 실행했는지 여부

    // === 함수들 ===
    // 사용자의 행동에 따라 실행되는 함수들입니다
    handleFileSelect, // 파일이 선택되었을 때 실행할 함수
    handleVideoSelect, // 동영상이 선택되었을 때 실행할 함수
    closeAdminPanel, // 관리자 패널을 닫는 함수
    deleteSelectedObjects, // 선택된 객체들을 삭제하는 함수
    downloadWebVTT, // WebVTT 자막 파일을 다운로드하는 함수
    runObjectDetection, // AI 객체 탐지를 실행하는 함수
    openVideoPlayer, // 동영상 플레이어를 여는 함수
    addNewObjectToVideo, // 동영상에 새 객체를 추가하는 함수
    deleteObjectFromVideo, // 동영상에서 객체를 삭제하는 함수
    updateObjectInVideo, // 동영상의 객체 정보를 수정하는 함수
    deleteVideo, // 동영상을 삭제하는 함수

    // === 모달 제어 함수들 ===
    setShowVideoPlayer, // 동영상 플레이어 모달 표시/숨김 제어
    setShowDeleteModal, // 삭제 확인 모달 표시/숨김 제어
  } = useVideoUpload(); // useVideoUpload 훅에서 모든 기능들을 가져옴

  /**
   * 관리자 패널에서 객체 탐지를 실행하는 함수
   *
   * 이 함수는 관리자 패널의 "객체 탐지 실행" 버튼이 클릭되었을 때 호출됩니다.
   * 선택된 동영상이 있는지 확인한 후, 해당 동영상에 대해 AI 객체 탐지를 시작합니다.
   */
  const handleObjectDetectionFromAdmin = () => {
    // selectedVideo가 존재하는지 확인 (null이나 undefined가 아닌지)
    if (selectedVideo) {
      // 선택된 동영상의 ID를 사용하여 객체 탐지 실행
      runObjectDetection(selectedVideo.id);
    }
  };

  // JSX 반환
  // JSX는 JavaScript 안에서 HTML처럼 보이는 문자을 사용할 수 있게 해주는 React의 특별한 문법입니다
  // 실제로는 JavaScript 함수 호출로 변환됩니다
  return (
    // 최상위 컨테이너 div
    // className은 HTML의 class 속성과 같지만, JavaScript의 예약어 충돌을 피하기 위해 className을 사용
    <div className="app-container">
      {/* 페이지 상단 헤더 영역 */}
      {/* JSX에서 주석은 이런 형태로 작성합니다 */}
      <div className="header">
        {/* h1: 가장 중요한 제목을 나타내는 HTML 태그 */}
        <h1>GS1 Media 동영상 객체 탐지</h1>
        {/* p: 문단(paragraph)을 나타내는 HTML 태그 */}
        <p>AI 기반 객체 탐지 및 분석</p>
      </div>

      {/* 메인 콘텐츠 영역 */}
      {/* 삼항 연산자 사용: 조건 ? 참일때값 : 거짓일때값 */}
      {/* 관리자 패널이 보이고 선택된 동영상이 있으면 2열 레이아웃, 아니면 1열 레이아웃 */}
      <div
        className={
          adminPanelVisible && selectedVideo
            ? "main-layout"
            : "main-layout-single"
        }
      >
        {/* 왼쪽 패널 - 업로드 관련 기능들 */}
        <div className="left-panel">
          {/* UploadArea 컴포넌트 - 파일 업로드 인터페이스 */}
          {/* 컴포넌트 props(속성)를 전달하는 방식 */}
          <UploadArea
            isUploading={isUploading} // 현재 업로드 중인지 여부를 전달
            onFileSelect={handleFileSelect} // 파일 선택 시 실행할 함수를 전달
            completedUploads={completedUploads} // 완료된 업로드 개수를 전달
          />

          {/* UploadProgress 컴포넌트 - 업로드 진행상황 표시 */}
          <UploadProgress
            uploads={uploads} // 업로드 목록 배열을 전달
            onVideoSelect={handleVideoSelect} // 동영상 선택 함수를 전달
            selectedVideoId={selectedVideoId} // 현재 선택된 동영상 ID를 전달
            adminPanelVisible={adminPanelVisible} // 관리자 패널 표시 여부를 전달
            onDeleteVideo={deleteVideo} // 동영상 삭제 함수를 전달
          />
        </div>

        {/* 오른쪽 패널 - 관리자 기능 */}
        {/* && 연산자: 왼쪽 조건이 true일 때만 오른쪽을 실행 */}
        {/* 관리자 패널이 보이거나 애니메이션 중이고, 선택된 동영상이 있을 때만 표시 */}
        {(adminPanelVisible || panelAnimating) && selectedVideo && (
          <div
            className={`right-panel ${panelAnimating && !panelClosing ? "opening" : ""} ${panelClosing ? "closing" : ""}`}
          >
            {/* AdminPanel 컴포넌트 - 관리자 기능 제공 */}
            <AdminPanel
              objects={detectedObjects} // 탐지된 객체 목록을 전달
              onOpenVideoPlayer={openVideoPlayer} // 동영상 플레이어 열기 함수
              onDeleteSelected={() => setShowDeleteModal(true)} // 삭제 버튼 클릭 시 모달 열기
              onDownloadWebVTT={downloadWebVTT} // WebVTT 다운로드 함수
              onRunObjectDetection={handleObjectDetectionFromAdmin} // 객체 탐지 실행 함수
              hasSelectedObjects={hasSelectedObjects} // 선택된 객체 존재 여부
              hasVideo={!!selectedVideo} // 동영상 존재 여부 (!!는 불린 변환)
              videoId={selectedVideo?.id} // 선택된 동영상 ID (옵셔널 체이닝 사용)
              isDetecting={isDetecting} // 탐지 진행 중 여부
              detectionProgress={detectionProgress} // 탐지 진행률
              onClose={closeAdminPanel} // 패널 닫기 함수
              selectedVideo={selectedVideo} // 선택된 동영상 전체 정보
              hasRunDetection={hasRunDetection} // 탐지 실행 여부
            />
          </div>
        )}
      </div>

      {/* VideoPlayer 컴포넌트 - 동영상 재생 및 편집 모달 */}
      {/* 이 컴포넌트는 항상 렌더링되지만, isOpen prop에 따라 표시/숨김이 결정됩니다 */}
      <VideoPlayer
        isOpen={showVideoPlayer} // 모달이 열려있는지 여부
        onClose={() => setShowVideoPlayer(false)} // 모달 닫기 - 화살표 함수 사용
        video={selectedVideo} // 재생할 동영상 정보
        detectedObjects={detectedObjects} // 탐지된 객체 목록
        onDownloadWebVTT={downloadWebVTT} // WebVTT 다운로드 함수
        onRunObjectDetection={runObjectDetection} // 객체 탐지 함수
        onAddNewObject={addNewObjectToVideo} // 새 객체 추가 함수
        onDeleteObject={deleteObjectFromVideo} // 객체 삭제 함수
        onUpdateObject={updateObjectInVideo} // 객체 정보 수정 함수
      />

      {/* 삭제 확인 모달 */}
      {/* showDeleteModal이 true일 때만 모달을 표시하는 조건부 렌더링 */}
      {showDeleteModal && (
        // 모달 배경 오버레이 - 전체 화면을 덮는 반투명 배경
        <div className="modal-overlay">
          {/* 모달 박스 - 실제 내용이 들어가는 흰색 박스 */}
          <div className="modal-box">
            {/* 모달 제목 */}
            <h3>삭제 확인</h3>

            {/* 확인 메시지 */}
            <p>선택된 객체를 삭제하시겠습니까?</p>

            {/* 확인 체크박스 영역 */}
            <div className="confirm-checkbox">
              {/* 체크박스 input */}
              {/* onChange 이벤트: 체크박스 상태가 바뀔 때마다 실행 */}
              <input
                type="checkbox" // HTML input 타입을 체크박스로 설정
                id="confirm-delete" // HTML id 속성 - label과 연결하기 위해 사용
                checked={deleteConfirmed} // 현재 체크 상태
                onChange={(e) => setDeleteConfirmed(e.target.checked)} // 체크 상태 변경 함수
              />

              {/* 체크박스 레이블 - 클릭하면 체크박스도 함께 체크됨 */}
              <label htmlFor="confirm-delete">상기 내용을 확인했습니다</label>
            </div>

            {/* 버튼 영역 */}
            <div className="modal-buttons">
              {/* 취소 버튼 */}
              {/* onClick: 버튼 클릭 시 실행할 함수 */}
              <button
                onClick={() => {
                  setShowDeleteModal(false); // 모달 닫기
                  setDeleteConfirmed(false); // 체크박스 상태 초기화
                }}
                className="btn-cancel"
              >
                취소
              </button>

              {/* 삭제 확인 버튼 */}
              <button
                onClick={() => {
                  deleteSelectedObjects(); // 선택된 객체들 삭제 실행
                  setDeleteConfirmed(false); // 체크박스 상태 초기화
                }}
                disabled={!deleteConfirmed} // 체크박스가 체크되지 않으면 버튼 비활성화
                className={`btn-delete ${deleteConfirmed ? "enabled" : "disabled"}`} // 조건부 클래스명
              >
                삭제
              </button>
            </div>

            {/* 경고 메시지 - 체크박스가 체크되지 않았을 때만 표시 */}
            {/* !deleteConfirmed: deleteConfirmed가 false일 때 */}
            {!deleteConfirmed && (
              <div className="warning-text">
                ⚠️ 체크박스를 선택해야 삭제할 수 있습니다
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 이 파일에서 사용된 주요 React 개념들:
 *
 * 1. 컴포넌트 (Component): 재사용 가능한 UI 조각
 * 2. JSX: JavaScript 안에서 HTML처럼 쓸 수 있는 문법
 * 3. Props: 컴포넌트에 데이터를 전달하는 방법
 * 4. State: 컴포넌트가 기억하는 데이터 (useState 훅 사용)
 * 5. 조건부 렌더링: 조건에 따라 다른 UI를 보여주는 방법
 * 6. 이벤트 핸들링: 사용자의 행동(클릭, 입력 등)에 반응하는 방법
 * 7. 훅(Hook): React에서 상태와 기능을 관리하는 특별한 함수
 *
 * HTML/React 초보자를 위한 추가 설명:
 * - HTML은 웹페이지의 구조를 만드는 언어입니다
 * - React는 HTML을 JavaScript로 동적으로 만들 수 있게 해주는 도구입니다
 * - JSX는 HTML과 JavaScript를 섞어서 쓸 수 있는 특별한 문법입니다
 * - 컴포넌트는 레고 블록처럼 조립해서 큰 애플리케이션을 만드는 작은 UI 조각입니다
 */
