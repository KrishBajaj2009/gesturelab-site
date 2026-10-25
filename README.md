# GestureLab — Interactive geometry studio

GestureLab is a responsive, privacy-conscious educational game in which players trace geometric shapes using a webcam pinch gesture or a mouse/touchscreen. It is a **static website**: no backend, accounts, payment, or database are required.

## Features

- Four playable challenges: circle, triangle, square, and five-point star
- Live Google MediaPipe tracking of 21 hand landmarks
- Pinch (thumb tip and index tip) to draw; release to score
- Adjustable cursor responsiveness and pinch calibration
- Algorithmic scoring: drawing precision, guide coverage, and excessive-stroke penalty
- Mouse and touch fallback; high-contrast and reduced-motion options
- Personal-best scores and number of attempts saved to this browser only
- Responsive game interface with four selectable level cards, designed for desktop, tablet, and phone
- Arial font across the interface and canvas
- Clean error handling when camera/model access fails

## Files

```
gesturelab-site/
├── index.html      # All page layout and accessible controls
├── styles.css      # Responsive styling
├── app.js          # Interaction and gameplay controller
├── shapes.js       # Pure shape definitions and math scoring
├── vision.js       # MediaPipe webcam tracking + pinch calibration
├── favicon.svg     # App icon
├── package.json    # Optional local test command
├── tests/
│   └── scoring.test.mjs
└── README.md       # This file
```

## Public deployment: GitHub Pages

This repository is set up as a static site, so no build pipeline or backend is needed.

1. Go to **Settings → Pages** in this GitHub repository.
2. Choose **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then click Save.
4. Review the deployment under **Actions → pages-build-deployment**.
5. Open [GestureLab](https://krishbajaj2009.github.io/zip2026/) once GitHub Pages reports a successful deployment.

The published address is `https://krishbajaj2009.github.io/zip2026/`. All HTML, CSS, and JavaScript paths are relative so the site works under the repository path.

To update the site, commit your changes to `main`; GitHub Pages republishes automatically. The browser needs Internet access to retrieve the MediaPipe model and Google Fonts on first use.

## Visual design

The interface combines a compact product-style navigation rail with a playful game hub: illustrated level tiles, a prominent tracing canvas, a score summary, and a right-hand camera/settings panel. Every visible UI font uses **Arial**, including canvas labels. Layout and styling live in `index.html` and `styles.css`; no CSS framework or remote font library is used. The interface is an original design, not a copy of another game's artwork.

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
4. Pointer mode works immediately. Click Camera and accept browser permission to test MediaPipe.

Do not open `index.html` directly via `file://`: ES modules and camera permission may fail. Use localhost or deployed HTTPS.

### Option B: VS Code

Open this folder in VS Code and use a local server such as its Live Server extension. Use `http://localhost:...`.

## Run automated tests

Node.js 18 or newer is recommended. No npm installation is needed:

```bash
node --test tests/scoring.test.mjs
# or
npm test
```

## How to play

1. Choose any shape level using the sidebar.
2. **Pointer mode:** hold the mouse button or touch the screen and trace the entire dashed target outline. Release to get a score.
3. **Camera mode:** enable camera, show one hand, move your index finger to control the cursor, then pinch thumb + index finger to draw. Release to score.
4. **Calibrate:** press Calibrate pinch while camera is active, touch thumb and index fingertip together for 2 seconds, then release. Your threshold adjusts for your hand size/position. Adjust responsiveness as needed.
5. Use Retry or Next level. Results save locally only.

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

- **Camera button doesn't work:** use HTTPS or `localhost`, grant camera permission, and check that the camera isn't being used by another app.
- **Model does not load:** check your Internet connection or a school network's blocks on jsDelivr / Google model storage; Pointer mode works without the model.
- **Tracking is jumpy:** move into brighter lighting, keep one hand in view, and move cursor responsiveness toward Steady.
- **Accidental pinch detection:** use Calibrate pinch and release after calibration before drawing.
- **No score:** trace more of the outline before releasing; very short strokes don't count as an attempt.
- **Phone camera:** iOS Safari or Android Chrome on an HTTPS URL may work; performance depends on the hardware and browser. Pointer/touch mode remains available.

## Demo plan for a Congressional App Challenge entry

1. Show the landing page and explain who the app is for (20 seconds).
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
