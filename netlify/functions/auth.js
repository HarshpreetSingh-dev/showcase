const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    try {
        const { action, payload } = JSON.parse(event.body);
        
        // Safe blob retrieval fallback
        let currentPass = "5354";
        let store = null;
        try {
            store = getStore("showcase_settings");
            const cloudPass = await store.get("global_password");
            if (cloudPass) currentPass = cloudPass;
        } catch(e) {
            console.error("Netlify Blobs misconfigured. Running read-only default.", e.message);
        }
        
        const RECOVERY_KEY = "hS11@$($";

        if (action === 'login') {
            if (payload.pass === currentPass) {
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 401, body: JSON.stringify({ error: "Incorrect Password" }) };
        }
        
        if (action === 'changePassword') {
            if (!store) return { statusCode: 500, body: JSON.stringify({ error: "Cloud storage is not connected. Requires Git deployment." }) };
            if (payload.oldPass === currentPass) {
                await store.set("global_password", payload.newPass);
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 401, body: JSON.stringify({ error: "Incorrect Old Password" }) };
        }

        if (action === 'resetPassword') {
            if (!store) return { statusCode: 500, body: JSON.stringify({ error: "Cloud storage is not connected. Requires Git deployment." }) };
            if (payload.recoveryKey === RECOVERY_KEY) {
                await store.set("global_password", payload.newPass);
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 401, body: JSON.stringify({ error: "Invalid Recovery Key" }) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
