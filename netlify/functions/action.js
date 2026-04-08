const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    try {
        const { action, payload } = JSON.parse(event.body);
        let store;
        let showcaseStore;
        try {
            store = getStore("showcase_files");
            showcaseStore = getStore("showcase_categories");
        } catch(e) {
            return { statusCode: 500, body: JSON.stringify({ error: "[FATAL] Netlify Database Missing! Link via GitHub to fix." }) };
        }

        if (action === 'moveToRecycleBin' || action === 'restoreFile') {
            const isDel = action === 'moveToRecycleBin' ? "true" : "false";
            const dataURL = await store.get(payload.id);
            if(dataURL) {
                const newMeta = { ...payload.metadata, isDeleted: isDel };
                await store.set(payload.id, dataURL, { metadata: newMeta });
            }
        }
        else if (action === 'permanentlyDeleteFile') {
            await store.delete(payload.id);
        }
        else if (action === 'emptyRecycleBin') {
            const { blobs } = await store.list();
            // Delete all where metadata isDeleted == 'true'
            for (const blob of blobs) {
                if (blob.metadata && blob.metadata.isDeleted === "true") {
                    await store.delete(blob.key);
                }
            }
        }
        else if (action === 'restoreAllRecycleBin') {
            const { blobs } = await store.list();
            for (const blob of blobs) {
                if (blob.metadata && blob.metadata.isDeleted === "true") {
                    const dataURL = await store.get(blob.key);
                    const newMeta = { ...blob.metadata, isDeleted: "false" };
                    await store.set(blob.key, dataURL, { metadata: newMeta });
                }
            }
        }
        else if (action === 'createShowcase') {
            await showcaseStore.set(payload.name, "exists");
        }
        else if (action === 'deleteShowcase') {
            await showcaseStore.delete(payload.name);
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
