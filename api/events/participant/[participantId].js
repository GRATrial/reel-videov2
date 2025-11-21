/**
 * Vercel Serverless Function - Get Specific Participant Events
 * GET /api/events/participant/:participant_id?condition=reel_carousel
 */

const { getEventsCollection, COLLECTION_MAP } = require('../../mongodb');

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
        // Get participantId from URL path parameter (Vercel uses query for dynamic routes)
        const participantId = req.query.participantId || req.query.participant_id || null;
        const condition = req.query.condition || null;
        const limit = parseInt(req.query.limit) || 100;
        
        if (!participantId) {
            return res.status(400).json({
                success: false,
                error: 'participant_id is required. Use /api/events/participant/PARTICIPANT_ID'
            });
        }
        
        const filter = { participant_id: participantId };
        
        if (condition) {
            // Get from specific collection
            const collection = await getEventsCollection(null, condition);
            const events = await collection
                .find(filter)
                .sort({ timestamp: 1 }) // Chronological order
                .limit(limit)
                .toArray();
            
            return res.status(200).json({
                success: true,
                participant_id: participantId,
                condition: condition,
                collection: collection.collectionName,
                count: events.length,
                events: events
            });
        }
        
        // Get from all collections
        const allEvents = [];
        
        for (const [cond, collectionName] of Object.entries(COLLECTION_MAP)) {
            const collection = await getEventsCollection(null, cond);
            const events = await collection
                .find(filter)
                .sort({ timestamp: 1 })
                .limit(limit)
                .toArray();
            
            events.forEach(event => {
                event._collection = collectionName;
                allEvents.push(event);
            });
        }
        
        // Sort all events chronologically
        allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return res.status(200).json({
            success: true,
            participant_id: participantId,
            count: allEvents.length,
            events: allEvents
        });
    } catch (error) {
        console.error('❌ Error fetching participant events:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

