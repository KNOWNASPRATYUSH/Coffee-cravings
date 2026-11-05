'use strict';
const { HttpError, route, requireStaff, tableSig, MAX_TABLE } = require('../_lib');

// Owner-only: returns the signed customer link for a table (this is what the printed QR contains).
module.exports = route(['GET'], async (req, res) => {
  await requireStaff(req, ['owner']);
  const t = Number(new URL(req.url, 'http://x').searchParams.get('table'));
  if (!Number.isInteger(t) || t < 1 || t > MAX_TABLE) throw new HttpError(400, 'Invalid table.');
  res.json({ path: `/?table=${t}&sig=${tableSig(t)}#order` });
});
