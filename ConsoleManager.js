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
            // For audience commands, we might have a different set of known commands or validation logic
            const knownAudienceCommands = ['!bless', '!curse', '!spawn_item']; // Example

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
            return; // Audience command processed or is unknown
        }
        
        // Regular Player Command logic
        const commandName = firstToken; // Already toLowerCase
        const args = parts.slice(1);
        const knownPlayerCommands = [
            '/summon_echo',
            '/swap_positions',
            '/glitch_gravity',
            '/reveal_map',
            '/test_error', // Example test command
            '/test_local'  // Example test command
        ];

        if (knownPlayerCommands.includes(commandName)) {
            if (commandName === '/test_local') {
                this.gameCore.uiManager.addConsoleLogMessage(`Locally processing: ${commandName} with args: ${args.join(', ')}`, 'info');
                this.executeNetworkedCommand(commandName, args, this.gameCore.networkManager ? this.gameCore.networkManager.getPlayerId() : 'local', false);
            } else {
                if (this.gameCore.networkManager && typeof this.gameCore.networkManager.sendConsoleCommand === 'function') {
                    // Player commands are logged as "Executing" by the local UIManager when typed,
                    // and then "Received command" by executeNetworkedCommand on all clients.
                    // So, just send it. The initial log of what was typed is already done by UIManager.
                    // this.gameCore.uiManager.addConsoleLogMessage(`Executing: ${commandName}`, 'info'); // This is player's own command log
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
            : instigatorIdOrSource; // For audience, instigatorIdOrSource is "AUDIENCE"

        if (isAudienceCmd) {
            this.gameCore.uiManager.addConsoleLogMessage(`Audience Command Received: ${commandName} ${args.join(' ')}`, 'audience');
        } else {
            this.gameCore.uiManager.addConsoleLogMessage(`Received command: ${commandName} from ${username}`, 'response');
        }

        // Player commands that cause corruption and are logged for stats
        const playerCommandsWithCorruption = ['/summon_echo', '/swap_positions', '/glitch_gravity', '/reveal_map'];

        if (playerCommandsWithCorruption.includes(commandName) && !isAudienceCmd) {
            if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                this.gameCore.updateGlobalCorruption(corruptionAmount);
                this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}% due to ${commandName}.`, 'info');
            }
            if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
            if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorIdOrSource, commandName);
        }


        switch (commandName) {
            case '/summon_echo':
                // Corruption and general logging handled above for player commands
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.triggerSummonEchoEffect === 'function') {
                    this.gameCore.effectsManager.triggerSummonEchoEffect();
                } else {
                    console.error("effectsManager or triggerSummonEchoEffect not found");
                }
                this.gameCore.uiManager.addConsoleLogMessage("Echoes shimmer around...", "response");

                // This command also increases global corruption
                if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                    const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                    this.gameCore.updateGlobalCorruption(corruptionAmount);
                    this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}%`, 'info');
                } else {
                     console.error("updateGlobalCorruption function not found on gameCore");
                }
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.triggerSummonEchoEffect === 'function') {
                    this.gameCore.effectsManager.triggerSummonEchoEffect();
                } else {
                    console.error("effectsManager or triggerSummonEchoEffect not found");
                }
                this.gameCore.uiManager.addConsoleLogMessage("Echoes shimmer around...", "response");
                // Specific logging for this command's effect, if any, beyond the generic "executed"
                break;

            case '/test_local': // Example of a command that might have local effects even if "networked"
                 this.gameCore.uiManager.addConsoleLogMessage(`Executing test_local command with args: ${args.join(', ')} initiated by ${username}`, 'response');
                 // No specific corruption for test_local unless explicitly added
                if (this.gameCore.streamerDataManager && !isAudienceCmd) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} (local test) used by ${username}!`);
                if (this.gameCore.matchStatsManager && !isAudienceCmd) this.gameCore.matchStatsManager.recordCommandUse(instigatorIdOrSource, commandName);
                break;

            case '/swap_positions':
                // Corruption and general logging handled above for player commands
                this.gameCore.uiManager.addConsoleLogMessage("Player positions are shifting...", "response");
                 if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    if (!this.gameCore.networkManager || !this.gameCore.networkManager.getConnectedPeersIds) {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: NetworkManager not available for peer list.", "error");
                        break;
                    }
                    const playerIds = this.gameCore.networkManager.getConnectedPeersIds(true); // true to include local client

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
                // Specific logging for this command's effect, if any
                break;

            case '/glitch_gravity':
                // Corruption and general logging handled above for player commands
                this.gameCore.uiManager.addConsoleLogMessage("Gravity feels... strange.", "response");
                 if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const randomYGravity = (Math.random() > 0.5 ? -1 : 1) * (Math.random() * 10 + 5); // -15 to -5 or 5 to 15
                    const glitchDuration = Math.floor(Math.random() * 11) + 10; // 10-20 seconds

                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendGlitchGravityCommand) {
                        this.gameCore.networkManager.sendGlitchGravityCommand({ y: randomYGravity }, glitchDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated gravity glitch: Y-gravity ${randomYGravity} for ${glitchDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Gravity glitch failed: sendGlitchGravityCommand not available on NetworkManager.", "error");
                    }
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to set new gravity.", "info");
                }
                // Specific logging for this command's effect, if any
                break;

            case '/reveal_map':
                // Corruption and general logging handled above for player commands
                this.gameCore.uiManager.addConsoleLogMessage("The veil of ignorance lifts... temporarily.", "response");
                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const revealDuration = 10; // 10 seconds
                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendRevealMapCommand) {
                        this.gameCore.networkManager.sendRevealMapCommand(revealDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated map reveal for ${revealDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Map reveal failed: sendRevealMapCommand not available on NetworkManager.", "error");
                    }
                } else {
                     this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to trigger map reveal.", "info");
                }
                // Specific logging for this command's effect, if any
                break;

            // Audience Commands
            case '!bless':
                // Corruption is NOT added for audience commands here.
                // Specific effect application is handled by NetworkManager upon receiving 'apply_player_effect'
                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const targetName = args[0];
                    if (!targetName) {
                        this.gameCore.uiManager.addConsoleLogMessage(`Bless failed: No player name provided. Usage: !bless <playerName>`, 'error');
                        break; // Break from switch case
                    }
                    const targetPlayerInfo = this.gameCore.getPlayerByName(targetName); // Assumes getPlayerByName in GameCore
                    if (targetPlayerInfo) {
                        const duration = 10000; // 10 seconds
                        const effectDetails = { type: 'blessed', duration: duration, strength: 0.25 }; // Speed boost strength
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
                } // Non-authoritative clients do nothing for !bless, they wait for apply_player_effect
                break;
            // TODO: Add cases for !curse, !spawn_item etc.

            default:
                // This default is for commands received over network that aren't in the switch
                // or for audience commands that are not yet implemented after being identified as audience.
                const messageType = isAudienceCmd ? "audience" : "player";
                this.gameCore.uiManager.addConsoleLogMessage(`Unknown ${messageType} command received for execution: ${commandName}`, "error");
                break;
        }
    }
}
