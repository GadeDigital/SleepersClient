import type { GalaxyPosition } from '../../cubes';

/**
 * The mockup player's galaxy position, just above the galactic plane, in the
 * game's centred convention (ADR 054, brief section 6.8).
 */
export const YOU: GalaxyPosition = { x: 24163, y: -6143, z: 24 };

export interface LevelInfo {
	name: string;
	desc: string;
}

/** Names and descriptions of the six zooms, from the reference's INFO table. */
export const INFO: Readonly<Record<number, LevelInfo>> = {
	1: {
		name: 'Interior',
		desc: 'Room modules joined by corridors, seen as a cutaway. Click the floor to walk. Offline crew sleep in the pods. Walk to the ring on the bridge to use the nav station.'
	},
	2: {
		name: 'Exterior',
		desc: 'Anyone aboard can look outside. Each room is its own hull module and the corridors are tubes between them, all built from the deck plan you just walked.'
	},
	3: {
		name: 'Neighbourhood',
		desc: '100 ly of space in 10 ly cubes. You are in the amber cube. The dashed line is the plotted route and the teal haze shows how far each Hydra node reaches. You are outside both, so no news gets through.'
	},
	4: {
		name: 'Local cell',
		desc: '1,000 ly in 100 ly cubes. The galactic plane runs along the floor of this cell, so that is where the stars gather. Hydra nodes are small scattered points here, and there is an uncharted nebula to explore.'
	},
	5: {
		name: 'Region',
		desc: 'A 10,000 ly slice of the galaxy in 1,000 ly cubes. This is the upper half of the disc, so the stars crowd the floor, where the galactic plane is, and thin out towards the top.'
	},
	6: {
		name: 'Galaxy',
		desc: 'The Milky Way at full scale in 10,000 ly cubes: 10 × 10 across and two layers deep. Your region is the amber cube, in the upper layer just above the galactic plane.'
	}
};
