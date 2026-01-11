const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// API Routes

// Create Event
app.post('/api/events', (req, res) => {
    try {
        const { name, duration, hostId } = req.body;
        if (!name || !hostId) return res.status(400).json({ error: 'Missing required fields' });

        const id = Math.random().toString(36).substring(2, 9); // Matches original ID format (e.g. 7 chars)
        const event = {
            id,
            hostId,
            name,
            duration: duration || 60,
            createdAt: new Date().toISOString(),
            definedSlots: [],
            setupComplete: false
        };

        db.createEvent(event);
        res.json(event);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Event
app.get('/api/events/:id', (req, res) => {
    try {
        const event = db.getEvent(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json(event);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update Event (Setup slots, finishing setup)
app.patch('/api/events/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Handle flattened response update from frontend if it exists
        // The frontend sends `responses.uid` but also sends `definedSlots`.
        // We really only care about definedSlots and setupComplete here for the Event object.
        // User responses are handled in a separate endpoint usually, but frontend calls updateEvent with both.
        // We'll separate valid event updates.

        const eventUpdates = {};
        if (updates.definedSlots) eventUpdates.definedSlots = updates.definedSlots;
        if (updates.setupComplete !== undefined) eventUpdates.setupComplete = updates.setupComplete;

        db.updateEvent(id, eventUpdates);

        // Check for response updates embedded in the patch (e.g. host's response)
        // Frontend sends: { "responses.uid": [...] }
        const responseKeys = Object.keys(updates).filter(k => k.startsWith('responses.'));
        responseKeys.forEach(key => {
            const uid = key.split('.')[1];
            const slots = updates[key];
            db.upsertResponse(id, uid, slots);
        });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Submit Response
app.post('/api/events/:id/response', (req, res) => {
    try {
        const { id } = req.params;
        const { userId, slots } = req.body;

        if (!userId || !slots) return res.status(400).json({ error: 'Missing userId or slots' });

        db.upsertResponse(id, userId, slots);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete Event
app.delete('/api/events/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.deleteEvent(id);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
