'use strict';
// Signs/verifies internal server-to-server bodies exchanged with webbb, using
// the same SHARED_SECRET as the play token. The two services are isolated by
// design, so each keeps its own copy of this tiny helper rather than sharing a
// module. Sign the exact bytes you transmit; verify the exact bytes you receive.

const crypto = require('node:crypto');

function sign(rawBody) {
    return crypto.createHmac('sha256', process.env.SHARED_SECRET || '').update(rawBody).digest('hex');
}

function verify(rawBody, sig) {
    if (!sig || !process.env.SHARED_SECRET) return false;
    const expected = sign(rawBody);
    return expected.length === sig.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

module.exports = { sign, verify };
