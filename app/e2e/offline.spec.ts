import { test } from './fixtures';
import { mouseWalk } from './mouse-walk';

test('demo walkthrough with the network switched off', async ({ page, context, walk }) => {
  await mouseWalk(page, walk, {
    afterLoad: async () => {
      await context.route('**/*', (route) => route.abort('internetdisconnected'));
      await context.setOffline(true);
    },
  });
});
