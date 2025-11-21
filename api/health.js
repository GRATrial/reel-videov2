/**
 * Vercel Serverless Function - Health Check
 * GET /api/health
 */

const { testConnection } = require('./mongodb');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const isConnected = await testConnection();
        return res.status(200).json({
            status: 'ok',
            mongodb: isConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

