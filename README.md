# RA Insight — Frontend starter

A responsive frontend for your rheumatoid arthritis research prototype. It provides:
- **Model 1:** hand/wrist X-ray upload → `POST /api/model1/predict` (`multipart/form-data`, field name `file`)
- **Model 2:** clinical/serological form → `POST /api/model2/predict` (JSON)
- **Service status:** `GET /api/health`
- **Model details:** `GET /api/model-info`

The UI is plain HTML, CSS, and JavaScript; there is no frontend build step.

## Run it

1. Extract the ZIP.
2. Start your existing FastAPI backend so it listens at `http://127.0.0.1:8000`.
3. Open a terminal in the extracted folder and run:

   **Windows**
   ```bat
   start_frontend.bat
   ```

   **macOS / Linux**
   ```bash
   python -m http.server 5500 --directory frontend
   ```

4. Open `http://127.0.0.1:5500`.
5. If your API is at a different address, edit `frontend/config.js` and set `API_BASE_URL`.

> Opening `index.html` directly may work in some browsers, but using the small local web server is recommended.

## API response compatibility

The frontend accepts common response field names, but your backend should return stable JSON. Suggested shapes:

### `POST /api/model1/predict`
```json
{
  "predicted_class": "Moderate",
  "confidence": 0.82,
  "class_probabilities": {
    "Normal": 0.05,
    "Mild": 0.13,
    "Moderate": 0.72,
    "Severe": 0.10
  },
  "uncertainty": 0.18,
  "selective_status": "Accepted",
  "explanation_available": false
}
```

### `POST /api/model2/predict`
```json
{
  "progression_probability": 0.2664,
  "binary_prediction": "Non-Progression",
  "probability_progression": 0.2664,
  "probability_non_progression": 0.7336,
  "shap_summary": [
    {"feature": "RF", "value": 0.12},
    {"feature": "ESR", "value": 0.08}
  ]
}
```

### `GET /api/health`
```json
{
  "status": "ok",
  "model1_loaded": true,
  "model2_loaded": true
}
```

### `GET /api/model-info`
Return any model metadata you want displayed, such as model version, class mapping, limitations, and preprocessing notes.

## Important model integration note

This ZIP is the **frontend** and the two model artifacts are included under `models/` for convenience. The frontend does not load `.pth` or `.joblib` files itself: the backend must load the artifacts and expose the four APIs above. Model loading/preprocessing must match the training code exactly; do not infer it from the filenames alone. The model files were copied as supplied and were not modified.

The clinical JSON field names in the form are a starter contract. If your trained pipeline uses different feature names or a different feature order/schema, update the JSON payload in `frontend/app.js` and your backend together to match the training pipeline.
