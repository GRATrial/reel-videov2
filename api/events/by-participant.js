/**
 * Vercel Serverless Function - Get Events by Participant
 * GET /api/events/by-participant?condition=reel_carousel
 */

const { getEventsCollection } = require('../mongodb');

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
        
        if (!condition) {
            return res.status(400).json({
                success: false,
                error: 'condition parameter is required'
            });
        }
        
        const collection = await getEventsCollection(null, condition);
        
        // Group events by participant_id
        const pipeline = [
            {
                $group: {
                    _id: '$participant_id',
                    participant_id: { $first: '$participant_id' },
                    event_count: { $sum: 1 },
                    events: {
                        $push: {
                            event_name: '$event_name',
                            timestamp: '$timestamp',
                            properties: '$properties'
                        }
                    },
                    first_event: { $min: '$timestamp' },
                    last_event: { $max: '$timestamp' }
                }
            },
            {
                $sort: { last_event: -1 }
            }
        ];
        
        const grouped = await collection.aggregate(pipeline).toArray();
        
        // Sort events within each participant by timestamp
        grouped.forEach(group => {
            group.events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        });
        
        return res.status(200).json({
            success: true,
            condition: condition,
            collection: collection.collectionName,
            participant_count: grouped.length,
            participants: grouped
        });
    } catch (error) {
        console.error('❌ Error grouping events by participant:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

