const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbPath = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'syncup.db')
    : path.join(__dirname, 'syncup.db');
const db = new Database(dbPath);

function init() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            hostId TEXT NOT NULL,
            name TEXT NOT NULL,
            duration INTEGER NOT NULL,
            createdAt TEXT NOT NULL,
            definedSlots TEXT DEFAULT '[]',
            setupComplete INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS responses (
            eventId TEXT,
            userId TEXT,
            slots TEXT,
            PRIMARY KEY (eventId, userId),
            FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
        );
    `);
}

init();

module.exports = {
    createEvent: (event) => {
        const stmt = db.prepare(`
            INSERT INTO events (id, hostId, name, duration, createdAt, definedSlots, setupComplete)
            VALUES (@id, @hostId, @name, @duration, @createdAt, @definedSlots, @setupComplete)
        `);
        // Ensure arrays are stringified
        const data = {
            ...event,
            definedSlots: JSON.stringify(event.definedSlots || []),
            setupComplete: event.setupComplete ? 1 : 0
        };
        return stmt.run(data);
    },

    getEvent: (id) => {
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
        if (!event) return null;

        // Parse JSON fields
        event.definedSlots = JSON.parse(event.definedSlots);
        event.setupComplete = !!event.setupComplete;

        // Get responses
        const responses = db.prepare('SELECT userId, slots FROM responses WHERE eventId = ?').all(id);
        event.responses = {};
        responses.forEach(r => {
            event.responses[r.userId] = JSON.parse(r.slots);
        });

        return event;
    },

    updateEvent: (id, updates) => {
        // Build dynamic update query
        const fields = [];
        const values = { id };

        if (updates.definedSlots) {
            fields.push('definedSlots = @definedSlots');
            values.definedSlots = JSON.stringify(updates.definedSlots);
        }
        if (updates.setupComplete !== undefined) {
            fields.push('setupComplete = @setupComplete');
            values.setupComplete = updates.setupComplete ? 1 : 0;
        }

        if (fields.length === 0) return true;

        const query = `UPDATE events SET ${fields.join(', ')} WHERE id = @id`;
        return db.prepare(query).run(values);
    },

    deleteEvent: (id) => {
        return db.prepare('DELETE FROM events WHERE id = ?').run(id);
    },

    upsertResponse: (eventId, userId, slots) => {
        const stmt = db.prepare(`
            INSERT INTO responses (eventId, userId, slots)
            VALUES (@eventId, @userId, @slots)
            ON CONFLICT(eventId, userId) DO UPDATE SET slots = @slots
        `);
        return stmt.run({
            eventId,
            userId,
            slots: JSON.stringify(slots)
        });
    }
};
