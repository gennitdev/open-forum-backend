import snoowrap from 'snoowrap';

type Args = {
  subredditName: string;
  options?: {
    offset?: number;
    limit?: number;
    sort?: string;
  };
}

type PostFromAPI = {
  subreddit: {
    display_name: string;
  };
  title: string;
  created_utc: number;
  author: {
    name: string;
  }
  num_comments: number;
  selftext: string;
  media_metadata: any;
  permalink: string;
  thumbnail: string;
  upvoteCount: number;
  url: string;
  preview: any;
  ups: number;
}

type PostOutput = {
  subreddit: string;
  title: string;
  createdUTC: number;
  author: string;
  commentCount: number;
  text: string;
  mediaMetadata: any;
  permalink: string;
  thumbnail: string;
  upvoteCount: number;
  url: string;
  preview: any;
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
    const subreddit = await r.getSubreddit(subredditName);

    // output format:
    // type RedditSubmission {
    //     subreddit: String!
    //     title: String!
    //     createdUTC: Int!
    //     author: String!
    //     commentCount: Int!
    //     text: String!
    //     mediaMetadata: JSON
    //     permalink: String!
    //     thumbnail: String!
    //     upvoteCount: Int!
    //   }
    const posts = await subreddit.getHot({ time: 'month' });

    const result: PostOutput[] = posts.map((post: PostFromAPI) => {
      return {
        subreddit: post.subreddit.display_name,
        title: post.title,
        createdUTC: post.created_utc,
        author: post.author?.name || '[deleted]',
        commentCount: post.num_comments,
        text: post.selftext,
        mediaMetadata: post.media_metadata,
        permalink: post.permalink,
        thumbnail: post.thumbnail,
        upvoteCount: post.ups,
        url: post.url,
        preview: post.preview
      }
    });

    return result;
  };
};

export default getSubredditResolver;
