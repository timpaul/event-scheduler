const API_BASE = '/api';

export const createEvent = async (eventData) => {
    const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
    });
    if (!res.ok) throw new Error('Failed to create event');
    return res.json();
};

export const getEvent = async (id) => {
    const res = await fetch(`${API_BASE}/events/${id}`);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to load event');
    }
    return res.json();
};

export const updateEvent = async (id, data) => {
    const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update event');
    return res.json();
}

export const submitResponse = async (eventId, userId, slots) => {
    const res = await fetch(`${API_BASE}/events/${eventId}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, slots }),
    });
    if (!res.ok) throw new Error('Failed to submit response');
    return res.json();
}

export const deleteEvent = async (id) => {
    const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete event');
    return res.json();
};
