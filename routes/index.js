const express = require('express');
const router = express.Router();
const path = require('path');
const IPG = require('../IPG')
const orderModel = require('../lib/order.model')
const env = require('../env');



// Test request identifier
router.use(function (req, res, next) {
  req.test = req.app.get('env') === 'development' ? req.query.test === 'tEsT' : false;
  next();
});


/* Diverting unknown routes to Angular router */

router.all("*", function (req, res, next) {
  if (req.originalUrl.includes('IPG')) {
    next();
  } else if
    (req.originalUrl.indexOf('api') === -1) {
    if (!env.isDev)
      console.log('[TRACE] Server 404 request: ' + req.originalUrl);
    const p = path.join(__dirname, '../public', 'index.html').replace(/\/routes\//, '/');
    res.status(200).sendFile(p);
  }
  else
    next();
});


router.get('/IPG/transfer/:order_id', async function (req, res, next) {
  order_id = req.params.order_id
  let result = await IPG.loadpug(order_id)
  res.render('IPG', {
    IdArray: result,
    title: 'IPG'
  });
});

router.get('/IPG/results', async function (req, res) {
  let bankData = {
    tref: req.query.tref,
    invoiceNumber: req.query.iN,
    invoiceDate: req.query.iD
  }
  let verifiedResult;
  try {
    verifiedResult = await new orderModel().readPayResult(bankData);

  } catch (error) {

  }
  res.render('IPGres', {
    verifiedResult: verifiedResult ? verifiedResult.xmlToNodeReadRes : 'somethingWentWrong',
    title: 'IPGres'
  });
});

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {title: 'Express'});
});

module.exports = router;
