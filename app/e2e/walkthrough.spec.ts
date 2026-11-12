import { test } from './fixtures';
import { mouseWalk } from './mouse-walk';

test('demo walkthrough with the mouse', async ({ page, walk }) => {
  await mouseWalk(page, walk);
});
