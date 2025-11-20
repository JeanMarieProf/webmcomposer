
/**
 * actions.js
 * 
 * This module defines the list of all possible actions in the application
 * and provides a mechanism to log them when they are performed.
 */

// --- Categories ---
export const CATEGORIES = {
    PROJECT: 'Project',
    PLAYLIST: 'Playlist',
    LAYERS: 'Layers',
    AUDIO: 'Audio',
    PLAYBACK: 'Playback',
    EDITING: 'Editing',
    EFFECTS: 'Effects',
    EXPORT: 'Export'
};

// --- Action Names ---
export const ACTIONS = {
    // Project
    APP_OPENED: 'App Opened',
    
    // Playlist
    ADD_CLIP: 'Add Video Clip',
    REMOVE_CLIP: 'Remove Video Clip',
    SELECT_CLIP: 'Select Clip',
    
    // Layers
    ADD_OVERLAY: 'Add Overlay Video',
    MOVE_OVERLAY: 'Move Overlay',
    
    // Audio
    ADD_AUDIO: 'Add Audio Track',
    SET_VOLUME: 'Set Volume',
    
    // Playback
    PLAY: 'Play',
    PAUSE: 'Pause',
    SEEK: 'Seek',
    SCRUB: 'Scrub Timeline',
    
    // Editing
    TRIM_START: 'Trim Start',
    TRIM_END: 'Trim End',
    CROP_ENABLE: 'Enable Crop',
    CROP_DISABLE: 'Disable Crop',
    CROP_RESIZE: 'Resize Crop Area',
    CROP_MOVE: 'Move Crop Area',
    
    // Effects
    APPLY_FILTER: 'Apply Filter',
    
    // Export
    START_RECORDING: 'Start Recording',
    STOP_RECORDING: 'Stop Recording',
    EXPORT_COMPLETE: 'Export Complete'
};

// --- History Storage ---
const actionHistory = [];

/**
 * Logs an action performed in the application.
 * @param {string} category - One of CATEGORIES
 * @param {string} action - One of ACTIONS
 * @param {object} details - Optional metadata about the action
 */
export function logAction(category, action, details = {}) {
    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        category,
        action,
        details
    };
    
    actionHistory.push(entry);
    
    // Visual feedback in console
    console.groupCollapsed(`%c[${category}] %c${action}`, 'color: #3b82f6; font-weight: bold;', 'color: #e2e8f0;');
    console.log('Details:', details);
    console.log('Timestamp:', entry.timestamp);
    console.groupEnd();

    return entry;
}

/**
 * Returns the full list of actions performed since the app started.
 */
export function getActionHistory() {
    return [...actionHistory];
}

/**
 * Returns actions grouped by their category.
 */
export function getActionsByCategory() {
    return actionHistory.reduce((acc, entry) => {
        if (!acc[entry.category]) {
            acc[entry.category] = [];
        }
        acc[entry.category].push(entry);
        return acc;
    }, {});
}
