const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
    try {
        let store;
        let showcaseStore;
        try {
            store = getStore("showcase_files");
            showcaseStore = getStore("showcase_categories");
        } catch(e) {
            return { statusCode: 500, body: JSON.stringify({ error: "[FATAL] Netlify Database Missing! Link via GitHub to fix." }) };
        }
        
        const { blobs } = await store.list();
        
        // Blobs return just metadata and keys. We format it into our app's structure
        const files = blobs.map(b => ({
            id: b.key,
            name: b.metadata.name,
            type: b.metadata.type,
            category: b.metadata.category,
            customShowcase: b.metadata.customShowcase === 'null' ? null : b.metadata.customShowcase,
            parentFolder: b.metadata.parentFolder === 'null' ? null : b.metadata.parentFolder,
            isDeleted: b.metadata.isDeleted === "true"
        }));


        const { blobs: showcaseBlobs } = await showcaseStore.list();
        const customShowcases = showcaseBlobs.map(b => ({ name: b.key }));

        return {
            statusCode: 200,
            body: JSON.stringify({ files, customShowcases })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
