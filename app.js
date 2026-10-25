import { LEVELS, WIDTH, HEIGHT, makePath, evaluateDrawing, samplePolyline, distance } from './shapes.js';
import { HandCamera } from './vision.js';

const $ = id => document.getElementById(id);
const stage = $('stage');
const ctx = stage.getContext('2d');
const STORAGE_KEY = 'gesturelab-scores-v1';

function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && typeof value === 'object') return {
      attempts: Number.isFinite(value.attempts) ? Math.max(0, value.attempts) : 0,
      bests: value.bests && typeof value.bests === 'object' ? value.bests : {},
      visited: Array.isArray(value.visited) ? value.visited : [],
    };
  } catch { /* Storage can be disabled; game still works. */ }
  return { attempts: 0, bests: {}, visited: [] };
}
let progress = loadProgress();
function saveProgress() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch {} }

const state = {
  level: 0, mode: 'pointer', drawing: false, points: [], cursor: null,
  lastResult: null, cameraPinched: false, tracking: false,
  highContrast: false, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};
const camera = new HandCamera($('webcam'), $('handCanvas'), onCameraFrame, cameraError);
camera.setSpeed($('smoothing').value);
$('reducedMotion').checked = state.reducedMotion;
document.body.classList.toggle('reduced-motion', state.reducedMotion);

function currentLevel() { return LEVELS[state.level]; }
function currentTarget() { return makePath(currentLevel().id); }
function setAppStatus(message) { $('appStatus').textContent = message; }
function updateInstruction(text) { $('footerInstruction').textContent = text; }
function pointOnCanvas(e) {
  const box = stage.getBoundingClientRect();
  return {
    x: Math.min(WIDTH, Math.max(0, (e.clientX - box.left) / box.width * WIDTH)),
    y: Math.min(HEIGHT, Math.max(0, (e.clientY - box.top) / box.height * HEIGHT)),
  };
}
function messageForScore(score) {
  if (score >= 93) return 'Incredible precision!';
  if (score >= 80) return 'Beautifully done!';
  if (score >= 60) return 'Nice work — keep refining.';
  return 'Every attempt teaches you something.';
}
function changeLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return;
  state.level = index;
  state.points = []; state.drawing = false; state.lastResult = null;
  $('resultOverlay').classList.add('hidden');
  const level = currentLevel();
  $('levelTitle').textContent = level.title;
  $('levelDescription').textContent = level.description;
  $('lessonIndex').textContent = `${String(index + 1).padStart(2,'0')} / ${String(LEVELS.length).padStart(2,'0')}`;
  $('nextBtn').textContent = index === LEVELS.length-1 ? 'Start over ↺' : 'Next level →';
  progress.visited = [...new Set([...progress.visited, level.id])];
  saveProgress(); renderNavigation(); renderScores(); updateMetrics();
  updateInstruction(state.mode === 'camera' ? 'Pinch to draw. Release to score.' : 'Press, trace the guide, then release to score.');
  draw();
}
function nextLevel() { changeLevel((state.level + 1) % LEVELS.length); }
function clearDrawing() {
  state.points = []; state.drawing = false; state.lastResult = null;
  $('resultOverlay').classList.add('hidden');
  updateInstruction(state.mode === 'camera' ? 'Pinch to draw. Release to score.' : 'Press, trace the guide, then release to score.');
  updateMetrics(); draw();
}
function addPoint(p) {
  if (!p || !state.drawing) return;
  const last = state.points.at(-1);
  if (!last || distance(last, p) >= 2.5) {
    state.points.push(p);
    if (state.points.length > 3500) state.points.shift();
    updateMetrics(); draw();
  }
}
function beginDrawing(p) {
  if (!p) return;
  state.drawing = true;
  state.points = [p]; state.lastResult = null;
  $('resultOverlay').classList.add('hidden');
  updateInstruction('Keep following the guide...');
  updateMetrics(); draw();
}
function finishDrawing() {
  if (!state.drawing) return;
  state.drawing = false;
  const result = evaluateDrawing(state.points, currentTarget());
  if (!result.enough) {
    updateInstruction('Try tracing a longer part of the outline.');
    updateMetrics();draw();return;
  }
  state.lastResult = result;
  progress.attempts += 1;
  const level = currentLevel();
  progress.bests[level.id] = Math.max(Number(progress.bests[level.id]) || 0, result.score);
  saveProgress(); renderNavigation(); renderScores(); updateMetrics();
  $('resultScore').innerHTML = `${result.score}<span>%</span>`;
  $('resultMessage').textContent = messageForScore(result.score);
  $('resultDetails').textContent = `${result.precision}% precision  ·  ${result.coverage}% outline covered`;
  $('resultNext').textContent = state.level === LEVELS.length - 1 ? 'Back to circle ↺' : 'Next challenge →';
  $('resultOverlay').classList.remove('hidden');
  updateInstruction('Challenge complete! Retry to improve your score.');
  draw();
}
function updateMetrics() {
  $('strokeMetric').textContent = `${state.points.length} POINTS`;
  if (state.drawing && state.points.length >= 4) {
    const result = evaluateDrawing(state.points, currentTarget());
    $('coverageMetric').textContent = `${result.coverage}% COVERAGE`;
  } else if (state.lastResult) {
    $('coverageMetric').textContent = `${state.lastResult.coverage}% COVERAGE`;
  } else $('coverageMetric').textContent = '0% COVERAGE';
}

function drawPolyline(path, style, width, shadow = 0, dash = []) {
  if (path.length < 2) return;
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  path.slice(1).forEach(p => ctx.lineTo(p.x,p.y));
  ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=width;ctx.strokeStyle=style;
  ctx.setLineDash(dash);ctx.shadowColor=style;ctx.shadowBlur=shadow;ctx.stroke();
  ctx.shadowBlur=0;ctx.setLineDash([]);
}
function draw() {
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  if (stage.width !== Math.round(WIDTH * pixelRatio) || stage.height !== Math.round(HEIGHT * pixelRatio)) {
    stage.width = Math.round(WIDTH * pixelRatio);stage.height = Math.round(HEIGHT * pixelRatio);
  }
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const target = currentTarget();
  const targetColor = state.highContrast ? '#e6fff6' : currentLevel().color;
  ctx.save(); ctx.globalAlpha=.09;
  drawPolyline(target,targetColor,34,46);
  ctx.restore();
  ctx.save();ctx.globalAlpha=.16;drawPolyline(target,targetColor,14,12);ctx.restore();
  drawPolyline(target,targetColor,state.highContrast?5:3.5,state.reducedMotion?0:13,[14,13]);
  // Target start point helps learners close loops.
  const start = target[0];
  ctx.beginPath();ctx.arc(start.x,start.y,9,0,Math.PI*2);ctx.fillStyle='#fffdf2';ctx.fill();
  ctx.beginPath();ctx.arc(start.x,start.y,17,0,Math.PI*2);ctx.strokeStyle=targetColor;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=state.highContrast?'#effff9':'#95b6c9';ctx.font='700 13px DM Sans, sans-serif';ctx.textAlign='center';ctx.fillText('START',start.x,start.y-29);
  if (state.points.length) {
    ctx.save();ctx.globalAlpha=.18;drawPolyline(state.points,'#baffd8',18,25);ctx.restore();
    drawPolyline(state.points,'#c0ffe0',state.highContrast?7:5,state.reducedMotion?0:14);
    const end=state.points.at(-1);ctx.beginPath();ctx.arc(end.x,end.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
  }
  if (state.cursor && state.mode==='camera' && !state.lastResult) {
    const p=state.cursor;
    ctx.beginPath();ctx.arc(p.x,p.y,state.cameraPinched?22:15,0,Math.PI*2);ctx.strokeStyle=state.cameraPinched?'#ffe09d':'#7bedc8';ctx.lineWidth=3;ctx.shadowColor='#7beacc';ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#f2fff9';ctx.fill();
  }
}

function renderNavigation() {
  $('levelList').replaceChildren();
  LEVELS.forEach((level, i) => {
    const button=document.createElement('button');
    button.type='button';button.className='level-item'+(i===state.level?' active':'');
    button.setAttribute('aria-current',i===state.level?'step':'false');
    const shape=document.createElement('span');shape.className='level-shape';shape.textContent=level.emoji;
    const group=document.createElement('span');
    const name=document.createElement('div');name.className='level-name';name.textContent=`${String(i+1).padStart(2,'0')} · ${level.name}`;
    const sub=document.createElement('div');sub.className='level-sub';sub.textContent=level.subtitle;
    group.append(name,sub);button.append(shape,group);
    if (Number.isFinite(progress.bests[level.id])) {
      const score=document.createElement('span');score.className='level-best';score.textContent=`${progress.bests[level.id]}%`;button.append(score);
    }
    button.addEventListener('click',()=>changeLevel(i));$('levelList').append(button);
  });
}
function renderScores() {
  $('progressList').replaceChildren();
  LEVELS.forEach(level=>{
    const score=Number.isFinite(progress.bests[level.id])?progress.bests[level.id]:null;
    const row=document.createElement('div');row.className='progress-row';
    const shape=document.createElement('span');shape.className='progress-shape';shape.textContent=level.emoji;
    const info=document.createElement('div');info.className='progress-info';
    const top=document.createElement('div');top.className='progress-top';
    const name=document.createElement('span');name.textContent=level.name;
    const value=document.createElement('strong');value.textContent=score===null?'—':`${score}%`;
    top.append(name,value);
    const bar=document.createElement('div');bar.className='progress-bar';
    const fill=document.createElement('div');fill.className='progress-fill';fill.style.width=`${score||0}%`;
    bar.append(fill);info.append(top,bar);row.append(shape,info);$('progressList').append(row);
  });
  $('totalAttempts').textContent=String(progress.attempts);
  const all=Object.values(progress.bests).filter(v=>Number.isFinite(v));
  $('bestScore').textContent=all.length?`${Math.max(...all)}%`:'—';
  $('levelsExplored').innerHTML=`${progress.visited.length} <span>/ 4</span>`;
}

async function chooseCamera() {
  if (state.mode==='camera') return;
  $('cameraMode').disabled=true;
  $('cameraPill').textContent='LOADING';$('cameraPill').className='camera-pill loading';
  $('cameraMessage').className='camera-message';$('cameraMessage').textContent='Loading hand model and requesting camera permission...';
  setAppStatus('Starting hand tracking');
  try {
    const started=await camera.start();
    if (!started) throw new Error('Camera startup was interrupted.');
    state.mode='camera';state.cameraPinched=false;state.cursor=null;state.tracking=false;
    clearDrawing();setModeButtons();
    $('previewPlaceholder').classList.add('hidden');
    $('cameraPill').textContent='LIVE';$('cameraPill').className='camera-pill active';
    $('cameraMessage').textContent='Hand not detected yet. Show your hand with good lighting.';
    $('calibrateBtn').disabled=false;$('stopCameraBtn').classList.remove('hidden');
    $('canvasMode').textContent='GESTURE CONTROL ACTIVE';
    $('canvasHint').textContent='PINCH TO TRACE';
    $('liveIndicator').textContent='◉ Waiting for hand';
    updateInstruction('Pinch to draw. Release to score.');
    setAppStatus('Camera connected');
  } catch (error) { cameraError(error); }
  finally { $('cameraMode').disabled=false; }
}
function cameraError(error) {
  state.mode='pointer';state.cursor=null;state.cameraPinched=false;
  camera.stop();setModeButtons();draw();
  $('previewPlaceholder').classList.remove('hidden');$('cameraPill').textContent='OFFLINE';$('cameraPill').className='camera-pill';
  $('cameraMessage').className='camera-message error';
  $('cameraMessage').textContent=`Camera unavailable: ${error?.message||'Unknown error'}. Pointer mode still works.`;
  $('calibrateBtn').disabled=true;$('stopCameraBtn').classList.add('hidden');
  $('canvasMode').textContent='MOUSE / TOUCH MODE';$('canvasHint').textContent='PRESS & DRAG TO TRACE';
  $('liveIndicator').textContent='◉ Ready when you are';
  setAppStatus('Pointer mode ready');
}
function choosePointer() {
  if (state.mode==='camera' && state.drawing) finishDrawing();
  // Also cancels any in-progress asynchronous camera initialization.
  camera.stop();
  state.mode='pointer';state.cursor=null;state.cameraPinched=false;
  $('previewPlaceholder').classList.remove('hidden');$('cameraPill').textContent='OFFLINE';$('cameraPill').className='camera-pill';
  $('cameraMessage').className='camera-message';$('cameraMessage').textContent='Your video stays on your device. The app does not upload video frames.';
  $('calibrateBtn').disabled=true;$('stopCameraBtn').classList.add('hidden');
  $('canvasMode').textContent='MOUSE / TOUCH MODE';$('canvasHint').textContent='PRESS & DRAG TO TRACE';$('liveIndicator').textContent='◉ Ready when you are';
  updateInstruction('Press, trace the guide, then release to score.');
  setAppStatus('Ready to create');setModeButtons();draw();
}
function setModeButtons() {
  const mouse=state.mode==='pointer';
  $('mouseMode').classList.toggle('selected',mouse);$('mouseMode').setAttribute('aria-pressed',String(mouse));
  $('cameraMode').classList.toggle('selected',!mouse);$('cameraMode').setAttribute('aria-pressed',String(!mouse));
}
function onCameraFrame(point, pinch, detected, event) {
  if (state.mode!=='camera') return;
  state.tracking=detected;state.cursor=point?{x:point.x*WIDTH,y:point.y*HEIGHT}:null;
  if (event==='calibrated') {
    $('cameraMessage').className='camera-message success';
    $('cameraMessage').textContent='Pinch calibrated! Release and pinch again to start drawing.';
    $('calibrateBtn').disabled=false;$('calibrateBtn').textContent='◈ Recalibrate pinch';
  }
  if (event==='calibration-failed') {
    $('cameraMessage').className='camera-message error';
    $('cameraMessage').textContent='Calibration did not detect a pinch. Try again with your fingers touching.';
    $('calibrateBtn').disabled=false;$('calibrateBtn').textContent='◈ Try calibration again';
  }
  $('liveIndicator').textContent=detected?(pinch?'◉ Pinching · drawing':'◉ Hand detected · ready'):'◉ Show your hand to begin';
  if (state.cameraPinched && !pinch) finishDrawing();
  if (!state.cameraPinched && pinch && point && !camera.calibration) beginDrawing(state.cursor);
  if (pinch && point && !camera.calibration) addPoint(state.cursor);
  state.cameraPinched=pinch;draw();
}

stage.addEventListener('pointerdown',e=>{
  if(state.mode!=='pointer'||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();stage.setPointerCapture(e.pointerId);beginDrawing(pointOnCanvas(e));
});
stage.addEventListener('pointermove',e=>{if(state.mode!=='pointer'||!state.drawing)return;e.preventDefault();addPoint(pointOnCanvas(e));});
stage.addEventListener('pointerup',e=>{if(state.mode!=='pointer')return;e.preventDefault();addPoint(pointOnCanvas(e));finishDrawing();});
stage.addEventListener('pointercancel',()=>{if(state.mode==='pointer')finishDrawing();});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName))return;
  if(e.key==='Escape' || e.key.toLowerCase()==='r')clearDrawing();
  if(e.key==='ArrowRight')nextLevel();
});
$('clearBtn').addEventListener('click',clearDrawing);
$('nextBtn').addEventListener('click',nextLevel);
$('resultRetry').addEventListener('click',clearDrawing);
$('resultNext').addEventListener('click',nextLevel);
$('cameraMode').addEventListener('click',chooseCamera);
$('mouseMode').addEventListener('click',choosePointer);
$('stopCameraBtn').addEventListener('click',choosePointer);
$('calibrateBtn').addEventListener('click',()=>{
  if(!camera.startCalibration())return;
  $('calibrateBtn').disabled=true;$('calibrateBtn').textContent='Measuring pinch...';
  $('cameraMessage').className='camera-message';$('cameraMessage').textContent='Touch thumb and index fingertip together and hold for 2 seconds.';
});
$('smoothing').addEventListener('input',e=>{
  const i=Number(e.target.value);
  $('smoothValue').textContent=['','Very steady','Steady','Balanced','Responsive','Very fast'][i];
  camera.setSpeed(i);
});
$('contrast').addEventListener('change',e=>{state.highContrast=e.target.checked;document.body.classList.toggle('high-contrast',state.highContrast);draw();});
$('reducedMotion').addEventListener('change',e=>{state.reducedMotion=e.target.checked;document.body.classList.toggle('reduced-motion',state.reducedMotion);draw();});
$('resetProgress').addEventListener('click',()=>{
  if(!window.confirm('Reset all locally saved GestureLab scores?'))return;
  progress={attempts:0,bests:{},visited:[]};saveProgress();changeLevel(state.level);
});
$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());
window.addEventListener('pagehide',()=>camera.stop());

changeLevel(0);
