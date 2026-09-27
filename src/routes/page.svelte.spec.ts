import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('sets the title to Sleepers', async () => {
		render(Page);

		await expect.poll(() => document.title).toBe('Sleepers');
	});
});
