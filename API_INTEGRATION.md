# API integration checklist

The frontend calls exactly these four routes:

| Method | Endpoint | Request |
|---|---|---|
| POST | `/api/model1/predict` | `multipart/form-data`, image field named `file` |
| POST | `/api/model2/predict` | JSON clinical/serological fields |
| GET | `/api/health` | no body |
| GET | `/api/model-info` | no body |

Configure the API base URL in `frontend/config.js`.

## Model 1 artifact metadata
The supplied `.pth` checkpoint metadata says:
- model name: `efficientnet_b0`
- number of classes: `4`
- class names: `Normal`, `Mild`, `Moderate`, `Severe`
- image size: `224`
- ImageNet mean: `[0.485, 0.456, 0.406]`
- ImageNet standard deviation: `[0.229, 0.224, 0.225]`

This metadata alone is not a complete inference implementation. Use the exact architecture/library and prediction preprocessing from the training/evaluation code.

## Model 2 feature schema
The `.joblib` artifact is included, but the runtime environment used to inspect it had a scikit-learn compatibility error while unpickling. Use the same scikit-learn version and exact feature columns / categorical encodings used during training. Do not assume the order or names of model features from the visual form alone.
