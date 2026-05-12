const redis = require('../config/redis');
const crypto = require('crypto');

function generateLockToken() {
    return crypto.randomBytes(16).toString('hex');
}

async function acquireLock(lockKey, ttlMs = 30000) {
    const token = generateLockToken();
    const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
}

async function releaseLock(lockKey, token) {
    const script = `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        end
        return 0
    `;
    try {
        await redis.eval(script, 1, lockKey, token);
    } catch (error) {
        console.warn('[LOCK] Unable to release lock:', error.message || error);
    }
}

module.exports = {
    acquireLock,
    releaseLock
};
