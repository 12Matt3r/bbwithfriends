import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from './Player.js';
import { InputManager } from './InputManager.js';
import { Environment } from './Environment.js';
import { FragmentManager } from './FragmentManager.js';
import { ConsoleManager } from './ConsoleManager.js';
import { NetworkManager } from './NetworkManager.js';
import { UIManager } from './UIManager.js';
import { AudioManager } from './AudioManager.js';
import { TreasureMapManager } from './TreasureMapManager.js';
import { GameCore } from './GameCore.js';

// Game core instance for global access
window.gameCore = null;

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.gameCore = new GameCore();
});