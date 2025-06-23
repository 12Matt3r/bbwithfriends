import { CONSOLE_COMMANDS_PLAYER, CONSOLE_COMMANDS_AUDIENCE, PLAYER_EFFECT_TYPES } from './Constants.js';

export class ConsoleManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        // Event listeners are now primarily handled by UIManager for the console input
    }

    processCommand(inputText) {
        if (!inputText) return;
        const trimmedInput = inputText.trim();
        const parts = trimmedInput.split(' ');
        const firstToken = parts[0].toLowerCase();

        if (firstToken.startsWith('!')) { // Audience Command
            const commandName = firstToken;
            const args = parts.slice(1);

            // Convert CONSOLE_COMMANDS_AUDIENCE object values to an array for .includes()
            const knownAudienceCommands = Object.values(CONSOLE_COMMANDS_AUDIENCE);

            if (knownAudienceCommands.includes(commandName)) {
                this.gameCore.uiManager.addConsoleLogMessage(`Processing Audience Command: ${trimmedInput}`, 'audience');
                if (this.gameCore.networkManager && typeof this.gameCore.networkManager.sendAudienceCommand === 'function') {
                    this.gameCore.networkManager.sendAudienceCommand(commandName, args);
                } else {
                     this.gameCore.uiManager.addConsoleLogMessage(`Error: NetworkManager not available for audience command.`, 'error');
                }
            } else {
                this.gameCore.uiManager.addConsoleLogMessage(`Unknown audience command: ${commandName}`, 'error');
            }
            return;
        }
        
        const commandName = firstToken;
        const args = parts.slice(1);
        // Convert CONSOLE_COMMANDS_PLAYER object values to an array for .includes()
        const knownPlayerCommands = Object.values(CONSOLE_COMMANDS_PLAYER);
        // Add any test commands not in constants for local testing if needed
        const localTestCommands = ['/test_error', '/test_local'];
        const allKnownCommands = [...knownPlayerCommands, ...localTestCommands];


        if (allKnownCommands.includes(commandName)) {
            if (commandName === '/test_local') { // Keep test commands as strings if not in constants
                this.gameCore.uiManager.addConsoleLogMessage(`Locally processing: ${commandName} with args: ${args.join(', ')}`, 'info');
                this.executeNetworkedCommand(commandName, args, this.gameCore.networkManager ? this.gameCore.networkManager.getPlayerId() : 'local', false);
            } else {
                if (this.gameCore.networkManager && typeof this.gameCore.networkManager.sendConsoleCommand === 'function') {
                    this.gameCore.networkManager.sendConsoleCommand(commandName, args);
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage(`Error: NetworkManager not available. Cannot send command: ${commandName}`, 'error');
                }
            }
        } else {
            this.gameCore.uiManager.addConsoleLogMessage(`Error: Unknown player command "${commandName}"`, 'error');
        }
    }

    executeNetworkedCommand(commandName, args, instigatorIdOrSource, isAudienceCmd = false) {
        const username = (this.gameCore.networkManager && typeof this.gameCore.networkManager.getUsername === 'function' && !isAudienceCmd)
            ? this.gameCore.networkManager.getUsername(instigatorIdOrSource)
            : instigatorIdOrSource;

        if (isAudienceCmd) {
            this.gameCore.uiManager.addConsoleLogMessage(`Audience Command Received: ${commandName} ${args.join(' ')}`, 'audience');
        } else {
            this.gameCore.uiManager.addConsoleLogMessage(`Received command: ${commandName} from ${username}`, 'response');
        }

        const playerCommandsWithCorruption = [
            CONSOLE_COMMANDS_PLAYER.SUMMON_ECHO,
            CONSOLE_COMMANDS_PLAYER.SWAP_POSITIONS,
            CONSOLE_COMMANDS_PLAYER.GLITCH_GRAVITY,
            CONSOLE_COMMANDS_PLAYER.REVEAL_MAP
        ];

        if (playerCommandsWithCorruption.includes(commandName) && !isAudienceCmd) {
            if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                const corruptionAmount = Math.floor(Math.random() * 16) + 5;
                this.gameCore.updateGlobalCorruption(corruptionAmount);
                this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}% due to ${commandName}.`, 'info');
            }
            if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
            if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorIdOrSource, commandName);
        }


        switch (commandName) {
            case CONSOLE_COMMANDS_PLAYER.SUMMON_ECHO:
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.triggerSummonEchoEffect === 'function') {
                    this.gameCore.effectsManager.triggerSummonEchoEffect();
                } else {
                    console.error("effectsManager or triggerSummonEchoEffect not found");
                }
                this.gameCore.uiManager.addConsoleLogMessage("Echoes shimmer around...", "response");
                // Corruption already handled by the generic block above
                break;

            case '/test_local':
                 this.gameCore.uiManager.addConsoleLogMessage(`Executing test_local command with args: ${args.join(', ')} initiated by ${username}`, 'response');
                if (this.gameCore.streamerDataManager && !isAudienceCmd) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} (local test) used by ${username}!`);
                if (this.gameCore.matchStatsManager && !isAudienceCmd) this.gameCore.matchStatsManager.recordCommandUse(instigatorIdOrSource, commandName);
                break;

            case CONSOLE_COMMANDS_PLAYER.SWAP_POSITIONS:
                this.gameCore.uiManager.addConsoleLogMessage("Player positions are shifting...", "response");
                 if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    if (!this.gameCore.networkManager || !this.gameCore.networkManager.getConnectedPeersIds) {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: NetworkManager not available for peer list.", "error");
                        break;
                    }
                    const playerIds = this.gameCore.networkManager.getConnectedPeersIds(true);

                    if (playerIds.length < 2) {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: Not enough players connected.", "error");
                        break;
                    }

                    let p1Index = Math.floor(Math.random() * playerIds.length);
                    let p2Index = Math.floor(Math.random() * playerIds.length);
                    while (p2Index === p1Index) {
                        p2Index = Math.floor(Math.random() * playerIds.length);
                    }
                    const playerA_id = playerIds[p1Index];
                    const playerB_id = playerIds[p2Index];

                    if (this.gameCore.networkManager.sendSwapPlayersCommand) {
                        this.gameCore.networkManager.sendSwapPlayersCommand(playerA_id, playerB_id);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated swap between ${playerA_id} and ${playerB_id}.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: sendSwapPlayersCommand not available on NetworkManager.", "error");
                    }
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to execute swap.", "info");
                }
                break;

            case CONSOLE_COMMANDS_PLAYER.GLITCH_GRAVITY:
                this.gameCore.uiManager.addConsoleLogMessage("Gravity feels... strange.", "response");
                 if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const randomYGravity = (Math.random() > 0.5 ? -1 : 1) * (Math.random() * 10 + 5);
                    const glitchDuration = Math.floor(Math.random() * 11) + 10;

                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendGlitchGravityCommand) {
                        this.gameCore.networkManager.sendGlitchGravityCommand({ y: randomYGravity }, glitchDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated gravity glitch: Y-gravity ${randomYGravity} for ${glitchDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Gravity glitch failed: sendGlitchGravityCommand not available on NetworkManager.", "error");
                    }
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to set new gravity.", "info");
                }
                break;

            case CONSOLE_COMMANDS_PLAYER.REVEAL_MAP:
                this.gameCore.uiManager.addConsoleLogMessage("The veil of ignorance lifts... temporarily.", "response");
                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const revealDuration = 10;
                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendRevealMapCommand) {
                        this.gameCore.networkManager.sendRevealMapCommand(revealDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated map reveal for ${revealDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Map reveal failed: sendRevealMapCommand not available on NetworkManager.", "error");
                    }
                } else {
                     this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to trigger map reveal.", "info");
                }
                break;

            case CONSOLE_COMMANDS_AUDIENCE.BLESS:
                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const targetName = args[0];
                    if (!targetName) {
                        this.gameCore.uiManager.addConsoleLogMessage(`Bless failed: No player name provided. Usage: !bless <playerName>`, 'error');
                        break;
                    }
                    const targetPlayerInfo = this.gameCore.getPlayerByName(targetName);
                    if (targetPlayerInfo) {
                        const duration = 10000;
                        const effectDetails = { type: PLAYER_EFFECT_TYPES.SPEED_BOOST, duration: duration, strength: 0.25 }; // Using SPEED_BOOST
                        if (this.gameCore.networkManager && typeof this.gameCore.networkManager.sendApplyPlayerEffectCommand === 'function') {
                            this.gameCore.networkManager.sendApplyPlayerEffectCommand(targetPlayerInfo.id, effectDetails);
                            this.gameCore.uiManager.addConsoleLogMessage(`Audience blessed ${targetPlayerInfo.username}! They feel faster!`, 'audience');
                            if(this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Audience blessed ${targetPlayerInfo.username}!`);
                        } else {
                             this.gameCore.uiManager.addConsoleLogMessage(`Bless failed: NetworkManager cannot send ApplyPlayerEffectCommand.`, 'error');
                        }
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage(`Bless failed: Player "${targetName}" not found.`, 'error');
                    }
                }
                break;

            default:
                const messageType = isAudienceCmd ? "audience" : "player";
                this.gameCore.uiManager.addConsoleLogMessage(`Unknown ${messageType} command received for execution: ${commandName}`, "error");
                break;
        }
    }
}
