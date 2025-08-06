// React 훅과 토스트 알림 가져오기
import { useState, useCallback } from "react";
import { toast } from "sonner";
// 공통 타입 가져오기
import type { DetectedObject, VideoInfo, UploadItem } from "@shared/types";

// 기본 객체 데이터 (AI 탐지 시뮬레이션용)
const DEFAULT_OBJECTS: Omit<DetectedObject, "id">[] = [
  {
    name: "Object(1)",
    confidence: 0.95,
    selected: false,
    code: "CODE_OBJ001",
    additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
    dlReservoirDomain: "http://www.naver.com",
    category: "기타",
  },
  {
    name: "Object(2)",
    confidence: 0.87,
    selected: false,
    code: "CODE_OBJ002",
    additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
    dlReservoirDomain: "http://www.naver.com",
    category: "기타",
  },
  {
    name: "Object(3)",
    confidence: 0.92,
    selected: false,
    code: "CODE_OBJ003",
    additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
    dlReservoirDomain: "http://www.naver.com",
    category: "기타",
  },
  {
    name: "Object(4)",
    confidence: 0.78,
    selected: false,
    code: "CODE_OBJ004",
    additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
    dlReservoirDomain: "http://www.naver.com",
    category: "기타",
  },
  {
    name: "Object(5)",
    confidence: 0.84,
    selected: false,
    code: "CODE_OBJ005",
    additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
    dlReservoirDomain: "http://www.naver.com",
    category: "기타",
  },
];

// 비디오 업로드와 관리를 위한 커스텀 훅
export function useVideoUpload() {
  // 기본 상태들
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // 모달 상태들
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // UI 상태들
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [panelAnimating, setPanelAnimating] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const [hasRunDetection, setHasRunDetection] = useState(false);

  // 현재 선택된 비디오 정보
  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || null;
  const selectedVideoObjects = selectedVideo?.detectedObjects || [];

  // API를 통한 업로드 정보 전송
  const sendUploadToApi = useCallback(async (file: File, uploadId: string) => {
    try {
      const apiUrl = window.location.origin;

      const uploadData = {
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        duration: 0, // 실제로는 비디오에서 추출
        timestamp: Date.now(),
        metadata: {
          // 실제로는 비디오 메타데이터 추출
        }
      };

      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload API response:', result);
        toast.success('업로드 정보가 서버에 저장되었습니다.');
      } else {
        throw new Error('API 전송 실패');
      }
    } catch (error) {
      console.error('Upload API error:', error);
      toast.error('서버로 업로드 정보를 전송하는 중 오류가 발생했습니다.');
    }
  }, []);

  // 업로드 시뮬레이션 함수
  const simulateUpload = useCallback((file: File) => {
    const uploadId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileSizeInMB = file.size / (1024 * 1024);

    // 파일 크기에 따라 업로드 시간 결정
    const baseUploadTime = Math.max(
      3,
      fileSizeInMB * (0.5 + Math.random() * 1.5),
    );
    const processingTime = Math.max(2, fileSizeInMB * 0.3);

    const newUpload: UploadItem = {
      id: uploadId,
      filename: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
      uploadSpeed: 0,
      timeRemaining: baseUploadTime,
      uploadDate: new Date(),
    };

    // 새 업로드만 유지하고 기존 데이터 초기화
    setUploads([newUpload]);
    setVideos([]);
    setSelectedVideoId(null);
    setAdminPanelVisible(false);

    // 업로드 진행 시뮬레이션
    let progress = 0;
    let uploadInterval: NodeJS.Timeout;
    let processTimeoutId: NodeJS.Timeout;

    uploadInterval = setInterval(
      () => {
        progress += Math.random() * 15 + 5;

        if (progress >= 100) {
          progress = 100;
          clearInterval(uploadInterval);

          // 처리 단계로 이동
          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === uploadId
                ? {
                    ...upload,
                    progress: 100,
                    status: "processing",
                    uploadSpeed: undefined,
                    timeRemaining: undefined,
                  }
                : upload,
            ),
          );

          // 처리 완료 후 비디오 추가
          processTimeoutId = setTimeout(() => {
            setUploads((prev) =>
              prev.map((upload) =>
                upload.id === uploadId
                  ? { ...upload, status: "completed" }
                  : upload,
              ),
            );

            const newVideo: VideoInfo = {
              id: uploadId,
              file,
              duration: 0,
              currentTime: 0,
              detectedObjects: [],
              totalObjectsCreated: 0,
              uploadDate: new Date(),
            };

            setVideos([newVideo]);

            // API로 업로드 정보 전송
            sendUploadToApi(file, uploadId);

            toast.success("동영상 업로드 및 처리가 완료되었습니다!");
          }, processingTime * 1000);
        } else {
          const remainingTime = (baseUploadTime * (100 - progress)) / 100;
          const speed = ((progress / 100) * file.size) / baseUploadTime;

          setUploads((prev) =>
            prev.map((upload) =>
              upload.id === uploadId
                ? {
                    ...upload,
                    progress: Math.round(progress),
                    uploadSpeed: speed,
                    timeRemaining: remainingTime,
                  }
                : upload,
            ),
          );
        }
      },
      Math.random() * 300 + 200,
    );

    // cleanup 함수 반환
    return () => {
      clearInterval(uploadInterval);
      clearTimeout(processTimeoutId);
    };
  }, []);

  // 파일 선택 처리
  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) {
        toast.error("동영상 파일만 업로드 가능합니다.");
        return;
      }

      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast.error("파일 크기는 2GB를 초과할 수 없습니다.");
        return;
      }

      simulateUpload(file);
    },
    [simulateUpload],
  );

  // 비디오 선택 처리
  const handleVideoSelect = useCallback(
    (videoId: string) => {
      if (videoId === "") {
        // 선택 해제 - 닫기 애니메이션
        setPanelClosing(true);
        setPanelAnimating(true);
        const timeoutId = setTimeout(() => {
          setSelectedVideoId(null);
          setAdminPanelVisible(false);
          setPanelAnimating(false);
          setPanelClosing(false);
        }, 300);
        return () => clearTimeout(timeoutId);
      } else {
        setSelectedVideoId(videoId);
        // 해당 비디오에 이미 탐지된 객체가 있으면 hasRunDetection을 true로 설정
        const video = videos.find(v => v.id === videoId);
        const hasDetectedObjects = video && video.detectedObjects.length > 0;
        setHasRunDetection(hasDetectedObjects);

        if (!adminPanelVisible) {
          setPanelAnimating(true);
          setAdminPanelVisible(true);
          const timeoutId = setTimeout(() => {
            setPanelAnimating(false);
          }, 300);
          return () => clearTimeout(timeoutId);
        }
      }
    },
    [adminPanelVisible],
  );

  // 관리자 패널 ��기
  const closeAdminPanel = useCallback(() => {
    setPanelClosing(true);
    setPanelAnimating(true);
    const timeoutId = setTimeout(() => {
      setAdminPanelVisible(false);
      setSelectedVideoId(null);
      setPanelAnimating(false);
      setPanelClosing(false);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  // 선택된 객체들 삭제
  const deleteSelectedObjects = useCallback(() => {
    if (!selectedVideoId) return;

    setVideos((prev) =>
      prev.map((video) =>
        video.id === selectedVideoId
          ? {
              ...video,
              detectedObjects: video.detectedObjects.filter(
                (obj) => !obj.selected,
              ),
            }
          : video,
      ),
    );

    setShowDeleteModal(false);
    toast.success("선택된 객체가 삭제되었습니다.");
  }, [selectedVideoId]);

  // WebVTT 파일 다운로드
  const downloadWebVTT = useCallback(() => {
    if (!selectedVideo) return;

    const vttContent = `WEBVTT

00:00:00.000 --> 00:00:10.000
탐지된 객체: ${selectedVideo.detectedObjects
      .filter((obj) => !obj.selected)
      .map((obj) => obj.name)
      .join(", ")}

00:00:10.000 --> 00:00:20.000
신뢰도 정보 포함`;

    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detected-objects-${selectedVideo.file.name}.vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("WebVTT 파일이 다운로드되었습니다.");
  }, [selectedVideo]);

  // 비디오 삭제
  const deleteVideo = useCallback(
    (videoId: string) => {
      if (selectedVideoId === videoId) {
        closeAdminPanel();
      }

      setVideos((prev) => prev.filter((video) => video.id !== videoId));
      setUploads((prev) => prev.filter((upload) => upload.id !== videoId));
      toast.success("동영상이 삭제되었습니다.");
    },
    [selectedVideoId, closeAdminPanel],
  );

  // 객체 탐지 실행
  const runObjectDetection = useCallback(
    (videoId: string) => {
      if (!videoId || isDetecting) return;

      setIsDetecting(true);
      setDetectionProgress(0);

      const interval = setInterval(() => {
        setDetectionProgress((prev) => {
          const newProgress = prev + Math.random() * 15 + 5;

          if (newProgress >= 100) {
            clearInterval(interval);
            setIsDetecting(false);
            setDetectionProgress(100);
            setHasRunDetection(true);

            // 객체 추가
            setVideos((prev) =>
              prev.map((video) => {
                if (video.id !== videoId) return video;
                if (video.detectedObjects.length > 0) return video;
                return {
                  ...video,
                  detectedObjects: DEFAULT_OBJECTS.map((obj, index) => ({
                    ...obj,
                    id: `${videoId}-obj-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: `Object(${index + 1})`,
                  })),
                  totalObjectsCreated: Math.max(
                    video.totalObjectsCreated,
                    DEFAULT_OBJECTS.length,
                  ),
                };
              }),
            );

            // 탐지 완료 후 selectedVideoId를 다시 설정하여 최신 selectedVideo를 강제로 반영
            setSelectedVideoId(videoId);

            toast.success("객체 탐지가 완료되었습니다!");

            const resetTimeoutId = setTimeout(() => {
              setDetectionProgress(0);
            }, 1000);

            return 100;
          }

          return Math.min(newProgress, 100);
        });
      }, 200);

      // cleanup 함수 반환
      return () => {
        clearInterval(interval);
        setIsDetecting(false);
      };
    },
    [isDetecting],
  );

  // 비디오 플레이어 열기
  const openVideoPlayer = useCallback(() => {
    if (selectedVideo) {
      setShowVideoPlayer(true);
    }
  }, [selectedVideo]);

  // 새 객체 추가
  const addNewObjectToVideo = useCallback(
    (videoId: string, objectName?: string) => {
      const currentVideo = videos.find((v) => v.id === videoId);
      const nextObjectNumber = currentVideo
        ? currentVideo.totalObjectsCreated + 1
        : 1;
      const finalObjectName = objectName || `Object(${nextObjectNumber})`;
      const objectId = `${videoId}-new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newObject: DetectedObject = {
        id: objectId,
        name: finalObjectName,
        confidence: 0.85 + Math.random() * 0.15,
        selected: false,
        code: `CODE_${objectId.slice(0, 8).toUpperCase()}`,
        additionalInfo: "AI가 자동으로 탐지한 객체입니다.",
        dlReservoirDomain: "http://www.naver.com",
        category: "기타",
      };

      setVideos((prev) =>
        prev.map((video) =>
          video.id === videoId
            ? {
                ...video,
                totalObjectsCreated: video.totalObjectsCreated + 1,
                detectedObjects: [...video.detectedObjects, newObject],
              }
            : video,
        ),
      );

      return finalObjectName;
    },
    [videos],
  );

  // 객체 삭제
  const deleteObjectFromVideo = useCallback(
    (videoId: string, objectId: string) => {
      setVideos((prev) =>
        prev.map((video) =>
          video.id === videoId
            ? {
                ...video,
                detectedObjects: video.detectedObjects.filter(
                  (obj) => obj.id !== objectId,
                ),
              }
            : video,
        ),
      );
    },
    [],
  );

  // 객체 정보 업데이트
  const updateObjectInVideo = useCallback(
    (
      videoId: string,
      objectId: string,
      updates: {
        name?: string;
        code?: string;
        additionalInfo?: string;
        dlReservoirDomain?: string;
        category?: string;
      },
    ) => {
      setVideos((prev) =>
        prev.map((video) =>
          video.id === videoId
            ? {
                ...video,
                detectedObjects: video.detectedObjects.map((obj) =>
                  obj.id === objectId ? { ...obj, ...updates } : obj,
                ),
              }
            : video,
        ),
      );
    },
    [],
  );

  // 계산된 값들
  const hasSelectedObjects = selectedVideoObjects.some((obj) => obj.selected);
  const isUploading = uploads.some(
    (upload) => upload.status === "uploading" || upload.status === "processing",
  );
  const completedUploads = uploads.filter(
    (upload) => upload.status === "completed",
  ).length;

  // 외부로 노출할 상태와 함수들
  return {
    // 상태
    videos,
    selectedVideo,
    selectedVideoId,
    uploads,
    isUploading,
    completedUploads,
    showVideoPlayer,
    showDeleteModal,
    detectedObjects: selectedVideoObjects,
    hasSelectedObjects,
    adminPanelVisible,
    isDetecting,
    detectionProgress,
    panelAnimating,
    panelClosing,
    hasRunDetection,

    // 함수
    handleFileSelect,
    handleVideoSelect,
    closeAdminPanel,
    deleteSelectedObjects,
    downloadWebVTT,
    runObjectDetection,
    openVideoPlayer,
    addNewObjectToVideo,
    deleteObjectFromVideo,
    updateObjectInVideo,
    deleteVideo,

    // 모달 제어
    setShowVideoPlayer,
    setShowDeleteModal,
  };
}
