import { Storage, GetSignedUrlConfig } from "@google-cloud/storage";

type Args = {
  filename: string;
  contentType: string;
  fileSize: number; // Add fileSize to arguments
};

const ALLOWED_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const isUrlEncoded = (filename: string): boolean => {
  try {
    return filename === encodeURIComponent(decodeURIComponent(filename));
  } catch (e) {
    return false;
  }
};

const validateFile = (filename: string, contentType: string, fileSize: number): void => {
  if (!ALLOWED_FILE_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid file type. Allowed types are: ${ALLOWED_FILE_TYPES.join(', ')}`
    );
  }

  // Validate file extension matches content type
  const extension = filename.split('.').pop()?.toLowerCase();
  const expectedExtensions = {
    'image/png': 'png',
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg']
  };
  
  const allowedExtensions = expectedExtensions[contentType as keyof typeof expectedExtensions];
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
  return async (parent: any, args: Args) => {
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

    const options: GetSignedUrlConfig = {
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