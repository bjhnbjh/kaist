// React 훅과 토스트 알림 가져오기
import { useState, useCallback } from "react";
import { toast } from "sonner";
// 공통 타입 가져오기
import type { DetectedObject, VideoInfo, UploadItem } from "@shared/types";

// 기본 객체 데이터 (목업 데이터 제거 - 그리기 데이터만 사용)
const DEFAULT_OBJECTS: Omit<DetectedObject, "id">[] = [];

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

  // 비디오 메타데이터 추출 함수
  const extractVideoMetadata = useCallback((file: File): Promise<{ duration: number, width?: number, height?: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration || 0,
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        console.warn('비디오 메타데이터 추출 실패');
        resolve({ duration: 0 });
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }, []);

  // 실제 파일 업로�� API
  const uploadVideoFile = useCallback(async (file: File, uploadId: string, metadata: { duration: number, width?: number, height?: number }) => {
    try {
      const apiUrl = window.location.origin;
      const formData = new FormData();
      formData.append('video', file);
      formData.append('duration', metadata.duration.toString());
      if (metadata.width) formData.append('width', metadata.width.toString());
      if (metadata.height) formData.append('height', metadata.height.toString());

      const response = await fetch(`${apiUrl}/api/upload-file`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Video file upload response:', result);
        toast.success('비디오 파일이 서버에 성공적으로 저장되었습니다.');
        return result;
      } else {
        throw new Error('파일 업로드 실패');
      }
    } catch (error) {
      console.error('Video file upload error:', error);
      toast.error('비디오 파일 업로드 중 오류가 발생했습니다.');
      throw error;
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

            // 비디오 메타데이터 추출 및 파일 업로드
            extractVideoMetadata(file).then(async (metadata) => {
              try {
                // 실제 파일을 서버에 업로드
                await uploadVideoFile(file, uploadId, metadata);
                
                const newVideo: VideoInfo = {
                  id: uploadId,
                  file,
                  duration: metadata.duration,
                  currentTime: 0,
                  detectedObjects: [],
                  totalObjectsCreated: 0,
                  uploadDate: new Date(),
                };

                setVideos([newVideo]);
                toast.success(`동영상 업로드 완료! (길이: ${Math.round(metadata.duration)}초)`);
              } catch (error) {
                console.error('Upload process failed:', error);
                // 업로드 실패 시 상태를 에러로 변경
                setUploads((prev) =>
                  prev.map((upload) =>
                    upload.id === uploadId
                      ? { ...upload, status: "error" }
                      : upload,
                  ),
                );
                toast.error('비디오 파일 업로드에 실패했습니다.');
              }
            });
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
  }, [extractVideoMetadata, uploadVideoFile]);

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
    [adminPanelVisible, videos],
  );

  // 관리자 패널 닫기
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

  // 시간을 WebVTT 형식으로 변환하는 함수
  const formatTimeForVTT = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }, []);

  // WebVTT 파일 다운로드
  const downloadWebVTT = useCallback(() => {
    if (!selectedVideo) return;

    const activeObjects = selectedVideo.detectedObjects.filter((obj) => !obj.selected);

    let vttContent = 'WEBVTT\n\n';

    // 각 객체별로 시간 정보와 함께 VTT 항목 생성
    activeObjects.forEach((obj, index) => {
      const startTime = formatTimeForVTT(obj.startTime);
      const endTime = formatTimeForVTT(obj.endTime);

      vttContent += `${index + 1}\n`;
      vttContent += `${startTime} --> ${endTime}\n`;
      vttContent += `${obj.name} (신뢰도: ${(obj.confidence * 100).toFixed(1)}%)\n`;
      if (obj.category) {
        vttContent += `카테고리: ${obj.category}\n`;
      }
      if (obj.additionalInfo) {
        vttContent += `${obj.additionalInfo}\n`;
      }
      vttContent += '\n';
    });

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
  }, [selectedVideo, formatTimeForVTT]);

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

            // 객체 추가 (시간 정보 포함)
            setVideos((prev) =>
              prev.map((video) => {
                if (video.id !== videoId) return video;
                if (video.detectedObjects.length > 0) return video;
                
                // 비디오 duration에 기반한 시간 설정
                const videoDuration = video.duration || 60; // 기본값 60초
                
                return {
                  ...video,
                  detectedObjects: DEFAULT_OBJECTS.map((obj, index) => ({
                    ...obj,
                    id: `${videoId}-obj-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: `Object(${index + 1})`,
                    startTime: Math.random() * (videoDuration * 0.3), // 비디오 앞부분에서 시작
                    endTime: Math.random() * (videoDuration * 0.3) + (videoDuration * 0.7), // 비디오 뒷부분에서 끝
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
    (videoId: string, objectName?: string, additionalData?: {
      code?: string;
      additionalInfo?: string;
      dlReservoirDomain?: string;
      category?: string;
      startTime?: number;
      endTime?: number;
    }) => {
      const currentVideo = videos.find((v) => v.id === videoId);
      const nextObjectNumber = currentVideo
        ? currentVideo.totalObjectsCreated + 1
        : 1;
      const finalObjectName = objectName || `Object(${nextObjectNumber})`;
      const objectId = `${videoId}-new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 비디오 duration 기반 시간 설정
      const videoDuration = currentVideo?.duration || 60;
      const defaultStartTime = Math.random() * (videoDuration * 0.5);
      const defaultEndTime = defaultStartTime + Math.random() * (videoDuration * 0.3) + 5;

      const newObject: DetectedObject = {
        id: objectId,
        name: finalObjectName,
        confidence: 0.85 + Math.random() * 0.15,
        selected: false,
        startTime: additionalData?.startTime ?? defaultStartTime,
        endTime: additionalData?.endTime ?? Math.min(defaultEndTime, videoDuration),
        code: additionalData?.code || `CODE_${objectId.slice(0, 8).toUpperCase()}`,
        additionalInfo: additionalData?.additionalInfo || "AI가 자동으로 탐지한 객체입니다.",
        dlReservoirDomain: additionalData?.dlReservoirDomain || "http://www.naver.com",
        category: additionalData?.category || "기타",
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
        startTime?: number;
        endTime?: number;
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

  // 외��로 노출할 상태와 함수들
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
