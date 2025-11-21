/**
 * Vercel Serverless Function - Get Events
 * GET /api/events?condition=reel_carousel&participant_id=xxx&limit=10
 */

const { getEventsCollection, COLLECTION_MAP } = require('./mongodb');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const condition = req.query.condition || null;
        const participantId = req.query.participant_id || null;
        const limit = parseInt(req.query.limit) || 10;
        
        // Build query filter
        const filter = {};
        if (participantId) {
            filter.participant_id = participantId;
        }
        
        // If condition specified, get from that collection
        if (condition) {
            const collection = await getEventsCollection(null, condition);
            const events = await collection
                .find(filter)
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            
            return res.status(200).json({
                success: true,
                condition: condition,
                collection: collection.collectionName,
                participant_id: participantId || 'all',
                count: events.length,
                events: events
            });
        }
        
        // Otherwise, get from all collections
        const allEvents = [];
        
        for (const [cond, collectionName] of Object.entries(COLLECTION_MAP)) {
            const collection = await getEventsCollection(null, cond);
            const events = await collection
                .find(filter)
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
            
            events.forEach(event => {
                event._collection = collectionName;
                allEvents.push(event);
            });
        }
        
        // Sort all events by timestamp and limit
        allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const limitedEvents = allEvents.slice(0, limit);
        
        return res.status(200).json({
            success: true,
            participant_id: participantId || 'all',
            count: limitedEvents.length,
            events: limitedEvents
        });
    } catch (error) {
        console.error('❌ Error fetching events:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

