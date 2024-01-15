import snoowrap from 'snoowrap';

type Args = {
  subredditName: string;
  options?: {
    offset?: number;
    limit?: number;
    sort?: string;
  };
}

const getSubredditResolver = () => {
  return async (parent: any, args: Args, context: any, info: any) => {
    const { subredditName, options } = args;
    const { offset, limit, sort } = options || {};

    const r = new snoowrap({
        userAgent: 'web:Listical:v1.0 (by /u/gennitdev)',
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        refreshToken: process.env.REDDIT_REFRESH_TOKEN
    })

    // @ts-ignore
    const metadata = await r.getSubreddit(subredditName).fetch();

    const result = {
        title: metadata.title,
        displayName: metadata.display_name,
        allowGalleries: metadata.allow_galleries,
        shortDescription: metadata.public_description, // 500 characters max
        longDescription: metadata.description, // 5120 characters max
        communityIcon: metadata.community_icon,
        showMediaPreview: metadata.show_media_preview,
        bannerImg: metadata.banner_background_image,
        allowImages: metadata.allow_images,
    }

    return result;
  };
};

export default getSubredditResolver;
