'use strict';
const { route } = require('./_lib');
const pay = require('./_pay');
module.exports = route(['GET'], async (req, res) => res.json({ gateway: pay.enabled() }));
