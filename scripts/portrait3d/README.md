# Portrait → 3-D relief (Hello experiment)

How `public/monika-new.webp` and `public/monika-new-depth.png` were made from
`MONIKA NEW IMAGE.jpeg` (4000×6000, 48 MB). Run the steps from a scratch folder.

1. **Cut-out** (macOS 14+, Apple Vision subject segmentation, no download):
   `swiftc -O cutout.swift -o cutout && ./cutout "../MONIKA NEW IMAGE.jpeg" cut-full.png`
2. **De-fringe** the pale sky halo on the edges: `node defringe.mjs` → `cut-clean.png`
3. **Depth** with Depth Anything V2 (base, ONNX, runs locally through transformers.js;
   first run downloads ~385 MB of model files into `./hf-cache`):
   `npm i @huggingface/transformers@3 && node depth.mjs onnx-community/depth-anything-v2-base` → `depth-raw.png`
4. **Web assets**: `node assets.mjs` → resized WebP photo (1052×1800) and a
   figure-normalised depth map (600×1026, background filled from the figure,
   rounded rim) written into `public/`.

The scripts import `sharp` from the website's `node_modules`; paths inside them
are absolute to this machine — adjust before running elsewhere.
