/**
 * Layout for a virtualized list of rows with different heights: rows not
 * measured yet use an estimate until they are.
 */
export interface Layout {
	/** Top of each row, in pixels. */
	tops: number[];
	/** Height of all rows together. */
	total: number;
}

export function layout(
	count: number,
	heightOf: (i: number) => number | undefined,
	estimate: number
): Layout {
	const tops = new Array<number>(count);
	let y = 0;
	for (let i = 0; i < count; i++) {
		tops[i] = y;
		y += heightOf(i) ?? estimate;
	}
	return { tops, total: y };
}

/**
 * The rows [start, end) that overlap the viewport, plus `overscan` rows on
 * each side so fast scrolling does not show gaps.
 */
export function visibleRange(
	{ tops, total }: Layout,
	scrollTop: number,
	viewport: number,
	overscan: number
): [number, number] {
	const count = tops.length;
	if (count === 0) return [0, 0];
	// The first row whose bottom is below scrollTop, by binary search.
	let lo = 0;
	let hi = count - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		const bottom = mid + 1 < count ? tops[mid + 1] : total;
		if (bottom <= scrollTop) lo = mid + 1;
		else hi = mid;
	}
	let end = lo;
	while (end < count && tops[end] < scrollTop + viewport) end++;
	return [Math.max(0, lo - overscan), Math.min(count, end + overscan)];
}
