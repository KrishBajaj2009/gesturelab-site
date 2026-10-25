# Gesture — Interactive geometry studio

Gesture is a responsive, privacy-conscious educational game in which players trace geometric shapes using a webcam pinch gesture or a mouse/touchscreen. It is a **static website**: no backend, accounts, payment, or database are required.

## Features

- Four original challenges: circle, triangle, square, and five-point star
- Four secret challenges: diamond, hexagon, heart, and infinity (unlocked through scores)
- Live Google MediaPipe tracking of 21 hand landmarks
- GPU-first inference with CPU fallback; adaptive cursor smoothing and frame-confirmed pinch gestures
- Grace period for short detection gaps, with unfinished strokes discarded on longer tracking loss
- Pinch (thumb tip and index tip) to draw; release to score
- Pinch calibration with a simple button beside the camera
- Algorithmic scoring: drawing precision, guide coverage, and excessive-stroke penalty
- Mouse and touch fallback if camera permission is unavailable
- Personal-best scores and number of attempts saved to this browser only
- Original level buttons above a two-column game and camera layout; earned secret buttons appear progressively
- Arial font across the interface and canvas
- Clean error handling when camera/model access fails

## Files

```
zip2026/
├── index.html      # All page layout and accessible controls
├── styles.css      # Responsive styling
├── app.js          # Interaction and gameplay controller
├── shapes.js       # Eight shape definitions and math scoring
├── unlocks.js      # Achievement thresholds for secret levels
├── tracking.js     # Pure gesture smoothing and pinch debounce helpers
├── vision.js       # MediaPipe webcam tracking + calibration and recovery
├── favicon.svg     # App icon
├── package.json    # Optional local test command
├── tests/
│   ├── scoring.test.mjs
│   ├── unlocks.test.mjs
│   └── tracking.test.mjs
└── README.md       # This file
```

## Public deployment: GitHub Pages

This repository is set up as a static site, so no build pipeline or backend is needed.

1. Go to **Settings → Pages** in this GitHub repository.
2. Choose **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then click Save.
4. Review the deployment under **Actions → pages-build-deployment**.
5. Open [Gesture](https://krishbajaj2009.github.io/zip2026/) once GitHub Pages reports a successful deployment.

The published address is `https://krishbajaj2009.github.io/zip2026/`. All HTML, CSS, and JavaScript paths are relative so the site works under the repository path.

To update the site, commit your changes to `main`; GitHub Pages republishes automatically. The browser needs Internet access to retrieve the MediaPipe tracking library and model on first use. Arial is provided by the operating system.

## Visual design

The website is named **Gesture**. Its navy page (`#0C1D41`), darker header (`#061430`), and orange highlights (`#FF914D`) are sampled from the user's ZIP Stocks screenshot. The cards and drawing board also use dark navy, with light text and visible tracing guides. Arial is used throughout.

The site opens straight into the game. Four starting levels sit above a wide drawing canvas on the left and a live camera feed on the right. Up to four additional secret levels appear after scoring milestones. The old sidebar, statistics, promotional banner and settings panel have been removed. The interface uses Arial and no remote font service.

The page attempts to request camera permission when it opens. A browser might block an automatic permission prompt; in that case a clearly labeled **Enable camera** button appears. The game remains playable using a pointer or touchscreen when the camera is unavailable.

## Run it on your computer

### Option A: Python (no npm install)

1. Open a terminal in the `gesturelab-site` directory.
2. Run one of:

```bash
python -m http.server 8000
# On Windows if python is not on PATH:
py -m http.server 8000
```

3. Open [http://localhost:8000](http://localhost:8000).
4. The site requests camera permission automatically. Accept it to use hand tracking; pointer input also works.

Do not open `index.html` directly via `file://`: ES modules and camera permission may fail. Use localhost or deployed HTTPS.

### Option B: VS Code

Open this folder in VS Code and use a local server such as its Live Server extension. Use `http://localhost:...`.

## Run automated tests

Node.js 18 or newer is recommended. No npm installation is needed:

```bash
npm test
```

## How to play

1. Open the site and allow camera access when your browser prompts for it.
2. Select Circle, Triangle, Square or Star from the level row.
3. Show your hand to the camera, move your index finger, and pinch thumb and index finger to start tracing. Release to get a score.
4. If pinch detection is unreliable, use **Calibrate pinch** while touching your thumb and index finger together.
5. Each original level scoring **70% or higher** unlocks another bonus shape, in this order: Diamond, Hexagon, Heart, Infinity. Secrets are invisible until earned. Previously saved best scores count.
6. Use **Reset** or **Next level** to continue. Saved best scores appear next to the level names.
7. If the camera is denied or unavailable, drag on the canvas with a mouse, trackpad or touch to play.

## Scoring math

The target outline is represented as a polyline. The drawn trace is likewise sampled into short segments. The score measures:

- **Precision:** average distance from every traced point to the closest target segment, penalizing drawing off the guide.
- **Coverage:** percentage of target outline sample points that lie within 22 world-space pixels of the user stroke, penalizing incomplete shapes.
- **Overdraw:** excessively long or repeated scribbling incurs a penalty based on stroke length relative to target perimeter.

```
score = round(100 × (0.57 × precision + 0.43 × coverage) × overdrawPenalty)
precision = clamp(1 − meanDistanceToOutline / 52, 0, 1)
coverage = targetSamplesWithin22Px / allTargetSamples
overdrawPenalty = clamp((targetLength × 1.6) / drawingLength, 0, 1)
```

Scores are **game feedback**, not educational or clinical assessment scores. The tolerances are gameplay design choices and can be adjusted in `shapes.js`.

## Technology and license notes

- Native HTML / CSS / JavaScript (ES modules; no build step)
- Canvas 2D API for rendering
- MediaPipe Tasks Vision JS `1.1.1` from jsDelivr, plus hand landmarker model from Google
- MediaPipe is licensed by Google under Apache License 2.0. See the package's license and Google privacy notice for third-party terms.
- Local user scores use browser `localStorage`. No server endpoints or user uploads are implemented in this app.
- The MediaPipe package notes that processing of input frames happens on-device but that performance/usage metrics may be sent to Google. Get appropriate consent if distributing to children or using the product in schools.

Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js

## Troubleshooting

- **Camera does not start:** use HTTPS or `localhost`, grant camera permission, and use **Enable camera** to retry if permission was previously denied.
- **Model does not load:** check your Internet connection or a school network's blocks on jsDelivr / Google model storage; Pointer mode works without the model.
- **Tracking is jumpy:** move into brighter lighting, keep one hand in view, and move cursor responsiveness toward Steady.
- **Accidental pinch detection:** use Calibrate pinch and release after calibration before drawing.
- **No score:** trace more of the outline before releasing; very short strokes don't count as an attempt.
- **Phone camera:** iOS Safari or Android Chrome on an HTTPS URL may work; performance depends on the hardware and browser. Pointer/touch mode remains available.

## Demo plan for a Congressional App Challenge entry

1. Show the level choices and explain who the app is for (20 seconds).
2. Start the webcam, point, pinch, and trace the circle (30–40 seconds).
3. Release; show the precision/coverage score and progress history (20 seconds).
4. Show a harder shape and accessibility calibration (20–30 seconds).
5. Explain that your custom geometry scoring and gesture-state logic build upon the pretrained MediaPipe tracking model (20 seconds).

**Competition disclosure:** Describe which features you wrote, which external libraries/models were used, and any AI-assisted coding honestly, according to the rules. Do not describe Google MediaPipe's pretrained model as one you trained yourself.

## Future expansion

- Add geometry puzzles with grabbing/rotation and two-hand interactions
- Add self-paced classroom lessons and optional voice prompts
- Add coordinate-plane questions or graph transformations
- Run usability tests with students, including users who benefit from alternate input methods

The app has unit-tested mathematical scoring and a browser-tested pointer mode; webcam hardware must be verified on the end user's own camera-equipped device.
