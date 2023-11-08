const { Storage } = require("@google-cloud/storage");

const createSignedStorageURL = () => {
  return async (_, args) => {
    const { filename, contentType } = args;

    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET_NAME;

    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    };

    try {
      //   Generate the Signed URL
      //  Get a v4 signed URL for reading the file
      const [url] = await storage
        .bucket(bucketName)
        .file(filename)
        .getSignedUrl(options);

      // Return the Signed URL
      return {
        url,
      };
    } catch (error) {
      console.error("Error during upload:", error);
      return {
        url: "",
      };
    }
  };
};

module.exports = createSignedStorageURL;
