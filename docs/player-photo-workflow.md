# Photos and categories in player trajectories

Season photo uploads now open a preview before saving. MediaPipe detects faces and MODNet performs portrait matting locally in the browser. The portrait can be dragged with the mouse or touch; zoom, horizontal/vertical sliders, keyboard arrows, face selection and an original-background option are available. Model assets and WASM are served from `public/vision`; no photo is sent to an external image-processing service.

The original PNG/JPEG/WebP (up to 8 MB and 30 megapixels) is preserved. The preview canvas and saved PNG are 1200 x 1200, with input pixels retained up to 2400 on the longest side. The server validates and re-encodes the preview without applying the legacy background-color algorithm again. Inputs that already have transparency retain their original framing and are not segmented again. Existing saved photos are not reprocessed automatically; old 300 x 300 uploads remain accepted for compatibility.

Playing category is explicitly entered per season (maximum 40 characters). The profile and PDF use the most recent season's category. Missing categories are not inferred from gender or age. Trajectory labels fall back to age in years at the end of the season, rather than presenting that age as a playing category.

Every row in the expanded trajectory has an admin edit button. Its inline editor saves only that season via a single-season PUT; the server reads the current trajectory before replacing the targeted entry. The updated category appears immediately in the full list and the club summary. Different categories within a club period are shown together. Browser interaction checks used mocked saves so that the real player's categories were not changed.

Category metadata is saved atomically per player in `data/staging/player-season-categories`. It follows the existing local staging storage for photos and participations. A public deployment must migrate these files and photos to persistent storage; the existing photo GET route is disabled in production.

Runtime: `@mediapipe/tasks-vision` with BlazeFace short-range and `onnxruntime-web/wasm` with the Apache-2.0 MODNet model exported by Xenova. Inference is serialized and deduplicated per File to avoid concurrent execution from React development effects. Segmentation may require manual correction or keeping the original background for difficult images. Group photos allow selecting a detected face but segmentation does not promise to isolate one person from overlapping people.

Model sources:
- https://huggingface.co/Xenova/modnet
- https://github.com/ZHKKKe/MODNet
- https://developers.google.com/edge/mediapipe/solutions/vision/face_detector

Validation: browser preview and export using an existing original, desktop/mobile layouts, direct edit/add controls, category persistence/clearing/removal, ESLint. The global TypeScript check has unrelated existing failures in the PDF generator and club map.
