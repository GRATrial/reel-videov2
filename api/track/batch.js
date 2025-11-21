/**
 * Vercel Serverless Function - Batch Track Events
 * POST /api/track/batch
 */

const { getEventsCollection } = require('../mongodb');

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
        const events = req.body.events || [];

        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'events array is required'
            });
        }

        // Group events by condition for batch insertion
        const eventsByCondition = {};
        
        events.forEach(event => {
            const condition = event.properties?.condition || event.study_type || 'unknown';
            if (!eventsByCondition[condition]) {
                eventsByCondition[condition] = [];
            }
            
            eventsByCondition[condition].push({
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
            });
        });

        // Insert into condition-specific collections
        let totalInserted = 0;
        for (const [condition, documents] of Object.entries(eventsByCondition)) {
            const collection = await getEventsCollection(null, condition);
            const result = await collection.insertMany(documents);
            totalInserted += result.insertedCount;
            console.log(`✅ Batch tracked: ${result.insertedCount} events → ${collection.collectionName}`);
        }

        return res.status(200).json({
            success: true,
            inserted_count: totalInserted,
            message: 'Events tracked successfully'
        });

    } catch (error) {
        console.error('❌ Error batch tracking events:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

