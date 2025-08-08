/**
 * ===================================
 * 🎬 동영상 업로드 및 관리 메��� 훅
 * ===================================
 *
 * 이 파일의 기능:
 * 1. 동영상 파일 업로드 및 진행��황 관리
 * 2. 객체 탐지 시뮬레이션 및 상태 관리
 * 3. 관리자 패널 UI 상태 제어
 * 4. 서버 API 연동 (업로드, 삭제)
 * 5. 로컬 상태 관리 (videos, uploads, selectedVideo 등)
 *
 * 📝 수정 가이드:
 * - API URL ���경: window.location.origin 부분 수정
 * - ��로드 로직 변경: uploadVideoFile 함수 수정
 * - 상태 구조 변경: useState 초기값들 수정
 * - 객체 탐지 로직 변경: runObjectDetection 함수 수정
 */

// React 훅과 토스트 알림 가져오기
import { useState, useCallback } from "react";
import { toast } from "sonner";
// 공통 타입 가져오기 (shared/types.ts에서 정의됨)
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

  /**
   * ===================================
   * 📝 파일명 충돌 체크 및 자동 리네임
   * ===================================
   *
   * 🔧 다른 API 서버 연결 방법:
   * 1. window.location.origin 부분을 실제 API 서버 URL로 변경
   * 2. 예시: const apiUrl = "https://your-api-server.com";
   * 3. CORS 설정이 올바르게 되어있는지 확인
   *
   * 📡 API 엔드포인트:
   * - GET /api/check-filename?filename={파일명}
   * - 응답: { success: boolean, exists: boolean, originalName: string, suggestedName: string }
   *
   * 🎯 사용 목적:
   * - 동일한 파일명의 비디오가 이미 존재하는지 확인
   * - 충돌 시 자동으로 (1), (2) 등의 번호를 붙여 새 이름 생성
   */
  const checkAndRenameFile = useCallback(async (file: File): Promise<File> => {
    console.log(`🔍🔍🔍 파일명 체크 함수 호출됨!!! 원본 파일명: "${file.name}"`);

    try {
      // 🌐 API 서버 URL - 다른 서버 사용 시 여기를 수정하세요
      const apiUrl = window.location.origin; // 현재는 같은 도메인 사용
      const checkUrl = `${apiUrl}/api/check-filename?filename=${encodeURIComponent(file.name)}`;
      console.log(`🌐 API 호출 URL: ${checkUrl}`);

      const response = await fetch(checkUrl);
      console.log(`📡 API 응답 상태: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log(`📄 API 응답 데이터:`, result);

        if (result.exists) {
          // 파일명 충돌 발생 - 새로운 이름으로 변경
          const newFileName = result.suggestedName;
          console.log(`🚨🚨🚨 파일명 충돌 감지: "${file.name}" → "${newFileName}"`);

          // 새로운 File 객체 생성
          const renamedFile = new File([file], newFileName, { type: file.type });
          console.log(`✅ 새로운 File 객체 생성 완료: "${renamedFile.name}"`);

          toast.info(`파일명이 자동으로 변경되었습니다: ${newFileName}`);
          return renamedFile;
        } else {
          console.log(`✅ 파일명 충돌 없음, 원본 파일 사용: "${file.name}"`);
        }
      } else {
        console.log(`❌ API 호출 ��패: ${response.status}`);
      }

      return file; // 충돌 없으면 원본 파일 반환
    } catch (error) {
      console.error('🚨 파일명 체크 오류:', error);
      return file; // 에러 발생 시 원본 파일 사용
    }
  }, []);

  /**
   * 📤 실제 파일 ���로드 API 호출
   *
   * 📝 수정 포인트:
   * - API URL 변경: window.location.origin 수정
   * - ��청 데이터 변경: formData 구성 수정
   * - 응답 처리 변경: response 처리 로직 수정
   * - 에러 처리 개선: catch 블록 수정
   */
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

    // 새 업로드만 유지하고 현재 선택 해제 (기존 비디오는 유지)
    setUploads([newUpload]);
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
                console.log(`🎬 업로드 프로세스 시작 - 원본 파일: "${file.name}"`);

                // 파일명 충돌 체크 및 자동 리네임
                const renamedFile = await checkAndRenameFile(file);
                console.log(`📝 체크 완료 - 최종 파일명: "${renamedFile.name}"`);

                // 실제 파일을 서버에 업로드
                const uploadResult = await uploadVideoFile(renamedFile, uploadId, metadata);

                const newVideo: VideoInfo = {
                  id: uploadId,
                  file: renamedFile, // 리네임된 파일 사용
                  duration: metadata.duration,
                  currentTime: 0,
                  detectedObjects: [],
                  totalObjectsCreated: 0,
                  uploadDate: new Date(),
                  videoFolder: uploadResult?.videoFolder, // 서버에서 받은 실제 폴더명
                  serverFileName: uploadResult?.processedData?.fileName, // 서버에서 받은 실제 파일명
                };

                console.log(`🎬���🎬 생성된 video 객체:`, {
                  id: newVideo.id,
                  fileName: newVideo.file.name,
                  serverFileName: newVideo.serverFileName,
                  videoFolder: newVideo.videoFolder,
                  uploadResult: uploadResult
                });

                setVideos(prev => [...prev, newVideo]);

                // 업로드 완료된 비디오 자동 선택 및 관리자 패널 열기
                setSelectedVideoId(newVideo.id);
                setAdminPanelVisible(true);

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
  }, [extractVideoMetadata, uploadVideoFile, checkAndRenameFile]);

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
        // 선택 해제 - 닫기 애��메이션
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
        // 해당 비디오에 이��� 탐지된 객체가 있으면 hasRunDetection을 true로 설정
        const video = videos.find(v => v.id === videoId);
        const hasDetectedObjects = video && video.detectedObjects.length > 0;
        setHasRunDetection(hasDetectedObjects);

        console.log('DEBUG: adminPanelVisible =', adminPanelVisible);

        // videos 배열에 해당 ID의 비디오가 없다면 uploads에서 찾아서 추가
        if (!video) {
          const upload = uploads.find(u => u.id === videoId && u.status === 'completed');
          console.log('DEBUG: Found upload for missing video:', upload);

          if (upload) {
            const newVideo: VideoInfo = {
              id: upload.id,
              file: upload.file!,
              duration: 0, // 추후 메타데이터에서 얻을 수 있음
              currentTime: 0,
              detectedObjects: [],
              totalObjectsCreated: 0,
              uploadDate: upload.uploadDate || new Date(),
              videoFolder: upload.filename,
              serverFileName: upload.filename,
            };
            console.log('DEBUG: Creating missing video:', newVideo);
            setVideos(prev => [...prev, newVideo]);
          }
        }

        if (!adminPanelVisible) {
          console.log('DEBUG: Opening admin panel...');
          setPanelAnimating(true);
          setAdminPanelVisible(true);
          const timeoutId = setTimeout(() => {
            setPanelAnimating(false);
          }, 300);
          return () => clearTimeout(timeoutId);
        } else {
          console.log('DEBUG: Admin panel already visible');
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

  // 시간�� WebVTT 형식으로 변환하는 함수
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
      vttContent += `${obj.name} (신뢰���: ${(obj.confidence * 100).toFixed(1)}%)\n`;
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

  /**
   * 🗑️ 비디오 삭제 (서버와 로컬 상태 모두)
   *
   * 📝 수정 포인트:
   * - API URL 변경: window.location.origin 수정
   * - 삭제 로직 변경: 서버 API 호출 부분 수정
   * - 에러 처리 개선: try-catch 블록 수정
   */
  const deleteVideo = useCallback(
    async (videoId: string) => {
      if (selectedVideoId === videoId) {
        closeAdminPanel();
      }

      // ���제할 비디오 정보 찾기
      const videoToDelete = videos.find(v => v.id === videoId) || uploads.find(u => u.id === videoId);
      const videoFileName = videoToDelete ?
        ('file' in videoToDelete ? videoToDelete.file.name : videoToDelete.filename) :
        null;

      try {
        // 서버에서 폴더 삭제 요청
        if (videoFileName) {
          const apiUrl = window.location.origin;
          const response = await fetch(`${apiUrl}/api/video`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: videoId,
              videoFileName: videoFileName
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('Server delete response:', result);
            toast.success("동영상과 관련 폴더가 서버에서 삭제되었습니다.");
          } else {
            console.warn('Server delete failed, proceeding with local delete');
            toast.warning("서버 삭제는 실패했지만 로컬에서 제거합니다.");
          }
        }
      } catch (error) {
        console.error('Server delete error:', error);
        toast.warning("서�� 삭제 중 오류가 발생했지만 로컬에서 제���합니다.");
      }

      // 로컬 상태에서 제거
      setVideos((prev) => prev.filter((video) => video.id !== videoId));
      setUploads((prev) => prev.filter((upload) => upload.id !== videoId));
    },
    [selectedVideoId, closeAdminPanel, videos, uploads],
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
                const videoDuration = video.duration || 60; // 기본값 60���
                
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
      videoCurrentTime?: number;
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
        videoCurrentTime: additionalData?.videoCurrentTime || 0,
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
    async (videoId: string, objectId: string) => {
      // 먼저 객체 이름 찾기
      const currentVideo = videos.find(v => v.id === videoId);
      const objectToDelete = currentVideo?.detectedObjects.find(obj => obj.id === objectId);

      if (objectToDelete && currentVideo) {
        // 좌표 파일에서도 삭제
        try {
          const apiUrl = window.location.origin;
          const response = await fetch(`${apiUrl}/api/coordinate/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: currentVideo.file.name,
              objectName: objectToDelete.name
            })
          });

          if (response.ok) {
            console.log('좌표 파일에서 객체 삭제됨');
          }
        } catch (error) {
          console.error('좌표 파일 삭제 오류:', error);
        }
      }

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
    [videos],
  );

  // 객체 정보 업데이트
  const updateObjectInVideo = useCallback(
    async (
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
      // 이름이 변경되는 경우 좌표 파일도 업데이트
      if (updates.name) {
        const currentVideo = videos.find(v => v.id === videoId);
        const objectToUpdate = currentVideo?.detectedObjects.find(obj => obj.id === objectId);

        if (objectToUpdate && currentVideo && objectToUpdate.name !== updates.name) {
          try {
            const apiUrl = window.location.origin;
            const response = await fetch(`${apiUrl}/api/coordinate/update`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videoId: currentVideo.file.name,
                oldName: objectToUpdate.name,
                newName: updates.name
              })
            });

            if (response.ok) {
              console.log('좌표 파일 객체 이름 업데이트됨');
            }
          } catch (error) {
            console.error('좌표 파일 업데이트 오류:', error);
          }
        }
      }

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
    [videos],
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
