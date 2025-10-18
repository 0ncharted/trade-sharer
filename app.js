import { MiniAppSDK } from "@basedone/miniapp-sdk";

let client;
let botToken;
let chatId;
let referralCode;
let pollInterval;
let lastOrders = [];

document.addEventListener("DOMContentLoaded", () => {
  const startSharingButton = document.getElementById("startSharing");
  if (startSharingButton) {
    startSharingButton.addEventListener("click", initSharer);
  }

  const testShareButton = document.getElementById("testShare");
  if (testShareButton) {
    testShareButton.addEventListener("click", testShare);
  }

  loadSavedInputs();

  const inputs = ['botToken', 'chatId', 'referralCode'];
  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', saveInputs);
    }
  });
});

async function initSharer() {
  hideMessage("status");
  hideMessage("error");

  botToken = document.getElementById("botToken").value.trim() || localStorage.getItem('tradeSharerBotToken') || '';
  chatId = document.getElementById("chatId").value.trim() || localStorage.getItem('tradeSharerChatId') || '';
  referralCode = document.getElementById("referralCode").value.trim() || localStorage.getItem('tradeSharerReferralCode') || "GODSEYE";

  saveInputs();

  if (!botToken || !chatId) {
    showError("⚠️ Please enter both bot token and chat ID!");
    return;
  }

  try {
    showStatus("🔄 Initializing SDK...");

    client = new MiniAppSDK({
      appId: "trade-sharer",
      name: "Trade Sharer",
      debug: true,
      autoConnect: true,
      permissions: ["read_market_data", "read_trades", "read_positions", "read_orders"],
    });

    setTimeout(() => {
      const state = client.getConnectionState();
      if (!state || !state.connected) {
        showError("⚠️ SDK connection timeout. Please refresh and try again.");
        console.error("Connection state:", state);
      }
    }, 10000);

    client.on("connected", async ({ sessionId, permissions }) => {
      console.log("Connected with session:", sessionId);
      console.log("Initial permissions:", Array.from(permissions));

      showStatus("✅ Connected! Requesting trade/order permissions...");

      try {
        const perms = Array.from(permissions);
        const needed = ['read_trades', 'read_orders'];
        const missing = needed.filter(p => !perms.includes(p));
        if (missing.length > 0) {
          const granted = await client.requestPermissions(needed);
          console.log("Granted permissions:", granted);
          if (!granted.includes('read_trades') || !granted.includes('read_orders')) {
            showError("⚠️ Permissions denied. Please grant and try again.");
            return;
          }
        }

        showStatus("✅ Permissions granted! Listening for trades/orders...");

        // Subscribe to trades (per SDK guide)
        await client.subscribe("trade.update");
        client.on("trade.update", async (trade) => {
          console.log("Trade received:", trade);
          await shareTrade(trade);
        });

        // Subscribe to orders (per SDK guide)
        await client.subscribe("order.update");
        client.on("order.update", async (order) => {  // FIXED: Made callback async to allow await
          console.log("Order update:", order);
          if (order.status === 'filled') {
            const tradeData = {
              symbol: order.symbol,
              side: order.side,
              size: order.size,
              price: order.price || order.avgPrice,
              timestamp: order.timestamp,
              realizedPnl: order.realizedPnl || 0
            };
            console.log("Filled order as trade:", tradeData);
            await shareTrade(tradeData);
          }
        });

        // Poll for orders (using sendCommand per SDK guide)
        pollInterval = setInterval(async () => {
          if (client && client.connected) {
            try {
              const orders = await client.sendCommand('order.query', {});  // Docs: order.query for orders
              console.log("Polled orders:", orders);
              const newFilled = orders.data.filter(o => o.status === 'filled' && !lastOrders.some(lo => lo.id === o.id));
              if (newFilled.length > 0) {
                newFilled.forEach(order => {
                  const tradeData = {
                    symbol: order.symbol,
                    side: order.side,
                    size: order.size,
                    price: order.price || order.avgPrice,
                    timestamp: order.timestamp,
                    realizedPnl: order.realizedPnl || 0
                  };
                  console.log("New filled order from poll:", tradeData);
                  shareTrade(tradeData);
                });
              }
              lastOrders = orders.data.map(o => ({ id: o.id, status: o.status }));
            } catch (err) {
              console.error("Poll error:", err);
            }
          }
        }, 30000);

      } catch (error) {
        console.error("Permission error:", error);
        showError("⚠️ Failed to request permissions: " + error.message);
      }
    });

    client.on("disconnected", () => {
      console.log("SDK disconnected");
      if (pollInterval) clearInterval(pollInterval);
      showError("❌ Disconnected. Refresh and reconnect.");
    });

    client.on("error", (error) => {
      console.error("SDK Error:", error);
      showError("❌ SDK Error: " + error.message);
    });
  } catch (error) {
    console.error("Initialization error:", error);
    showError("❌ Failed to initialize: " + error.message);
  }
}

// FIXED: Test reads inputs directly (independent)
async function testShare() {
  const currentBotToken = document.getElementById("botToken").value.trim() || localStorage.getItem('tradeSharerBotToken') || '';
  const currentChatId = document.getElementById("chatId").value.trim() || localStorage.getItem('tradeSharerChatId') || '';
  if (!currentBotToken || !currentChatId) {
    showError("⚠️ Enter bot token and chat ID first!");
    return;
  }
  const testMessage = "🧪 Test from Trade Sharer - Setup OK! (Date: October 18, 2025)";
  try {
    showStatus("⏳ Sending test to Telegram...");
    const formData = new FormData();
    formData.append("chat_id", currentChatId);
    formData.append("text", testMessage);
    formData.append("parse_mode", "Markdown");

    const response = await fetch(`https://api.telegram.org/bot${currentBotToken}/sendMessage`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("Telegram test response:", data);
    if (data.ok) {
      showStatus("✅ Test sent to Telegram!");
    } else {
      showError("❌ Test failed: " + (data.description || "Unknown"));
    }
  } catch (error) {
    console.error("Test error:", error);
    showError("❌ Test error: " + error.message);
  }
}

async function shareTrade(trade) {
  console.log("Sharing trade:", trade);
  showStatus("⏳ Sending to Telegram...");

  const refCode = referralCode || "GODSEYE";
  const referralLink = `https://app.based.one/r/${refCode}`;

  let pnlDisplay = "N/A";
  if (trade.pnl) {
    pnlDisplay = trade.pnl;
  } else if (trade.realizedPnl !== undefined) {
    pnlDisplay = `$${trade.realizedPnl.toFixed(2)}`;
  }

  const sideDisplay = trade.side.toUpperCase() === "BUY" ? "🟢 BUY" : "🔴 SELL";

  const message =
    `🚀 *New Trade Alert!*\n\n` +
    `📊 *Symbol:* \`${trade.symbol}\`\n` +
    `📈 *Side:* ${sideDisplay}\n` +
    `💰 *Size:* ${trade.size}\n` +
    `💵 *Price:* $${trade.price}\n` +
    `📊 *PnL:* ${pnlDisplay}\n` +
    `⏰ *Time:* ${new Date(
      trade.timestamp || Date.now()
    ).toLocaleString()}\n\n` +
    `🔗 *Join my referrals:* ${referralLink}\n` +
    `#BasedTrades #${trade.symbol.replace("-", "")}`;

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("text", message);
    formData.append("parse_mode", "Markdown");

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    console.log("Telegram response:", data);

    if (data.ok) {
      showStatus(
        `✅ Shared to Telegram! ${
          trade.symbol
        } ${sideDisplay} @ $${trade.price}`
      );
    } else {
      let errorMsg = data.description || "Unknown error";
      if (errorMsg.includes("bot was blocked")) {
        errorMsg = "Bot blocked or removed from group";
      } else if (errorMsg.includes("chat not found")) {
        errorMsg = "Chat ID invalid—add bot to group";
      } else if (errorMsg.includes("Unauthorized")) {
        errorMsg = "Invalid bot token";
      } else if (errorMsg.includes("group chat was deactivated")) {
        errorMsg = "Group deleted or deactivated";
      }

      showError("❌ Share failed: " + errorMsg);
    }
  } catch (error) {
    console.error("Share error:", error);
    showError("❌ Share error: " + error.message);
  }
}

function loadSavedInputs() {
  const botTokenInput = document.getElementById("botToken");
  const chatIdInput = document.getElementById("chatId");
  const referralCodeInput = document.getElementById("referralCode");

  if (botTokenInput) botTokenInput.value = localStorage.getItem('tradeSharerBotToken') || '';
  if (chatIdInput) chatIdInput.value = localStorage.getItem('tradeSharerChatId') || '';
  if (referralCodeInput) referralCodeInput.value = localStorage.getItem('tradeSharerReferralCode') || 'GODSEYE';
}

function saveInputs() {
  localStorage.setItem('tradeSharerBotToken', document.getElementById("botToken").value.trim());
  localStorage.setItem('tradeSharerChatId', document.getElementById("chatId").value.trim());
  localStorage.setItem('tradeSharerReferralCode', document.getElementById("referralCode").value.trim() || 'GODSEYE');
}

function showStatus(message) {
  const statusDiv = document.getElementById("status");
  const errorDiv = document.getElementById("error");
  statusDiv.innerHTML = message;
  statusDiv.classList.add("show");
  errorDiv.classList.remove("show");
}

function showError(message) {
  const errorDiv = document.getElementById("error");
  const statusDiv = document.getElementById("status");
  errorDiv.innerHTML = message;
  errorDiv.classList.add("show");
  statusDiv.classList.remove("show");
}

function hideMessage(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove("show");
  }
}