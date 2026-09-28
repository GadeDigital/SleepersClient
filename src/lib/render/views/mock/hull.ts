import {
	AdditiveBlending,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Vector3,
	type Sprite
} from 'three';
import { DIRS, FLOOR_TILES, REGION_INDEX, REGIONS, rid, tileToWorld } from './deckplan';
import { box, glowSprite, placed, setInst, type MockTextures } from './helpers';
import type { Rand } from './rng';

/** The moving parts of the hull, animated by the exterior view. */
export interface Hull {
	ship: Group;
	flames: { plume: Mesh; glow: Sprite }[];
	dish: Mesh;
	port: Sprite;
	starboard: Sprite;
	strobe: Sprite;
}

/**
 * The ship's exterior, generated from the deck plan (ADR 055): one hull box
 * per floor tile as tall as its region, roof details on rooms, lit windows,
 * radiator fins, thrusters, a sensor mast and running lights.
 */
export function buildHull(tex: MockTextures, rand: Rand): Hull {
	const ship = new Group();
	const p = new Vector3();

	const hullMat = new MeshStandardMaterial({
		map: tex.panel,
		roughness: 0.75,
		metalness: 0.15,
		flatShading: true
	});
	const hull = new InstancedMesh(box, hullMat, FLOOR_TILES.length);
	const c = new Color();
	FLOOR_TILES.forEach(([x, z], i) => {
		const r = REGIONS[rid(x, z)];
		tileToWorld(x, z, p);
		setInst(hull, i, p.x, 0, p.z, 1, r.height, 1);
		// The main corridor's northern row is an amber stripe.
		const base = r.name === 'Main corridor' && z === 8 ? 0xb7803a : r.hull;
		hull.setColorAt(i, c.set(base).multiplyScalar(0.9 + rand() * 0.14));
	});
	if (hull.instanceColor) hull.instanceColor.needsUpdate = true;
	ship.add(hull);

	// Roof details, only on room tiles not on a module's edge.
	const inner = FLOOR_TILES.filter(([x, z]) => {
		const r = rid(x, z);
		return REGIONS[r].kind === 'room' && DIRS.every(([dx, dz]) => rid(x + dx, z + dz) === r);
	});
	const greeb = new InstancedMesh(
		box,
		new MeshStandardMaterial({ color: 0x5d6578, roughness: 0.8, flatShading: true }),
		40
	);
	for (let i = 0; i < 40; i++) {
		const [x, z] = inner[Math.floor(rand() * inner.length)];
		tileToWorld(x, z, p);
		const h = REGIONS[rid(x, z)].height;
		const sx = 0.25 + rand() * 0.5;
		const sy = 0.12 + rand() * 0.3;
		const sz = 0.25 + rand() * 0.5;
		setInst(
			greeb,
			i,
			p.x + (rand() - 0.5) * 0.4,
			h / 2 + sy / 2,
			p.z + (rand() - 0.5) * 0.4,
			sx,
			sy,
			sz,
			rand() * 1.5
		);
	}
	ship.add(greeb);

	// Lit windows on each room's outer face.
	const warmWin = new MeshBasicMaterial({ color: 0xffd9a0 });
	const bridgeWin = new MeshBasicMaterial({ color: 0x8fe6ea });
	for (const r of REGIONS) {
		if (!r.win) continue;
		const mat = r.name === 'Bridge' ? bridgeWin : warmWin;
		if (r.win === 'e') {
			const x = tileToWorld(r.x + r.w - 1, 0).x + 0.52;
			for (let z = r.z + 1; z < r.z + r.h - 1; z++) {
				const w = new Mesh(box, mat);
				w.scale.set(0.04, 0.32, 0.6);
				w.position.set(x, 0.15, tileToWorld(0, z).z);
				ship.add(w);
			}
		} else {
			const zz =
				r.win === 'n' ? tileToWorld(0, r.z).z - 0.52 : tileToWorld(0, r.z + r.h - 1).z + 0.52;
			for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
				const w = new Mesh(box, mat);
				w.scale.set(0.5, 0.26, 0.04);
				w.position.set(tileToWorld(x, 0).x, 0.15, zz);
				ship.add(w);
			}
		}
	}

	// Radiator fins on the engine room's roof.
	const eng = REGIONS[REGION_INDEX.engine];
	const finMat = new MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.6, flatShading: true });
	for (let i = 0; i < 4; i++) {
		const f = new Mesh(box, finMat);
		tileToWorld(eng.x + 1 + i * 1.5, eng.z + 2, p);
		f.scale.set(0.08, 0.9, 3.2);
		f.position.set(p.x, eng.height / 2 + 0.45, p.z + 0.5);
		ship.add(f);
	}

	// Thrusters and exhaust on the engine room's aft face.
	const flames: Hull['flames'] = [];
	const nozzleMat = new MeshStandardMaterial({
		color: 0x4a5264,
		roughness: 0.6,
		metalness: 0.3,
		flatShading: true
	});
	for (const z of [13, 16]) {
		tileToWorld(eng.x, z, p);
		const noz = new Mesh(new CylinderGeometry(0.5, 0.8, 1.3, 12), nozzleMat);
		noz.rotation.z = -Math.PI / 2;
		noz.position.set(p.x - 1.15, 0, p.z);
		ship.add(noz);
		const length = 5.5;
		const geo = new CylinderGeometry(0.65, 0, length, 14, 1, true);
		geo.translate(0, -length / 2, 0);
		const plume = new Mesh(
			geo,
			new MeshBasicMaterial({
				color: 0x7fc4ff,
				transparent: true,
				opacity: 0.42,
				blending: AdditiveBlending,
				depthWrite: false,
				side: DoubleSide
			})
		);
		plume.rotation.z = -Math.PI / 2;
		plume.position.set(p.x - 1.8, 0, p.z);
		ship.add(plume);
		const glow = glowSprite(tex, 0xa8d6ff, 4, 0.95);
		glow.position.set(p.x - 1.95, 0, p.z);
		ship.add(glow);
		flames.push({ plume, glow });
	}

	// Sensor mast and dish on the bridge roof.
	const br = REGIONS[REGION_INDEX.bridge];
	const mastP = tileToWorld(br.x + 2, br.z + 4);
	const mh = br.height;
	const mast = new Mesh(
		new CylinderGeometry(0.07, 0.1, 1.4, 6),
		new MeshStandardMaterial({ color: 0x8b93a6 })
	);
	mast.position.set(mastP.x, mh / 2 + 0.7, mastP.z);
	ship.add(mast);
	const dish = new Mesh(
		new ConeGeometry(0.6, 0.3, 12, 1, true),
		new MeshStandardMaterial({ color: 0xc9cfda, side: DoubleSide, flatShading: true })
	);
	dish.position.set(mastP.x, mh / 2 + 1.45, mastP.z);
	dish.rotation.x = Math.PI * 0.7;
	ship.add(dish);

	// Running lights: red to port, green to starboard, a white strobe on the mast.
	const bowX = tileToWorld(br.x + br.w - 1, 0).x;
	const port = placed(
		glowSprite(tex, 0xff4a4a, 1.6),
		new Vector3(bowX, 0.3, tileToWorld(0, br.z).z - 0.55)
	);
	const starboard = placed(
		glowSprite(tex, 0x4aff8a, 1.6),
		new Vector3(bowX, 0.3, tileToWorld(0, br.z + br.h - 1).z + 0.55)
	);
	const strobe = placed(
		glowSprite(tex, 0xffffff, 2.2),
		new Vector3(mastP.x, mh / 2 + 1.75, mastP.z)
	);
	ship.add(port, starboard, strobe);

	return { ship, flames, dish, port, starboard, strobe };
}
