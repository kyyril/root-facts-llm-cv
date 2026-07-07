import { getCameraErrorMessage } from '../utils/common.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = null;
    this.fpsInterval = null;
    this.fps = 30;
    this.cameraFacing = 'environment';
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  _getConstraints(selectedCameraId) {
    if (selectedCameraId && selectedCameraId !== 'default') {
      return {
        video: {
          deviceId: { exact: selectedCameraId },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };
    }

    return {
      video: {
        facingMode: this.cameraFacing,
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    };
  }

  async startCamera(selectedCameraId) {
    try {
      if (this.stream) {
        this.stopCamera();
      }

      const constraints = this._getConstraints(selectedCameraId);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.video) {
        this.video.srcObject = this.stream;
        await new Promise((resolve) => {
          this.video.onloadedmetadata = resolve;
        });
        await this.video.play();
      }

      return true;
    } catch (error) {
      throw new Error(getCameraErrorMessage(error));
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    this.fps = fps;
  }

  getFPSInterval() {
    return 1000 / this.fps;
  }

  isActive() {
    return this.stream !== null && this.stream.active;
  }

  isReady() {
    return (
      this.video !== null &&
      this.video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
      this.video.videoWidth > 0
    );
  }

  captureFrame() {
    if (!this.isReady() || !this.canvas) return null;

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    return this.canvas;
  }
}
