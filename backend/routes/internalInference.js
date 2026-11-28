const express = require('express');
const router = express.Router();
const { inferenceServiceAuth } = require('../middleware/inferenceAuth');
const { getInferenceCameras, ingestDetection } = require('../controllers/inferenceController');
const { claimExplanations, submitExplanation, getTrainingData, reportModelStatus } = require('../controllers/explanationController');

router.use(inferenceServiceAuth);

router.get('/cameras', getInferenceCameras);
router.post('/ingest', ingestDetection);

// Explainer process (LayerCAM heatmaps, false-alarm likelihood)
router.post('/explanations/claim', claimExplanations);
router.get('/explanations/training-data', getTrainingData);
router.post('/explanations/model-status', reportModelStatus);
router.post('/explanations/:alertId', submitExplanation);

module.exports = router;
