const { Router } = require('express');
const { serviceAuth } = require('../middlewares/serviceAuth');
const ctrl = require('../controllers/message.controller');

const router = Router();

router.use(serviceAuth);

router.get('/messages/ad/:adId/count', ctrl.countMessagesForAd);
router.delete('/messages/ad/:adId', ctrl.softDeleteAdMessages);

module.exports = router;
