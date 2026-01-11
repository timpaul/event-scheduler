import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Calendar, Clock, Copy, Users, Check,
    ChevronLeft, ChevronRight, Share2,
    Loader2, Info, ArrowRight, Trash2
} from 'lucide-react';
import * as api from './api';

// --- UTILITY FUNCTIONS ---
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getWeekDays = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        days.push(d);
    }
    return days;
};

const formatDay = (isoString) => {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
};

const formatTime = (isoString) => {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
};

const formatEventDateSummary = (isoSlots) => {
    if (!isoSlots || isoSlots.length === 0) return "No dates defined yet";
    const dates = [...new Set(isoSlots.map(s => s.split('T')[0]))].sort();
    if (dates.length === 0) return "No dates defined yet";

    const d1 = new Date(dates[0]);

    if (dates.length === 1) {
        return `on ${d1.getDate()} ${d1.toLocaleString('default', { month: 'short' })} ${d1.getFullYear()}`;
    }

    const d2 = new Date(dates[dates.length - 1]);
    const m1 = d1.toLocaleString('default', { month: 'short' });
    const m2 = d2.toLocaleString('default', { month: 'short' });
    const y1 = d1.getFullYear();
    const y2 = d2.getFullYear();

    if (y1 === y2) {
        if (m1 === m2) {
            return `Between ${d1.getDate()} and ${d2.getDate()} ${m1} ${y1}.`;
        }
        return `Between ${d1.getDate()} ${m1} and ${d2.getDate()} ${m2} ${y1}.`;
    }
    return `Between ${d1.getDate()} ${m1} ${y1} and ${d2.getDate()} ${m2} ${y2}.`;
};

const formatEventDateSummaryV2 = (isoSlots, duration) => {
    if (!isoSlots || isoSlots.length === 0) return "No dates defined yet";
    const dates = [...new Set(isoSlots.map(s => s.split('T')[0]))].sort();
    if (dates.length === 0) return "No dates defined yet";

    const d1 = new Date(dates[0]);
    let datePart = '';

    if (dates.length === 1) {
        datePart = `on ${d1.getDate()} ${d1.toLocaleString('default', { month: 'short' })} ${d1.getFullYear()}.`;
    } else {
        const d2 = new Date(dates[dates.length - 1]);
        const m1 = d1.toLocaleString('default', { month: 'short' });
        const m2 = d2.toLocaleString('default', { month: 'short' });
        const y1 = d1.getFullYear();
        const y2 = d2.getFullYear();

        if (y1 === y2) {
            if (m1 === m2) {
                datePart = `between ${d1.getDate()} and ${d2.getDate()} ${m1} ${y1}.`;
            } else {
                datePart = `between ${d1.getDate()} ${m1} and ${d2.getDate()} ${m2} ${y1}.`;
            }
        } else {
            datePart = `between ${d1.getDate()} ${m1} ${y1} and ${d2.getDate()} ${m2} ${y2}.`;
        }
    }

    const durationPart = duration ? `${duration} minute event ` : '';
    const full = `${durationPart}${datePart}`;
    return full.charAt(0).toUpperCase() + full.slice(1);
};

function App() {
    // --- State ---
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('home');
    const [eventId, setEventId] = useState(null);
    const [joinCode, setJoinCode] = useState('');

    // Event Creation State
    const [newEventName, setNewEventName] = useState('');
    const [eventDuration, setEventDuration] = useState(60);

    // Active Event Data
    const [eventData, setEventData] = useState(null);
    const [userSlots, setUserSlots] = useState({});
    const [isCopied, setIsCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Calendar Navigation
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
    const hasInitializedView = useRef(false);
    const scrollContainerRef = useRef(null);

    // --- Auth & Init ---
    const [myEvents, setMyEvents] = useState([]);
    const [deletingEventId, setDeletingEventId] = useState(null);

    useEffect(() => {
        // Simple User ID persistence
        let uid = localStorage.getItem('syncup_uid');
        if (!uid) {
            uid = crypto.randomUUID();
            localStorage.setItem('syncup_uid', uid);
        }
        setUser({ uid });
        setLoading(false);

        // Load and Verify My Events
        try {
            const savedRaw = localStorage.getItem('syncup_events');
            if (savedRaw) {
                const saved = JSON.parse(savedRaw);
                setMyEvents(saved);

                // Verify existence and update metadata
                Promise.all(saved.map(async (evt) => {
                    try {
                        const serverEvt = await api.getEvent(evt.id);
                        if (serverEvt) {
                            return {
                                ...evt,
                                name: serverEvt.name,
                                dateSummary: formatEventDateSummaryV2(serverEvt.definedSlots, serverEvt.duration),
                                responseCount: serverEvt.responses ? Object.keys(serverEvt.responses).length : 0
                            };
                        }
                        return null;
                    } catch (e) {
                        return evt; // Keep on network error
                    }
                })).then(results => {
                    const validEvents = results.filter(e => e !== null);
                    if (validEvents.length !== saved.length) {
                        localStorage.setItem('syncup_events', JSON.stringify(validEvents));
                        setMyEvents(validEvents);
                    }
                });
            }
        } catch (e) {
            console.error("Error loading saved events", e);
        }

        // Check URL for event ID
        const params = new URLSearchParams(window.location.search);
        const urlEventId = params.get('eventId');
        if (urlEventId) {
            setEventId(urlEventId);
            setView('event');
        }
    }, []);

    const saveEventToHistory = (evt) => {
        if (!evt || !evt.id) return;
        try {
            const saved = JSON.parse(localStorage.getItem('syncup_events') || '[]');
            const existingIndex = saved.findIndex(e => e.id === evt.id);
            const entry = {
                id: evt.id,
                name: evt.name,
                lastVisited: new Date().toISOString(),
                dateSummary: formatEventDateSummaryV2(evt.definedSlots, evt.duration),
                isOwner: user && user.uid === evt.hostId,
                responseCount: evt.responses ? Object.keys(evt.responses).length : 0
            };

            let newEvents;
            if (existingIndex >= 0) {
                newEvents = [...saved];
                newEvents[existingIndex] = entry;
            } else {
                newEvents = [entry, ...saved];
            }

            // Limit to history size if needed (e.g. 20)
            localStorage.setItem('syncup_events', JSON.stringify(newEvents.slice(0, 20)));
            setMyEvents(newEvents);
        } catch (e) {
            console.error("Error saving event history", e);
        }
    };

    // Update history when eventData is loaded
    useEffect(() => {
        if (eventData) {
            saveEventToHistory(eventData);
        }
    }, [eventData, user]);

    // --- Smart Initial View Effect ---
    useEffect(() => {
        if (eventData && eventData.definedSlots && eventData.definedSlots.length > 0 && !hasInitializedView.current) {
            hasInitializedView.current = true;

            // 1. Set Week to Earliest Slot
            const sortedSlots = [...eventData.definedSlots].sort();
            const firstSlot = sortedSlots[0];
            const firstDate = new Date(firstSlot);
            setCurrentWeekStart(getStartOfWeek(firstDate));

            // 2. Scroll to Earliest Time
            // Find min time of day across all defined slots
            const timesMinutes = eventData.definedSlots.map(s => {
                const d = new Date(s);
                return d.getHours() * 60 + d.getMinutes();
            });
            const minMinutes = Math.min(...timesMinutes);
            // Convert back to approximate time string for ID lookup, or just find the row close to it?
            // Since rows are 30 min intervals, floor to nearest 30.
            const roundedMin = Math.floor(minMinutes / 30) * 30;
            const h = Math.floor(roundedMin / 60);
            const m = roundedMin % 60;
            const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;

            // Use setTimeout to allow render to update with new week before scrolling
            setTimeout(() => {
                const element = document.getElementById(`time-row-${timeStr}`);
                if (element) {
                    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 100);
        }
    }, [eventData]);

    // --- Data Polling ---
    useEffect(() => {
        if (!eventId || view !== 'event') return;

        const fetchData = async () => {
            try {
                const data = await api.getEvent(eventId);
                if (data) {
                    setEventData(data);
                    if (user && data.responses && data.responses[user.uid]) {
                        const loadedSlots = {};
                        data.responses[user.uid].forEach(slot => loadedSlots[slot] = true);
                        setUserSlots(loadedSlots);
                    }
                } else {
                    setEventData(null); // Event not found
                }
            } catch (err) {
                console.error("Data fetch error", err);
                // Don't show error on every poll, maybe just log it
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, [eventId, user, view]);

    // --- Actions ---
    const handleCreateEvent = async () => {
        if (!newEventName.trim() || !user) return;

        const newEvent = {
            hostId: user.uid,
            name: newEventName,
            duration: eventDuration,
            createdAt: new Date().toISOString(),
            definedSlots: [],
            responses: {},
            setupComplete: false
        };

        try {
            const created = await api.createEvent(newEvent);
            setEventId(created.id);
            setView('event');
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('eventId', created.id);
            window.history.pushState({}, '', url);
        } catch (e) {
            console.error("Error creating event:", e);
            setErrorMsg("Could not create event.");
        }
    };

    const handleJoinEvent = () => {
        if (joinCode.trim()) {
            setEventId(joinCode.trim());
            setView('event');
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('eventId', joinCode.trim());
            window.history.pushState({}, '', url);
        }
    };

    const toggleSlot = async (isoSlot) => {
        if (!eventData || !user) return;

        const isHost = eventData.hostId === user.uid;
        // Determine if we are in setup mode logic
        const isSetupMode = isHost && (eventData.setupComplete === false || (eventData.setupComplete === undefined && (!eventData.definedSlots || eventData.definedSlots.length === 0)));

        // Prevent interaction with past slots
        if (new Date(isoSlot) < new Date()) return;

        // Strict Check: If not setup mode, slot MUST be defined by creator
        if (!isSetupMode) {
            const isDefined = eventData.definedSlots && eventData.definedSlots.includes(isoSlot);
            if (!isDefined) return;
        }

        const newSlots = { ...userSlots };
        if (newSlots[isoSlot]) {
            delete newSlots[isoSlot];
        } else {
            newSlots[isoSlot] = true;
        }
        setUserSlots(newSlots); // Optimistic update

        if (isSetupMode) {
            let updatedDefinedSlots = eventData.definedSlots || [];
            if (updatedDefinedSlots.includes(isoSlot)) {
                updatedDefinedSlots = updatedDefinedSlots.filter(s => s !== isoSlot);
            } else {
                updatedDefinedSlots.push(isoSlot);
            }

            // Optimistic event data update
            setEventData(prev => ({
                ...prev,
                definedSlots: updatedDefinedSlots,
                responses: {
                    ...(prev.responses || {}),
                    [user.uid]: updatedDefinedSlots
                }
            }));

            try {
                // Determine completion status logic? No, just update slots.
                await api.updateEvent(eventId, {
                    definedSlots: updatedDefinedSlots,
                    [`responses.${user.uid}`]: updatedDefinedSlots // Also save as host response
                });
            } catch (e) {
                console.error("Error updating setup slots:", e);
                // Revert on error?
            }
        } else {
            const selectedSlotArray = Object.keys(newSlots);

            // Optimistic update for responses (dots)
            setEventData(prev => ({
                ...prev,
                responses: {
                    ...prev.responses,
                    [user.uid]: selectedSlotArray
                }
            }));

            try {
                await api.submitResponse(eventId, user.uid, selectedSlotArray);
            } catch (e) {
                console.error("Error updating responses:", e);
                // Revert? For now, next poll fixes it or manual revert needed.
            }
        }
    };

    const finishSetup = async () => {
        if (!eventId) return;
        try {
            await api.updateEvent(eventId, { setupComplete: true });
            // Optimistic update
            setEventData(prev => ({ ...prev, setupComplete: true }));
        } catch (e) {
            console.error("Error finishing setup", e);
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}${window.location.pathname}?eventId=${eventId}`;
        navigator.clipboard.writeText(url).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleDeleteEvent = async (e, id, confirmed = false) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirmed) {
            setDeletingEventId(id);
            return;
        }

        try {
            await api.deleteEvent(id);
            // Remove from local storage
            const saved = JSON.parse(localStorage.getItem('syncup_events') || '[]');
            const newEvents = saved.filter(ev => ev.id !== id);
            localStorage.setItem('syncup_events', JSON.stringify(newEvents));
            setMyEvents(newEvents);

            if (eventId === id) {
                setView('home');
                setEventId(null);
                window.history.pushState({}, '', window.location.pathname);
            }
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Failed to delete event");
        }
    };

    // --- Derived State ---
    const gridData = useMemo(() => {
        if (!eventData) return { headers: [], rows: [] };

        const definedSlots = eventData.definedSlots || [];
        const hasDefinedSlots = definedSlots.length > 0;
        const isHost = user && user.uid === eventData.hostId;
        const isSetupMode = isHost && ((eventData.setupComplete === false) || (eventData.setupComplete === undefined && definedSlots.length === 0));

        // Always show the week starting from currentWeekStart
        const relevantDays = getWeekDays(currentWeekStart);

        const todayStr = new Date().toISOString().split('T')[0];
        const headers = relevantDays.map(d => {
            const isoDate = d.toISOString().split('T')[0];
            return {
                label: formatDay(d.toISOString()),
                isoDate,
                isToday: isoDate === todayStr
            };
        });

        const startHour = 8;
        const endHour = 22;
        const times = [];
        for (let h = startHour; h < endHour; h++) {
            for (let m = 0; m < 60; m += 30) {
                times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
            }
        }

        // Calculate global max votes
        let maxVotes = 0;
        if (eventData.responses) {
            const voteCounts = {};
            Object.values(eventData.responses).forEach(slots => {
                slots.forEach(slot => {
                    voteCounts[slot] = (voteCounts[slot] || 0) + 1;
                    if (voteCounts[slot] > maxVotes) {
                        maxVotes = voteCounts[slot];
                    }
                });
            });
        }

        const rows = times.map(timeStr => {
            return {
                timeLabel: formatTime(`2023-01-01T${timeStr}`),
                cells: headers.map(header => {
                    const fullIso = `${header.isoDate}T${timeStr}`;
                    let voteCount = 0;
                    let totalResponders = 0;

                    if (eventData.responses) {
                        const userIds = Object.keys(eventData.responses);
                        totalResponders = userIds.length;
                        userIds.forEach(uid => {
                            if (eventData.responses[uid].includes(fullIso)) {
                                voteCount++;
                            }
                        });
                    }



                    const slotDate = new Date(fullIso);
                    const isPast = slotDate < new Date();

                    let isDefined = false;
                    if (isSetupMode) {
                        isDefined = !isPast;
                    } else {
                        // Strict enforcement: Only defined slots are available
                        isDefined = definedSlots.includes(fullIso) && !isPast;
                    }

                    return {
                        id: fullIso,
                        voteCount,
                        totalResponders,
                        isDefined,
                        isSelected: !!userSlots[fullIso],
                        isPast
                    };
                })
            };
        });

        return { headers, rows, isSetupMode, maxVotes };
    }, [eventData, userSlots, currentWeekStart, user]);

    // --- Views ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 text-emerald-600">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (view === 'home') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                    <div className="bg-emerald-600 p-6 text-center">
                        <Calendar className="w-12 h-12 text-white mx-auto mb-2" />
                        <h1 className="text-3xl font-bold text-white">Schedule an event</h1>
                        <p className="text-emerald-100 mt-1">Based on when people are available</p>
                    </div>
                    <div className="p-8 space-y-8">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-emerald-600" />
                                New event
                            </h2>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="e.g. Project Kickoff"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    value={newEventName}
                                    onChange={(e) => setNewEventName(e.target.value)}
                                />
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    value={eventDuration}
                                    onChange={(e) => setEventDuration(Number(e.target.value))}
                                >
                                    <option value={30}>30 minutes</option>
                                    <option value={60}>60 minutes</option>
                                    <option value={90}>90 minutes</option>
                                    <option value={120}>2 hours</option>
                                </select>
                                <button
                                    onClick={handleCreateEvent}
                                    disabled={!newEventName}
                                    className={`w-full py-2.5 rounded-lg font-medium transition-colors ${newEventName ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-200 text-gray-400'}`}
                                >
                                    Create event
                                </button>
                                {errorMsg && <p className="text-red-500 text-sm mt-2">{errorMsg}</p>}
                            </div>
                        </div>
                        <div className="border-t border-gray-100"></div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-emerald-600" />
                                My events
                            </h2>
                            {myEvents.length > 0 ? (
                                <div className="space-y-3">
                                    {myEvents.map(evt => (
                                        <div
                                            key={evt.id}
                                            className="block p-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group flex items-start justify-between gap-3 relative"
                                        >
                                            <div
                                                className="flex-1 cursor-pointer"
                                                onClick={() => {
                                                    setEventId(evt.id);
                                                    setView('event');
                                                    const url = new URL(window.location);
                                                    url.searchParams.set('eventId', evt.id);
                                                    window.history.pushState({}, '', url);
                                                }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium text-gray-900 group-hover:text-emerald-700">{evt.name || 'Untitled Event'}</div>
                                                    {evt.isOwner && (
                                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-medium border border-emerald-200 uppercase tracking-wide">Owner</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    <p>{evt.dateSummary || `Last visited: ${new Date(evt.lastVisited).toLocaleDateString()}`}</p>
                                                    <p className="mt-1">{evt.responseCount || 0} {(evt.responseCount === 1) ? 'person has' : 'people have'} shared their availability so far.</p>
                                                </div>
                                            </div>

                                            {evt.isOwner && (
                                                deletingEventId === evt.id ? (
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-white rounded-lg p-0.5 z-10">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDeletingEventId(null);
                                                            }}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteEvent(e, evt.id, true)}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => handleDeleteEvent(e, evt.id)}
                                                        className="flex-shrink-0 p-1.5 -mr-1 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Delete Event"
                                                        type="button"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">No recent events found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isSetupMode = (eventData && eventData.hostId === user.uid) && gridData.isSetupMode;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <button
                                    onClick={() => {
                                        setView('home');
                                        setEventId(null);
                                        window.history.pushState({}, '', window.location.pathname);
                                    }}
                                    className="hover:text-emerald-600 hover:underline"
                                >
                                    Event scheduler
                                </button>
                                <span className="text-gray-400 mx-1">&gt;</span>
                                <span>{eventDuration} minute event</span>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">{eventData?.name}</h1>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-6 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border bg-emerald-50 text-emerald-900 border-emerald-200">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                            <div>
                                <h3 className="font-semibold">{isSetupMode ? "Define event times" : "Someone wants to invite you to this event"}</h3>
                                <p className="text-sm opacity-90 mt-1">
                                    {isSetupMode ? "Select all potential time slots for this event, then click the button to share an event link." : "Select the time slots that you are available so they can schedule it."}
                                </p>
                            </div>
                        </div>
                        {isSetupMode ? (
                            <button onClick={copyLink} className="flex-shrink-0 bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2 shadow-sm">
                                {isCopied ? "Link copied!" : "Share event link"} {isCopied ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                            </button>
                        ) : (
                            <button onClick={() => setView('home')} className="flex-shrink-0 bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2 shadow-sm">
                                I'm done <Check className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {/* Navigation & Legend */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))}
                                className="px-3 py-1 text-sm font-medium bg-white border border-gray-300 rounded-full hover:bg-gray-50 mr-2 text-gray-700 shadow-sm transition-colors"
                            >
                                Today
                            </button>
                            <button onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="p-1 hover:bg-gray-100 rounded-full">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                                Week of {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <button onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-1 hover:bg-gray-100 rounded-full">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-emerald-100 border-[2.5px] border-emerald-500"></div>
                                <span>{isSetupMode ? "Time slot" : "You are available"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border border-emerald-500 bg-white"></div>
                                <span>Others are available</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span>Best availability</span>
                            </div>
                        </div>
                    </div>

                    <div ref={scrollContainerRef} className="max-h-[60vh] overflow-y-auto relative shadow-sm border border-gray-300 bg-white rounded-l-xl rounded-r-none">
                        <table className="w-full border-collapse text-left table-fixed">
                            <thead className="bg-gray-50 text-gray-700 sticky top-0 z-20 shadow-sm outline outline-1 outline-gray-300">
                                <tr>
                                    <th className="w-28 p-3 sticky left-0 z-30 bg-gray-50 border-r border-b border-gray-300"></th>
                                    {gridData.headers.map((day) => (
                                        <th key={day.isoDate} className={`w-[100px] p-3 text-center border-r border-b border-gray-300 last:border-r-0 font-normal ${day.isToday ? 'bg-sky-100' : ''}`}>
                                            <div className={`font-semibold ${day.isToday ? 'text-gray-900' : 'text-gray-700'}`}>{day.label.split(',')[0]}</div>
                                            <div className="text-xs text-gray-500">{day.label.split(',')[1]}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-gray-50 pattern-diagonal-lines">
                                {gridData.rows.map((row) => (
                                    <tr key={row.timeLabel} id={`time-row-${row.cells[0].id.split('T')[1]}`} className="h-8">
                                        <td className="w-28 sticky left-0 z-10 bg-white border-r border-b border-gray-300 p-0">
                                            <div className="h-8 flex items-center justify-end p-2 text-xs text-gray-500">
                                                {row.timeLabel}
                                            </div>
                                        </td>
                                        {row.cells.map((cell) => {
                                            if (!cell.isDefined) {
                                                return (
                                                    <td key={cell.id} className="border-r border-b border-gray-300 bg-transparent last:border-r-0 p-0 h-8 cursor-not-allowed">
                                                    </td>
                                                );
                                            }

                                            let bgColorClass = 'bg-white';
                                            if (isSetupMode) {
                                                bgColorClass = cell.isSelected ? 'bg-emerald-100 ring-2 ring-inset ring-emerald-500' : 'bg-white hover:bg-gray-50';
                                            } else {
                                                if (cell.isSelected) {
                                                    bgColorClass = 'bg-emerald-100 ring-2 ring-inset ring-emerald-500';
                                                } else {
                                                    bgColorClass = 'bg-white hover:bg-gray-50';
                                                }
                                            }

                                            // Determine Dot Style
                                            const isMaxVote = gridData.maxVotes > 0 && cell.voteCount === gridData.maxVotes;
                                            const dotClass = isMaxVote
                                                ? 'bg-emerald-500' // Solid
                                                : 'bg-white border border-emerald-500'; // Hollow

                                            return (
                                                <td key={cell.id} onClick={() => toggleSlot(cell.id)} className="border-r border-b border-gray-300 last:border-r-0 p-0 h-8 cursor-pointer relative group">
                                                    <div className={`w-full h-full relative ${bgColorClass}`}>
                                                        {/* Participant Dots */}
                                                        {cell.voteCount > 0 && (
                                                            <div className="absolute top-1 left-1 flex flex-wrap gap-0.5 max-w-[calc(100%-4px)] pointer-events-none">
                                                                {Array.from({ length: cell.voteCount }).map((_, i) => (
                                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table >
                    </div >
                    <div className="mt-8 text-center text-sm text-gray-400"><p>Changes save automatically.</p></div>
                </div >
            </main >
        </div >
    );
}

export default App;
