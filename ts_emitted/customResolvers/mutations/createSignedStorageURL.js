import { Storage } from "@google-cloud/storage";
const ALLOWED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const isUrlEncoded = (filename) => {
    try {
        return filename === encodeURIComponent(decodeURIComponent(filename));
    }
    catch (e) {
        return false;
    }
};
const validateFile = (filename, contentType, fileSize) => {
    var _a;
    if (!ALLOWED_FILE_TYPES.includes(contentType)) {
        throw new Error(`Invalid file type. Allowed types are: ${ALLOWED_FILE_TYPES.join(', ')}`);
    }
    // Validate file extension matches content type
    const extension = (_a = filename.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const expectedExtensions = {
        'image/png': 'png',
        'image/jpeg': ['jpg', 'jpeg'],
        'image/jpg': ['jpg', 'jpeg']
    };
    const allowedExtensions = expectedExtensions[contentType];
    const isValidExtension = Array.isArray(allowedExtensions)
        ? allowedExtensions.includes(extension || '')
        : extension === allowedExtensions;
    if (!isValidExtension) {
        throw new Error('File extension does not match content type');
    }
    if (fileSize > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
};
const createSignedStorageURL = () => {
    return async (parent, args) => {
        let { filename, contentType, fileSize } = args;
        if (!isUrlEncoded(filename)) {
            throw new Error("Filename is not properly URL encoded");
        }
        validateFile(filename, contentType, fileSize);
        const storage = new Storage();
        const bucketName = process.env.GCS_BUCKET_NAME;
        if (!bucketName) {
            throw new Error("GCS_BUCKET_NAME environment variable not set");
        }
        const options = {
            version: "v4",
            action: "write",
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType,
        };
        // Generate the Signed URL
        const [url] = await storage
            .bucket(bucketName)
            .file(filename)
            .getSignedUrl(options);
        if (!url) {
            console.error("No URL returned from getSignedUrl method");
            return { url: "" };
        }
        // Return the Signed URL
        return { url };
    };
};
export default createSignedStorageURL;
