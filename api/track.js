/**
 * Vercel Serverless Function - Track Event
 * POST /api/track
 */

const { getEventsCollection } = require('./mongodb');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const event = req.body;

        // Validate required fields
        if (!event.event_name) {
            return res.status(400).json({
                success: false,
                error: 'event_name is required'
            });
        }

        // Determine condition from properties or study_type
        const condition = event.properties?.condition || event.study_type || 'unknown';
        
        // Add metadata
        const eventDocument = {
            event_name: event.event_name,
            participant_id: event.participant_id || 'anonymous',
            study_type: event.study_type || 'unknown',
            condition: condition,
            timestamp: new Date(),
            properties: event.properties || {},
            session_id: event.session_id || null,
            user_agent: req.headers['user-agent'] || null,
            page_url: event.page_url || null,
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null
        };

        // Insert into condition-specific collection
        const collection = await getEventsCollection(event.study_type, condition);
        const result = await collection.insertOne(eventDocument);
        
        console.log(`✅ Event tracked: ${event.event_name} → ${collection.collectionName} (ID: ${result.insertedId})`);

        return res.status(200).json({
            success: true,
            event_id: result.insertedId,
            message: 'Event tracked successfully'
        });

    } catch (error) {
        console.error('❌ Error tracking event:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

