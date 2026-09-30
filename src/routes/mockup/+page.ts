import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

// The zoom-ladder mockup is for design work: development builds only (ADR 053).
export function load() {
	if (!dev) error(404, 'Not found');
}
