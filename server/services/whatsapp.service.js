const config = require('../config/config');

const sendWhatsAppMessage = async ({ phoneNumber, message }) => {
  const { apiUrl, apiKey, agentId } = config.frontDesk;

  // Check if active FrontDesk API keys exist
  if (apiKey && apiKey !== 'dummy_frontdesk_api_key_placeholder' && apiUrl) {
    try {
      // Production integration call to FrontDesk Agents API
      const response = await fetch(`${apiUrl}/agents/${agentId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          to: phoneNumber,
          message: message
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `FrontDesk API responded with status ${response.status}`);
      }

      const data = await response.json();
      return { success: true, response: data };
    } catch (error) {
      console.error(`[WhatsApp Service Error] ${error.message}`);
      throw error;
    }
  }

  // Fallback mock dispatch (when using placeholders / local dev)
  console.log(`[WhatsApp Mock Dispatch] To: ${phoneNumber || 'User'} | Message: "${message}"`);
  return {
    success: true,
    mock: true,
    message: 'Mock WhatsApp notification dispatched successfully (FrontDesk API placeholder mode)'
  };
};

module.exports = {
  sendWhatsAppMessage
};
