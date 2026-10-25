import { LEVELS, WIDTH, HEIGHT, makePath, evaluateDrawing, distance } from './shapes.js';
import { HandCamera } from './vision.js';

const get = id => document.getElementById(id);
const stage = get('stage');
const ctx = stage.getContext('2d');
const STORAGE_KEY = 'gesturelab-scores-v1';

function readScores() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      return {
        attempts: Number(saved.attempts) || 0,
        bests: saved.bests || {},
        visited: saved.visited || []
      };
    }
  } catch {
    // Browsers with storage disabled can still run the game.
  }
  return { attempts: 0, bests: {}, visited: [] };
}

const scores = readScores();
function saveScores() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); } catch {}
}

const state = {
  level: 0,
  cameraOn: false,
  loadingCamera: false,
  pointing: false,
  pinching: false,
  drawing: false,
  points: [],
  cursor: null,
  result: null
};

const camera = new HandCamera(get('webcam'), get('handCanvas'), handleCameraFrame, handleCameraError);
camera.setSpeed(3);

const level = () => LEVELS[state.level];
const target = () => makePath(level().id);
const setStatus = text => { get('appStatus').textContent = text; };

function drawLine(points, color, width, dash = []) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (stage.width !== Math.round(WIDTH * ratio) || stage.height !== Math.round(HEIGHT * ratio)) {
    stage.width = Math.round(WIDTH * ratio);
    stage.height = Math.round(HEIGHT * ratio);
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(231,239,255,.055)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
  }

  const path = target();
  ctx.save();
  ctx.globalAlpha = .18;
  drawLine(path, level().color, 20);
  ctx.restore();
  drawLine(path, level().color, 4, [12, 11]);

  const start = path[0];
  ctx.beginPath();
  ctx.arc(start.x, start.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(start.x, start.y, 17, 0, Math.PI * 2);
  ctx.strokeStyle = level().color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#d0def7';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START', start.x, start.y - 29);

  if (state.points.length) {
    drawLine(state.points, '#e1edff', 5);
    const last = state.points.at(-1);
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  if (state.cursor && state.cameraOn && !state.pointing && !state.result) {
    ctx.beginPath();
    ctx.arc(state.cursor.x, state.cursor.y, state.pinching ? 20 : 14, 0, Math.PI * 2);
    ctx.strokeStyle = state.pinching ? '#ffcb8a' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(state.cursor.x, state.cursor.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

function renderLevels() {
  const list = get('levelList');
  list.replaceChildren();
  LEVELS.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-item' + (index === state.level ? ' active' : '');
    button.setAttribute('aria-pressed', String(index === state.level));

    const shape = document.createElement('span');
    shape.className = 'level-shape';
    shape.textContent = item.emoji;

    const text = document.createElement('span');
    const name = document.createElement('div');
    name.className = 'level-name';
    name.textContent = item.name;
    const subtitle = document.createElement('div');
    subtitle.className = 'level-sub';
    subtitle.textContent = item.subtitle;
    text.append(name, subtitle);
    button.append(shape, text);

    const best = Number(scores.bests[item.id]);
    if (Number.isFinite(best) && best > 0) {
      const label = document.createElement('span');
      label.className = 'level-best';
      label.textContent = best + '%';
      button.append(label);
    }

    button.addEventListener('click', () => changeLevel(index));
    list.append(button);
  });
}

function clearDrawing() {
  state.points = [];
  state.drawing = false;
  state.result = null;
  get('resultOverlay').classList.add('hidden');
  get('coverageMetric').textContent = '0% COVERAGE';
  draw();
}

function changeLevel(index) {
  state.level = index;
  clearDrawing();
  get('lessonIndex').textContent = `${String(index + 1).padStart(2, '0')} / 04`;
  get('levelTitle').textContent = level().title;
  get('levelDescription').textContent = level().description;
  get('nextBtn').textContent = index === LEVELS.length - 1 ? 'First level ↻' : 'Next level →';
  scores.visited = [...new Set([...scores.visited, level().id])];
  saveScores();
  renderLevels();
  get('footerInstruction').textContent = state.cameraOn
    ? 'Pinch to draw. Release your fingers to score.'
    : 'You can draw using your mouse or trackpad.';
  draw();
}

function nextLevel() {
  changeLevel((state.level + 1) % LEVELS.length);
}

function addPoint(point) {
  if (!state.drawing || !point) return;
  const last = state.points.at(-1);
  if (!last || distance(last, point) >= 2.5) {
    state.points.push(point);
    if (state.points.length > 3500) state.points.shift();
    if (state.points.length > 3) {
      const progress = evaluateDrawing(state.points, target());
      get('coverageMetric').textContent = progress.coverage + '% COVERAGE';
    }
    draw();
  }
}

function beginDrawing(point) {
  if (!point) return;
  clearDrawing();
  state.drawing = true;
  state.points = [point];
  draw();
}

function endDrawing() {
  if (!state.drawing) return;
  state.drawing = false;
  const result = evaluateDrawing(state.points, target());

  if (!result.enough) {
    get('footerInstruction').textContent = 'Trace a longer part of the outline to get a score.';
    draw();
    return;
  }

  state.result = result;
  scores.attempts++;
  scores.bests[level().id] = Math.max(scores.bests[level().id] || 0, result.score);
  saveScores();
  renderLevels();
  get('resultScore').innerHTML = result.score + '<span>%</span>';
  get('resultMessage').textContent = result.score >= 90
    ? 'Great tracing!'
    : result.score >= 65 ? 'Nice work!' : 'Give it another try.';
  get('resultDetails').textContent = result.precision + '% precision · ' + result.coverage + '% coverage';
  get('resultNext').textContent = state.level === LEVELS.length - 1 ? 'First level ↻' : 'Next level →';
  get('resultOverlay').classList.remove('hidden');
  get('footerInstruction').textContent = 'Try again to beat your score.';
  draw();
}

function canvasPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(WIDTH, (event.clientX - rect.left) / rect.width * WIDTH)),
    y: Math.max(0, Math.min(HEIGHT, (event.clientY - rect.top) / rect.height * HEIGHT))
  };
}

stage.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  state.pointing = true;
  stage.setPointerCapture(event.pointerId);
  beginDrawing(canvasPoint(event));
});
stage.addEventListener('pointermove', event => {
  if (!state.pointing) return;
  event.preventDefault();
  addPoint(canvasPoint(event));
});
stage.addEventListener('pointerup', event => {
  if (!state.pointing) return;
  event.preventDefault();
  addPoint(canvasPoint(event));
  state.pointing = false;
  endDrawing();
});
stage.addEventListener('pointercancel', () => {
  if (state.pointing) { state.pointing = false; endDrawing(); }
});

function handleCameraFrame(point, pinch, detected, event) {
  if (!state.cameraOn) return;

  state.cursor = point ? { x: point.x * WIDTH, y: point.y * HEIGHT } : null;
  get('cameraMessage').classList.remove('error');
  if (event === 'calibrated') {
    get('cameraMessage').textContent = 'Pinch calibrated. Release, then pinch again to draw.';
    get('calibrateBtn').disabled = false;
  } else if (event === 'calibration-failed') {
    get('cameraMessage').textContent = 'Calibration did not detect a pinch. Try again.';
    get('calibrateBtn').disabled = false;
  } else {
    get('cameraMessage').textContent = detected
      ? (pinch ? 'Pinch detected — drawing.' : 'Hand detected. Pinch to draw.')
      : 'Show one hand to the camera.';
  }

  if (state.pointing) { state.pinching = pinch; draw(); return; }

  if (state.pinching && !pinch) endDrawing();
  if (!state.pinching && pinch && point && !camera.calibration) beginDrawing(state.cursor);
  if (pinch && point && !camera.calibration) addPoint(state.cursor);
  state.pinching = pinch;
  draw();
}

function handleCameraError(error) {
  state.cameraOn = false;
  state.loadingCamera = false;
  state.pinching = false;
  state.cursor = null;
  camera.stop();
  get('cameraPill').textContent = 'OFF';
  get('cameraPill').className = 'camera-status';
  get('previewPlaceholder').classList.remove('hidden');
  get('cameraRetry').classList.remove('hidden');
  get('calibrateBtn').disabled = true;
  get('cameraMessage').className = 'camera-message error';
  get('cameraMessage').textContent = error?.name === 'NotAllowedError'
    ? 'Camera access was denied. Allow it in your browser settings, then select Enable camera.'
    : 'Could not start camera. ' + (error?.message || 'Try enabling it again.');
  get('canvasMode').textContent = 'MOUSE / TRACKPAD READY';
  get('canvasHint').textContent = 'Press and drag to trace';
  setStatus('Camera unavailable');
  get('footerInstruction').textContent = 'You can still play with a mouse or trackpad.';
  draw();
}

async function enableCamera() {
  if (state.cameraOn || state.loadingCamera) return;
  state.loadingCamera = true;
  get('cameraRetry').classList.add('hidden');
  get('cameraPill').className = 'camera-status loading';
  get('cameraPill').textContent = 'STARTING';
  get('cameraMessage').className = 'camera-message';
  get('cameraMessage').textContent = 'Allow camera access when your browser asks.';
  setStatus('Connecting to camera…');

  try {
    const started = await camera.start();
    if (!started) throw new Error('Camera startup was interrupted.');

    state.cameraOn = true;
    state.pinching = false;
    state.cursor = null;
    get('cameraPill').textContent = 'LIVE';
    get('cameraPill').className = 'camera-status active';
    get('previewPlaceholder').classList.add('hidden');
    get('cameraMessage').textContent = 'Show one hand to the camera.';
    get('calibrateBtn').disabled = false;
    get('canvasMode').textContent = 'HAND TRACKING ACTIVE';
    get('canvasHint').textContent = 'Pinch to draw · Release to score';
    get('footerInstruction').textContent = 'Pinch your thumb and index finger to begin drawing.';
    setStatus('Camera connected');
    draw();
  } catch (error) {
    handleCameraError(error);
  } finally {
    state.loadingCamera = false;
  }
}

get('cameraRetry').addEventListener('click', enableCamera);
get('calibrateBtn').addEventListener('click', () => {
  if (!camera.startCalibration()) return;
  get('calibrateBtn').disabled = true;
  get('cameraMessage').textContent = 'Hold a comfortable pinch for two seconds.';
});
get('clearBtn').addEventListener('click', clearDrawing);
get('nextBtn').addEventListener('click', nextLevel);
get('resultRetry').addEventListener('click', clearDrawing);
get('resultNext').addEventListener('click', nextLevel);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') clearDrawing();
  if (event.key === 'ArrowRight' && !event.repeat) nextLevel();
});
window.addEventListener('pagehide', () => camera.stop());

changeLevel(0);
enableCamera();
