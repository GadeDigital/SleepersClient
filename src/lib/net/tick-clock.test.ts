import { describe, expect, it } from 'vitest';
import { TickClock } from './tick-clock';

describe('TickClock', () => {
	it('counts on from a sample at 10 ticks per second', () => {
		const clock = new TickClock();
		clock.sample(40, 1000);
		expect(clock.now(1000)).toBe(40);
		expect(clock.now(1250)).toBe(42.5);
	});

	it('trusts the least-delayed recent sample', () => {
		const clock = new TickClock();
		clock.sample(40, 1000);
		// Tick 50 should arrive at 2000 but was 300 ms late: ignore the delay.
		clock.sample(50, 2300);
		expect(clock.now(2300)).toBe(53);
	});

	it('forgets samples older than the last ten', () => {
		const clock = new TickClock();
		clock.sample(100, 0); // far ahead, as from before a server restart
		for (let i = 0; i < 10; i++) clock.sample(10 + i, 1000 + i * 100);
		expect(clock.now(2000)).toBe(20);
	});
});
