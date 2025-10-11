const MonitoringDB = require('./monitoring-db');

class MonitoringService {
    // Send a Discord webhook
    static async sendDiscordWebhook(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Discord webhook failed: ${response.status}`);
        }
    }
    
    // Fetch faction data from Torn API
    static async fetchFactionData(factionId, apiKey) {
        try {
            const response = await fetch(
                `https://api.torn.com/faction/${factionId}?selections=basic,crimes,chain,territory,armor&key=${apiKey}`
            );
            
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Torn API error:', error);
            return null;
        }
    }
    
    // Check if currently in quiet hours
    static isQuietHours(quietHours) {
        if (!quietHours || !quietHours.enabled) return false;
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;
        
        const [startHour, startMin] = quietHours.start.split(':').map(Number);
        const [endHour, endMin] = quietHours.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (startTime < endTime) {
            return currentTime >= startTime && currentTime < endTime;
        } else {
            return currentTime >= startTime || currentTime < endTime;
        }
    }
    
    // Send an alert if conditions are met
    static async sendAlert(factionId, alertType, embedData, config) {
        // Find webhook for this alert type
        let webhook = config.webhooks.find(w => w.type === alertType);
        if (!webhook) {
            webhook = config.webhooks.find(w => w.type === 'general');
        }
        
        if (!webhook) {
            console.log(`No webhook configured for ${alertType}`);
            return;
        }
        
        try {
            await this.sendDiscordWebhook(webhook.url, { embeds: [embedData] });
            await MonitoringDB.logAlert(factionId, alertType, embedData, webhook.url, true);
        } catch (error) {
            console.error(`Failed to send ${alertType} alert:`, error);
            await MonitoringDB.logAlert(factionId, alertType, embedData, webhook.url, false, error.message);
        }
    }
    
    // Monitor a single faction
    static async monitorFaction(faction) {
        try {
            const config = await MonitoringDB.getConfig(faction.id);
            const state = await MonitoringDB.getMonitoringState(faction.id);
            
            // Skip if no alerts enabled
            if (!Object.values(config.enabledAlerts).some(v => v)) {
                console.log(`No alerts enabled for faction ${faction.id}`);
                return;
            }
            
            // Skip if quiet hours
            if (this.isQuietHours(config.quietHours)) {
                console.log(`Quiet hours active for faction ${faction.id}`);
                return;
            }
            
            // Fetch faction data
            const data = await this.fetchFactionData(faction.torn_faction_id, faction.api_key);
            
            if (!data) {
                // Handle API error
                await MonitoringDB.updateMonitoringState(faction.id, {
                    lastCheck: new Date(),
                    checkFailures: (state.checkFailures || 0) + 1,
                    lastError: 'API request failed'
                });
                return;
            }
            
            // Reset failures on success
            await MonitoringDB.updateMonitoringState(faction.id, {
                lastCheck: new Date(),
                checkFailures: 0
            });
            
            // Check OC alerts
            if (config.enabledAlerts.oc && data.crimes) {
                const readyCrimes = data.crimes.filter(c => c.ready === 1).length;
                if (readyCrimes >= config.thresholds.oc_crimes) {
                    const recentlySent = await MonitoringDB.wasRecentlySent(
                        faction.id, 'oc', config.cooldowns.oc
                    );
                    
                    if (!recentlySent) {
                        await this.sendAlert(faction.id, 'oc', {
                            title: '🔫 Organized Crimes Ready',
                            description: `${readyCrimes} organized crime(s) ready!`,
                            color: 0xFF6B6B,
                            timestamp: new Date().toISOString()
                        }, config);
                    }
                }
            }
            
            // Check chain alerts
            if (config.enabledAlerts.chain && data.chain) {
                const chainCount = data.chain.current || 0;
                
                if (chainCount >= config.thresholds.chain_warning) {
                    const recentlySent = await MonitoringDB.wasRecentlySent(
                        faction.id, 'chain', config.cooldowns.chain
                    );
                    
                    if (!recentlySent) {
                        await this.sendAlert(faction.id, 'chain', {
                            title: '🔗 Chain Milestone',
                            description: `Chain reached ${chainCount} hits!`,
                            color: 0x6BCF7F,
                            timestamp: new Date().toISOString()
                        }, config);
                    }
                }
                
                // Update chain count
                await MonitoringDB.updateMonitoringState(faction.id, {
                    currentChainCount: chainCount
                });
            }
            
            console.log(`Successfully monitored faction ${faction.id}`);
            
        } catch (error) {
            console.error(`Error monitoring faction ${faction.id}:`, error);
        }
    }
    
    // Main monitoring loop
    static async monitorAll() {
        console.log('Starting monitoring cycle...');
        
        const factions = await MonitoringDB.getActiveFactions();
        console.log(`Monitoring ${factions.length} factions`);
        
        // Process in batches of 5
        for (let i = 0; i < factions.length; i += 5) {
            const batch = factions.slice(i, i + 5);
            await Promise.all(batch.map(f => this.monitorFaction(f)));
            
            // Small delay between batches
            if (i + 5 < factions.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('Monitoring cycle complete');
    }
}

module.exports = MonitoringService;
