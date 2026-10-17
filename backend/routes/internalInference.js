const express = require('express');
const router = express.Router();
const { inferenceServiceAuth } = require('../middleware/inferenceAuth');
const { getInferenceCameras, ingestDetection } = require('../controllers/inferenceController');

router.use(inferenceServiceAuth);

router.get('/cameras', getInferenceCameras);
router.post('/ingest', ingestDetection);

module.exports = router;
