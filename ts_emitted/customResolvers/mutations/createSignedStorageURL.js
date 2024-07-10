import { Storage } from "@google-cloud/storage";
const isUrlEncoded = (filename) => {
    try {
        return filename === encodeURIComponent(decodeURIComponent(filename));
    }
    catch (e) {
        return false;
    }
};
const createSignedStorageURL = () => {
    return async (parent, args) => {
        let { filename, contentType } = args;
        if (!isUrlEncoded(filename)) {
            throw new Error("Filename is not properly URL encoded");
        }
        const storage = new Storage();
        const bucketName = process.env.GCS_BUCKET_NAME;
        if (!bucketName) {
            throw new Error("GCS_BUCKET_NAME environment variable not set");
        }
        const options = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType,
        };
        try {
            // Generate the Signed URL
            // Get a v4 signed URL for reading the file
            const [url] = await storage
                .bucket(bucketName)
                .file(filename)
                .getSignedUrl(options);
            // Return the Signed URL
            return {
                url,
            };
        }
        catch (error) {
            console.error("Error during upload:", error);
            return {
                url: "",
            };
        }
    };
};
export default createSignedStorageURL;
