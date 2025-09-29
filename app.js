let client;
let botToken;
let chatId;

async function initSharer() {
    console.log('Start Sharing clicked!');
    document.getElementById('status').innerHTML = '';
    document.getElementById('error').innerHTML = '';
    
    botToken = document.getElementById('botToken').value;
    chatId = document.getElementById('chatId').value;
    
    console.log('Token:', botToken, 'Chat ID:', chatId);
    
    if (!botToken || !chatId) {
        document.getElementById('error').innerHTML = 'Please enter both token and chat ID!';
        return;
    }
    
    try {
        if (typeof window.MiniAppSDK === 'undefined') {
            throw new Error('MiniAppSDK not loaded. Ensure running in BasedApp TestKit.');
        }
        client = new window.MiniAppSDK({
            appId: 'trade-sharer',
            debug: true,
            permissions: ['read_trades']
        });
        
        console.log('SDK initialized:', client);
        
        client.on('connected', ({ sessionId, permissions }) => {
            console.log('Connected to terminal!', sessionId);
            document.getElementById('status').innerHTML = '✅ Connected! Listening for trades...';
        });
        
        client.on('error', (error) => {
            console.error('SDK error:', error);
            document.getElementById('error').innerHTML = 'SDK Error: ' + error.message;
        });
        
        await client.subscribe('trade.updates');
        
        client.on('tradeExecution', async (trade) => {
            console.log('Trade detected:', trade);
            await shareTrade(trade);
        });
        
        if (confirm('Test with a fake trade?')) {
            console.log('Testing fake trade');
            await shareTrade({ symbol: 'ETH-PERP', side: 'buy', size: 0.1, price: 2500, pnl: '+0.5%' });
        }
    } catch (error) {
        console.error('Init error:', error);
        document.getElementById('error').innerHTML = 'Failed to initialize: ' + error.message + '. Using manual trade sharing.';
        if (confirm('SDK failed. Test fake trade anyway?')) {
            console.log('Testing fake trade');
            await shareTrade({ symbol: 'ETH-PERP', side: 'buy', size: 0.1, price: 2500, pnl: '+0.5%' });
        }
    }
}

async function shareTrade(trade) {
    console.log('Sharing trade:', trade);
    const referralLink = 'https://app.based.one/r/GODSEYE';
    const message = `🚀 New Trade Alert!\n` +
                    `Symbol: ${trade.symbol}\n` +
                    `Side: ${trade.side.toUpperCase()}\n` +
                    `Size: ${trade.size}\n` +
                    `Price: $${trade.price}\n` +
                    `PnL: ${trade.pnl || 'N/A'}\n` +
                    `Join my referrals: ${referralLink} #BasedTrades`;
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.ok) {
            console.log('Trade shared successfully!');
            document.getElementById('status').innerHTML = '✅ Trade shared!';
        } else {
            console.error('Share failed:', data);
            document.getElementById('error').innerHTML = 'Failed to share trade: ' + JSON.stringify(data);
        }
    } catch (error) {
        console.error('Share error:', error);
        document.getElementById('error').innerHTML = 'Error sharing trade: ' + error.message;
    }
}
