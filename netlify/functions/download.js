const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    try {
        const id = event.queryStringParameters.id;
        if (!id) return { statusCode: 400, body: "Missing ID" };

        let store;
        try {
            store = getStore("showcase_files");
        } catch(e) {
            return { statusCode: 500, body: JSON.stringify({ error: "[FATAL] Netlify Database Missing! Link via GitHub to fix." }) };
        }
        const dataURL = await store.get(id);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ dataURL })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
