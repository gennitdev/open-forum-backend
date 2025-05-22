/**
 * Simple test script to verify discussion version history functionality
 * 
 * How to use:
 * 1. Start the server (npm run start)
 * 2. Run this script with Node.js (node test_version_history.js)
 * 3. Check the console logs to verify that version history is being tracked
 * 
 * This script tests both updateDiscussion and updateDiscussionWithChannelConnections mutations
 * to ensure both properly track version history.
 */

import fetch from 'node-fetch';

// Replace these values with actual data from your database
const TEST_DISCUSSION_ID = 'replace-with-actual-discussion-id';
const AUTHOR_USERNAME = 'replace-with-username';
const CHANNEL_UNIQUE_NAME = 'replace-with-channel-name';

// GraphQL endpoint
const GRAPHQL_URL = 'http://localhost:4000';

// 1. Query the current discussion
async function getDiscussion(discussionId) {
  const query = `
    query GetDiscussion($id: ID!) {
      discussions(where: { id: $id }) {
        id
        title
        body
        updatedAt
        Author {
          username
        }
        PastTitleVersions {
          id
          body
          createdAt
          Author {
            username
          }
        }
        PastBodyVersions {
          id
          body
          createdAt
          Author {
            username
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { id: discussionId },
    }),
  });

  const result = await response.json();
  return result.data.discussions[0];
}

// 2. Update the discussion using updateDiscussions mutation
async function updateDiscussionTitle(discussionId, newTitle) {
  const mutation = `
    mutation UpdateDiscussion($id: ID!, $title: String!) {
      updateDiscussions(
        where: { id: $id }
        update: { title: $title }
      ) {
        discussions {
          id
          title
          updatedAt
          PastTitleVersions {
            id
            body
            createdAt
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { id: discussionId, title: newTitle },
    }),
  });

  const result = await response.json();
  return result.data.updateDiscussions.discussions[0];
}

// 3. Update the discussion body using updateDiscussions mutation
async function updateDiscussionBody(discussionId, newBody) {
  const mutation = `
    mutation UpdateDiscussion($id: ID!, $body: String!) {
      updateDiscussions(
        where: { id: $id }
        update: { body: $body }
      ) {
        discussions {
          id
          body
          updatedAt
          PastBodyVersions {
            id
            body
            createdAt
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { id: discussionId, body: newBody },
    }),
  });

  const result = await response.json();
  return result.data.updateDiscussions.discussions[0];
}

// 4. Update the discussion using updateDiscussionWithChannelConnections mutation
async function updateDiscussionWithChannelConnections(discussionId, update) {
  const mutation = `
    mutation UpdateDiscussionWithChannelConnections(
      $id: ID!, 
      $update: DiscussionUpdateInput!,
      $channelConnections: [String!],
      $channelDisconnections: [String!]
    ) {
      updateDiscussionWithChannelConnections(
        where: { id: $id }
        discussionUpdateInput: $update
        channelConnections: $channelConnections
        channelDisconnections: $channelDisconnections
      ) {
        id
        title
        body
        updatedAt
        PastTitleVersions {
          id
          body
          createdAt
          Author {
            username
          }
        }
        PastBodyVersions {
          id
          body
          createdAt
          Author {
            username
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: { 
        id: discussionId, 
        update: update,
        channelConnections: [],
        channelDisconnections: []
      },
    }),
  });

  const result = await response.json();
  return result.data.updateDiscussionWithChannelConnections;
}

// Main test function
async function testVersionHistory() {
  try {
    console.log('Starting discussion version history test...');
    
    // 1. Get current discussion
    console.log(`Fetching discussion with ID: ${TEST_DISCUSSION_ID}`);
    const discussion = await getDiscussion(TEST_DISCUSSION_ID);
    console.log('Current discussion:', {
      id: discussion.id,
      title: discussion.title,
      body: discussion.body ? discussion.body.substring(0, 50) + '...' : 'No body',
      author: discussion.Author?.username,
      pastTitleVersionsCount: discussion.PastTitleVersions?.length || 0,
      pastBodyVersionsCount: discussion.PastBodyVersions?.length || 0
    });
    
    // PART 1: Test updateDiscussions mutation for title updates
    console.log('\n=== Testing updateDiscussions mutation (title) ===');
    
    // 2. Update discussion title
    const currentTitle = discussion.title;
    const newTitle = `${currentTitle} - Updated ${new Date().toISOString()}`;
    
    console.log(`Updating discussion title to: "${newTitle}"`);
    const updatedDiscussion = await updateDiscussionTitle(TEST_DISCUSSION_ID, newTitle);
    console.log('Discussion title updated:', {
      id: updatedDiscussion.id,
      title: updatedDiscussion.title,
      updatedAt: updatedDiscussion.updatedAt,
      pastTitleVersionsCount: updatedDiscussion.PastTitleVersions?.length || 0,
    });
    
    // 3. Wait for any processing
    console.log('Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Check if title version history was created
    console.log('Checking title version history...');
    const updatedDiscussionWithTitleHistory = await getDiscussion(TEST_DISCUSSION_ID);
    console.log('Updated discussion with title history:', {
      id: updatedDiscussionWithTitleHistory.id,
      title: updatedDiscussionWithTitleHistory.title,
      pastTitleVersionsCount: updatedDiscussionWithTitleHistory.PastTitleVersions?.length || 0,
    });
    
    // 5. Verify that the old title is now in the version history
    const pastTitleVersions = updatedDiscussionWithTitleHistory.PastTitleVersions || [];
    const hasOldTitle = pastTitleVersions.some(version => version.body === currentTitle);
    
    if (hasOldTitle) {
      console.log('✅ SUCCESS: Previous title found in version history!');
      console.log('Title version history:', pastTitleVersions.map(v => ({
        id: v.id,
        title: v.body,
        createdAt: v.createdAt,
        author: v.Author?.username
      })));
    } else {
      console.log('❌ FAILURE: Previous title not found in title version history.');
      console.log('Current title:', updatedDiscussionWithTitleHistory.title);
      console.log('Title version history:', pastTitleVersions.map(v => v.body));
    }
    
    // PART 2: Test updateDiscussions mutation for body updates
    console.log('\n=== Testing updateDiscussions mutation (body) ===');
    
    // 6. Update discussion body
    const currentBody = updatedDiscussionWithTitleHistory.body || '';
    const newBody = `${currentBody}\n\nUpdated body text: ${new Date().toISOString()}`;
    
    console.log(`Updating discussion body...`);
    const updatedDiscussionBody = await updateDiscussionBody(TEST_DISCUSSION_ID, newBody);
    console.log('Discussion body updated:', {
      id: updatedDiscussionBody.id,
      bodyPreview: updatedDiscussionBody.body ? updatedDiscussionBody.body.substring(0, 50) + '...' : 'No body',
      updatedAt: updatedDiscussionBody.updatedAt,
      pastBodyVersionsCount: updatedDiscussionBody.PastBodyVersions?.length || 0,
    });
    
    // 7. Wait for any processing
    console.log('Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. Check if body version history was created
    console.log('Checking body version history...');
    const updatedDiscussionWithBodyHistory = await getDiscussion(TEST_DISCUSSION_ID);
    console.log('Updated discussion with body history:', {
      id: updatedDiscussionWithBodyHistory.id,
      bodyPreview: updatedDiscussionWithBodyHistory.body ? updatedDiscussionWithBodyHistory.body.substring(0, 50) + '...' : 'No body',
      pastBodyVersionsCount: updatedDiscussionWithBodyHistory.PastBodyVersions?.length || 0,
    });
    
    // 9. Verify that the old body is now in the version history
    const pastBodyVersions = updatedDiscussionWithBodyHistory.PastBodyVersions || [];
    const hasOldBody = pastBodyVersions.some(version => version.body === currentBody);
    
    if (hasOldBody) {
      console.log('✅ SUCCESS: Previous body found in version history!');
      console.log('Body version history count:', pastBodyVersions.length);
    } else {
      console.log('❌ FAILURE: Previous body not found in body version history.');
      console.log('Body version history count:', pastBodyVersions.length);
    }
    
    // PART 3: Test updateDiscussionWithChannelConnections mutation
    console.log('\n=== Testing updateDiscussionWithChannelConnections mutation ===');
    
    // 10. Update discussion using the custom resolver
    const anotherTitle = `${updatedDiscussionWithBodyHistory.title} - Custom Updated ${new Date().toISOString()}`;
    const anotherBody = `${updatedDiscussionWithBodyHistory.body}\n\nCustom updated body text: ${new Date().toISOString()}`;
    
    console.log(`Updating discussion using custom resolver...`);
    const customUpdatedDiscussion = await updateDiscussionWithChannelConnections(
      TEST_DISCUSSION_ID, 
      { 
        title: anotherTitle,
        body: anotherBody
      }
    );
    
    console.log('Discussion updated with custom resolver:', {
      id: customUpdatedDiscussion.id,
      title: customUpdatedDiscussion.title,
      bodyPreview: customUpdatedDiscussion.body ? customUpdatedDiscussion.body.substring(0, 50) + '...' : 'No body',
      updatedAt: customUpdatedDiscussion.updatedAt,
      pastTitleVersionsCount: customUpdatedDiscussion.PastTitleVersions?.length || 0,
      pastBodyVersionsCount: customUpdatedDiscussion.PastBodyVersions?.length || 0,
    });
    
    // 11. Verify that the old title and body are in the version history
    const hasPreviousTitle = customUpdatedDiscussion.PastTitleVersions?.some(
      version => version.body === updatedDiscussionWithBodyHistory.title
    );
    
    const hasPreviousBody = customUpdatedDiscussion.PastBodyVersions?.some(
      version => version.body === updatedDiscussionWithBodyHistory.body
    );
    
    if (hasPreviousTitle) {
      console.log('✅ SUCCESS: Previous title found in version history after custom update!');
    } else {
      console.log('❌ FAILURE: Previous title not found in version history after custom update.');
    }
    
    if (hasPreviousBody) {
      console.log('✅ SUCCESS: Previous body found in version history after custom update!');
    } else {
      console.log('❌ FAILURE: Previous body not found in version history after custom update.');
    }
    
    // Final summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Retrieving final discussion state...');
    const finalDiscussion = await getDiscussion(TEST_DISCUSSION_ID);
    
    console.log('Final discussion state:', {
      id: finalDiscussion.id,
      title: finalDiscussion.title,
      bodyPreview: finalDiscussion.body ? finalDiscussion.body.substring(0, 50) + '...' : 'No body',
      pastTitleVersionsCount: finalDiscussion.PastTitleVersions?.length || 0,
      pastBodyVersionsCount: finalDiscussion.PastBodyVersions?.length || 0,
    });
    
    // Print all version history
    console.log('\nTitle version history:');
    finalDiscussion.PastTitleVersions?.forEach(version => {
      console.log(`- ${version.createdAt}: "${version.body}" (by ${version.Author?.username})`);
    });
    
    console.log('\nBody version history:');
    finalDiscussion.PastBodyVersions?.forEach(version => {
      const bodyPreview = version.body ? version.body.substring(0, 50) + '...' : 'No body';
      console.log(`- ${version.createdAt}: "${bodyPreview}" (by ${version.Author?.username})`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testVersionHistory();