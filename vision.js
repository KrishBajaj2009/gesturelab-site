// Google MediaPipe Hand Landmarker runs on-device in the browser.
import { pinchRatio, nextPinchState, smoothCursor } from './tracking.js';
const MEDIAPIPE_VERSION = '1.1.1';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

export class HandCamera {
  constructor(video, previewCanvas, onFrame, onError) {
    this.video = video;
    this.previewCanvas = previewCanvas;
    this.ctx = previewCanvas.getContext('2d');
    this.onFrame = onFrame;
    this.onError = onError;
    this.running = false;
    this.tracker = null;
    this.stream = null;
    this.cursor = null;
    this.pinching = false;
    this.pinchRatio = null;
    this.threshold = 0.34;
    this.speed = 0.34;
    this.lastTime = -1;
    this.lastInferenceAt = 0;
    this.raf = 0;
    this.calibration = null;
    this.waitForRelease = false;
    this.generation = 0;
    this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
    this.filteredRatio = null;
    this.lastSeenAt = 0;
    this.lastCursorAt = 0;
    this.trackFrames = 0;
    this.lostReported = false;
  }

  setSpeed(level) { this.speed = [0, 0.14, 0.22, 0.34, 0.48, 0.65][Number(level)] || 0.34; }

  async start() {
    const token = ++this.generation;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser needs an HTTPS website and camera permission.');
    }
    try {
      // Ask for permission before loading the hand-tracking model.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (token !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (token !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      if (!this.tracker) {
        const { HandLandmarker, FilesetResolver } = await import(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`
        );
        const wasm = await FilesetResolver.forVisionTasks(WASM_URL);
        const options = delegate => ({
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        try {
          this.tracker = await HandLandmarker.createFromOptions(wasm, options('GPU'));
        } catch (gpuError) {
          // Some computers lack a supported GPU context; CPU remains available.
          this.tracker = await HandLandmarker.createFromOptions(wasm, options('CPU'));
        }
      }
      if (token !== this.generation) return false;
      this.running = true;
      this.lastTime = -1;
      this.lastInferenceAt = 0;
      this.lastSeenAt = 0;
      this.lastCursorAt = 0;
      this.filteredRatio = null;
      this.trackFrames = 0;
      this.lostReported = false;
      this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
      this.loop();
      return true;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop() {
    this.generation++;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.cursor = null;
    this.pinching = false;
    this.pinchRatio = null;
    this.calibration = null;
    this.waitForRelease = false;
    this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
    this.filteredRatio = null;
    this.lastSeenAt = 0;
    this.trackFrames = 0;
    this.lostReported = false;
    this.onFrame(null, false, false);
  }

  startCalibration() {
    if (!this.running) return false;
    this.waitForRelease = true;
    this.calibration = { startedAt: performance.now(), values: [] };
    return true;
  }

  loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastTime) return;

    const now = performance.now();
    if (now - this.lastInferenceAt < 28) return;
    const dt = this.lastCursorAt ? now - this.lastCursorAt : 33;
    this.lastTime = this.video.currentTime;
    this.lastInferenceAt = now;

    try {
      const result = this.tracker.detectForVideo(this.video, now);
      const points = result.landmarks?.[0];

      if (!points) {
        this.trackFrames = 0;
        this.drawPreview(null);
        // A hand can disappear for a frame or two even when the user stays still.
        // Do not end a stroke for a brief tracking hiccup.
        if (this.lastSeenAt && now - this.lastSeenAt >= 220 && !this.lostReported) {
          this.lostReported = true;
          this.cursor = null;
          this.pinching = false;
          this.filteredRatio = null;
          this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
          this.waitForRelease = true;
          this.onFrame(null, false, false, 'tracking-lost');
        }
        return;
      }

      const rawRatio = pinchRatio(points);
      if (rawRatio === null) return;
      this.trackFrames++;
      this.lastSeenAt = now;
      this.lostReported = false;

      const target = {
        x: Math.max(0, Math.min(1, 1 - points[8].x)),
        y: Math.max(0, Math.min(1, points[8].y))
      };
      this.cursor = smoothCursor(this.cursor, target, dt, this.speed);
      this.lastCursorAt = now;

      this.filteredRatio = this.filteredRatio === null
        ? rawRatio
        : 0.55 * this.filteredRatio + 0.45 * rawRatio;
      this.pinchRatio = this.filteredRatio;

      if (this.calibration) {
        if (rawRatio < 0.55) this.calibration.values.push(rawRatio);
        if (now - this.calibration.startedAt >= 1800) {
          const samples = this.calibration.values;
          this.calibration = null;
          if (samples.length >= 8) {
            const average = samples.reduce((sum, v) => sum + v, 0) / samples.length;
            this.threshold = Math.min(0.51, Math.max(0.16, average * 1.5));
            this.onFrame(this.cursor, false, true, 'calibrated');
          } else {
            this.onFrame(this.cursor, false, true, 'calibration-failed');
          }
        }
      }

      if (this.waitForRelease) {
        this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
        // A held pinch should not start an accidental new line after calibration
        // or after the hand was out of view.
        if (!this.calibration && rawRatio > this.threshold + 0.17) {
          this.waitForRelease = false;
        }
      } else if (this.trackFrames >= 3 && !this.calibration) {
        this.pinchState = nextPinchState(this.pinchState, this.filteredRatio, this.threshold);
      } else if (this.calibration) {
        this.pinchState = { active: false, closeFrames: 0, openFrames: 0 };
      }
      // Preserve an existing pinch during the first two frames after a brief
      // hand-tracking dropout; otherwise reconnecting would finish the stroke.

      this.pinching = this.pinchState.active;
      this.drawPreview(points);
      this.onFrame(this.cursor, this.pinching, true);
    } catch (error) {
      console.error('Hand tracking error:', error);
      this.stop();
      this.onError(error);
    }
  };

  drawPreview(points) {
    const ctx = this.ctx, w = this.previewCanvas.width, h = this.previewCanvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!points) return;
    const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    const xy = p => [ (1 - p.x) * w, p.y * h ];
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,157,91,.9)';
    for (const [a,b] of links) { ctx.beginPath(); ctx.moveTo(...xy(points[a])); ctx.lineTo(...xy(points[b])); ctx.stroke(); }
    points.forEach((point, i) => { const [x,y] = xy(point); ctx.beginPath(); ctx.arc(x,y, i === 8 ? 5 : 2.4, 0, Math.PI*2); ctx.fillStyle = i === 8 ? '#ffffff' : '#78ADFF'; ctx.fill(); });
    if (this.pinching) { const [x,y] = xy(points[8]); ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.strokeStyle='#FFAA67';ctx.lineWidth=2;ctx.stroke(); }
  }
}
