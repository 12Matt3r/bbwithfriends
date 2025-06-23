// Constants.js

export const MESSAGE_TYPES = Object.freeze({
    // Network messages
    PLAYER_SHOT: 'player_shot',
    FRAGMENT_COLLECTED: 'fragment_collected',
    FRAGMENT_DROPPED: 'fragment_dropped',
    FRAGMENT_DELIVERED: 'fragment_delivered',
    DISTORT_EFFECT: 'distort_effect',
    SIGNAL_JAM: 'signal_jam',
    TREASURE_MAP_PICKED_UP: 'treasure_map_picked_up',
    REMEMBRANCE_TRIGGERED: 'remembrance_triggered',
    LOBBY_PLAYER_UPDATE: 'lobby_player_update',
    LOBBY_CHAT_MESSAGE: 'lobby_chat_message',
    LOBBY_FULL_SYNC_REQUEST: 'lobby_full_sync_request',
    CHAOS_VOTE_UPDATE: 'chaos_vote_update', // Consolidated from chaos_vote_cast
    CHAOS_INFLUENCER_DETERMINED: 'chaos_influencer_determined',
    PLAYER_ELIMINATED: 'player_eliminated',
    CONSOLE_COMMAND: 'console_command',
    AUDIENCE_COMMAND: 'audience_command',
    APPLY_PLAYER_EFFECT: 'apply_player_effect',
    EXECUTE_PLAYER_SWAP: 'execute_player_swap',
    EXECUTE_GRAVITY_GLITCH: 'execute_gravity_glitch',
    EXECUTE_REVEAL_MAP: 'execute_reveal_map',
    NEW_CONFESSIONAL_LOG: 'new_confessional_log',
    OVERHEAT_EFFECT: 'overheat_effect',
    FRAGMENT_PING_ALERT: 'fragment_ping_alert',
    CONNECTED: 'connected', // For player join
    DISCONNECTED: 'disconnected', // For player leave
    CHAOS_EVENT_TRIGGERED: 'chaos_event_triggered', // From GameCore
    // Presence Update Request types
    PRESENCE_DAMAGE: 'damage'
});

export const PLAYER_CLASSES = Object.freeze({
    ASSAULT: 'assault',
    SCOUT: 'scout',
    HEAVY: 'heavy'
});

// Note: Player.js uses 'assault', 'scout', 'heavy' as weaponType directly.
// WEAPON_CONFIG keys also use these.
// If we want distinct WEAPON_TYPES like RIFLE, PISTOL, SHOTGUN,
// then Player.js getWeaponForClass and WEAPON_CONFIG keys need to map playerClass to these WEAPON_TYPES.
// For now, aligning WEAPON_TYPES with existing playerClass strings used as weapon keys.
export const WEAPON_TYPES = Object.freeze({
    ASSAULT: 'assault', // Corresponds to playerClass 'assault' and its weapon
    SCOUT: 'scout',     // Corresponds to playerClass 'scout' and its weapon
    HEAVY: 'heavy'      // Corresponds to playerClass 'heavy' and its weapon
});

export const TEAM_IDS = Object.freeze({
    ALPHA: 'alpha',
    BETA: 'beta',
    NONE: 'none'
});

export const PLAYER_EFFECT_TYPES = Object.freeze({
    BLESSED: 'blessed', // Example from plan
    SPEED_BOOST: 'speed_boost', // From !bless command
    // CURSED: 'cursed' // Example from plan
    // Add other effect types if any (e.g., 'stunned', 'empowered')
});

export const CONSOLE_COMMANDS_PLAYER = Object.freeze({
    SUMMON_ECHO: '/summon_echo',
    SWAP_POSITIONS: '/swap_positions',
    GLITCH_GRAVITY: '/glitch_gravity',
    REVEAL_MAP: '/reveal_map'
    // Add other player commands
});

export const CONSOLE_COMMANDS_AUDIENCE = Object.freeze({
    BLESS: '!bless',
    CURSE: '!curse',
    SPAWN_ITEM: '!spawn_item'
});

export const GAME_PHASES = Object.freeze({
    LOADING: 'loading',
    MAIN_MENU: 'main_menu',
    LOBBY: 'lobby',
    INGAME: 'ingame',
    GAME_OVER: 'game_over',
    SUMMARY: 'summary',
    // MELT_PHASE: 'melt_phase' // This is more of a sub-state of INGAME
});

// Material types for impact effects (example)
export const MATERIAL_TYPES = Object.freeze({
    GENERIC: 'generic',
    METAL: 'metal',
    CONCRETE: 'concrete',
    // ... add other relevant material names based on your game environment
});

// Audio sound keys (example)
export const SOUND_KEYS = Object.freeze({
    PLAYER_HIT: 'player_hit',
    RELOAD_RIFLE: 'reload_rifle',
    RELOAD_PISTOL: 'reload_pistol',
    RELOAD_SHOTGUN: 'reload_shotgun',
    SUMMON_ECHO: 'summon_echo_sound', // Added based on EffectsManager
    SWAP_EFFECT: 'swap_effect_sound', // Added
    GRAVITY_GLITCH_START: 'gravity_glitch_start_sound', // Added
    MUTATION_LEVEL_1_START: 'mutation_level_1_start',
    MUTATION_LEVEL_2_START: 'mutation_level_2_start',
    LOCAL_HALLUCINATION_WHISPER: 'local_hallucination_whisper',
    MUTATION_END: 'mutation_end',
    COLLECT_FRAGMENT: 'collect_fragment_sound', // Example for fragment collection
    RANDOM_EXPLOSION: 'random_explosion_sound', // Example for overheat
    HALLUCINATION_SPAWN: 'hallucination_spawn_sound', // Example for overheat
    FRAGMENT_PING: 'fragment_ping_sound', // Example
    REVEAL_MAP_START: 'reveal_map_start_sound',
    REVEAL_MAP_END: 'reveal_map_end_sound',
    SHOOT: 'shoot', // Generic shoot sound
    SILENCED_SHOT: 'silenced_shot', // Generic silenced shot sound
    RELOAD_DEFAULT: 'reload_default', // Default reload sound
    // ... add more sound keys
});
