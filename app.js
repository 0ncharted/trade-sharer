let sdk;
let botToken;
let chatId;

async function initSharer() {
    console.log('Start Sharing clicked!');
    document.getElementById('status').innerHTML = '';
    document.getElementById('error').innerHTML = '';
    document.getElementById('fakeTradeButton').style.display = 'none';
    
    botToken = document.getElementById('botToken').value;
    chatId = document.getElementById('chatId').value;
    
    console.log('Token:', botToken, 'Chat ID:', chatId);
    
    if (!botToken || !chatId) {
        document.getElementById('error').innerHTML = 'Please enter both token and chat ID!';
        return;
    }
    
    try {
        if (typeof MiniAppSDK === 'undefined') {
            throw new Error('MiniAppSDK not loaded. Ensure running in BasedApp TestKit.');
        }
        sdk = MiniAppSDK({
            appId: 'trade-sharer',
            url: window.location.origin,
            name: 'Trade Sharer',
            debug: true,
            autoconnect: true,
            permissions: [
                'read_trades', // Required for trade execution events
                'read_balance', // Optional, for balance checks
                'read_positions', // Optional, for position data
            ],
        });
        
        console.log('SDK initialized:', sdk);
        
        sdk.on('connected', ({ sessionId, permissions }) => {
            console.log('Connected to terminal!', sessionId);
            document.getElementById('status').innerHTML = '✅ Connected! Click below to test a fake trade.';
            document.getElementById('fakeTradeButton').style.display = 'block';
        });
        
        sdk.on('error', (error) => {
            console.error('SDK error:', error);
            document.getElementById('error').innerHTML = 'SDK Error: ' + error.message;
        });
        
        await sdk.subscribe('trade.updates');
        
        sdk.on('tradeExecution', async (trade) => {
            console.log('Trade detected:', trade);
            await shareTrade(trade);
        });
    } catch (error) {
        console.error('Init error:', error);
        document.getElementById('error').innerHTML = 'Failed to initialize: ' + error.message + '. Click below to test a fake trade.';
        document.getElementById('fakeTradeButton').style.display = 'block';
    }
}

async function testFakeTrade() {
    console.log('Testing fake trade');
    await shareTrade({ symbol: 'ETH-PERP', side: 'buy', size: 0.1, price: 2500, pnl: '+0.5%' });
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
            document.getElementById('status').innerHTML = '✅ Trade shared to Telegram!';
        } else {
            console.error('Share failed:', data);
            document.getElementById('error').innerHTML = 'Failed to share trade: ' + JSON.stringify(data);
        }
    } catch (error) {
        console.error('Share error:', error);
        document.getElementById('error').innerHTML = 'Error sharing trade: ' + error.message;
    }
}