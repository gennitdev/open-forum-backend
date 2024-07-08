import { Storage, GetSignedUrlConfig } from "@google-cloud/storage";

type Args = {
  filename: string;
  contentType: string;
};

const createSignedStorageURL = () => {
  return async (parent: any, args: Args) => {
    let { filename, contentType } = args;

    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME environment variable not set");
    }

    console.log('file name before:', filename)

    // Replace all types of spaces with underscores or hyphens
    const newFilename = filename.replace(/\s/g, '_');

    // URL encode the filename
    const encodedFilename = encodeURIComponent(newFilename);

    const options: GetSignedUrlConfig = {
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
        .file(encodedFilename)
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

export default createSignedStorageURL;
