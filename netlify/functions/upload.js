const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    try {
        let store;
        try {
            store = getStore("showcase_files");
        } catch(e) {
            return { statusCode: 500, body: JSON.stringify({ error: "Netlify Database Missing! Link via GitHub to fix." }) };
        }
        
        // Ensure metadata values are strictly strings and not huge
        const safeMetadata = {
            name: String(metadata.name),
            type: String(metadata.type),
            category: String(metadata.category),
            customShowcase: String(metadata.customShowcase),
            parentFolder: String(metadata.parentFolder),
            isDeleted: String(metadata.isDeleted)
        };

        // We store the dataURL (base64) as the main blob content, and pass the stringified metadata configuration.
        await store.set(id, dataURL, { metadata: safeMetadata });

        return { statusCode: 200, body: JSON.stringify({ success: true, id }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
