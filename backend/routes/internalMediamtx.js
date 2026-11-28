const express = require('express');
const router = express.Router();
const { mediamtxAuth } = require('../controllers/demoCameraController');

// Called by the MediaMTX stream server (infra/mediamtx/mediamtx.yml) for every publish/read.
router.post('/auth', mediamtxAuth);

module.exports = router;
