// Google MediaPipe Hand Landmarker runs on-device in the browser.
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
        this.tracker = await HandLandmarker.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      }
      if (token !== this.generation) return false;
      this.running = true;
      this.lastTime = -1;
      this.lastInferenceAt = 0;
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
    if (performance.now() - this.lastInferenceAt < 30) return;
    this.lastTime = this.video.currentTime;
    this.lastInferenceAt = performance.now();
    try {
      const result = this.tracker.detectForVideo(this.video, performance.now());
      const points = result.landmarks?.[0];
      if (!points) {
        this.cursor = null;
        this.pinching = false;
        this.pinchRatio = null;
        this.drawPreview(null);
        this.onFrame(null, false, false);
        return;
      }
      const measure = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const palm = Math.max(0.01, measure(points[5], points[17]));
      const ratio = measure(points[4], points[8]) / palm;
      this.pinchRatio = ratio;
      const target = { x: Math.max(0, Math.min(1, 1 - points[8].x)), y: Math.max(0, Math.min(1, points[8].y)) };
      if (!this.cursor) this.cursor = target;
      else this.cursor = { x: this.cursor.x + (target.x - this.cursor.x) * this.speed, y: this.cursor.y + (target.y - this.cursor.y) * this.speed };
      if (this.calibration) {
        if (ratio < 0.55) this.calibration.values.push(ratio);
        const elapsed = performance.now() - this.calibration.startedAt;
        if (elapsed > 1800) {
          const samples = this.calibration.values;
          this.calibration = null;
          if (samples.length >= 8) {
            const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
            this.threshold = Math.min(0.52, Math.max(0.16, avg * 1.5));
            this.onFrame(this.cursor, false, true, 'calibrated');
          } else {
            this.onFrame(this.cursor, false, true, 'calibration-failed');
          }
        }
      }
      if (this.waitForRelease) {
        this.pinching = false;
        if (!this.calibration && ratio > this.threshold + 0.14) this.waitForRelease = false;
      } else {
        this.pinching = this.pinching ? ratio < this.threshold + 0.14 : ratio < this.threshold;
      }
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
