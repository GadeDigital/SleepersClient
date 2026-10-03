<script lang="ts">
	// The zoom-ladder mockup is for design work, in development only (ADR
	// 053). Its code is loaded on demand: Vite replaces import.meta.env.DEV
	// with false in a production build, so the import below, and everything
	// under views/mock, is left out of the production bundle.
	const mockup = import.meta.env.DEV ? import('$lib/render/views/mock/MockupPage.svelte') : null;
</script>

{#if mockup}
	{#await mockup then m}
		<m.default />
	{/await}
{/if}
