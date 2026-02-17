/* import './style.css' */
import { IsometricCanvas } from './render.ts';
import { get_sphere } from './sphere.ts';
import { minecraftBlocks, type BlockShape, type Coords3d} from './counter.ts'
import * as nbt from "nbtify";
const canvasElement = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvasElement) {
    throw new Error("Canvas element not found");
}
const canvas: HTMLCanvasElement = canvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Cannot build context");
}

const slider_radius = document.getElementById('slider-radius') as HTMLInputElement;
const label_radius = document.getElementById('label-radius') as HTMLLabelElement;

const slider_cut = document.getElementById('slider-cut') as HTMLInputElement;
const label_cut = document.getElementById('label-cut') as HTMLLabelElement;

const resetEccentricity = document.getElementById('reset-eccentricity') as HTMLButtonElement;
const slider_eccentricity = document.getElementById('slider-eccentricity') as HTMLInputElement;
const label_eccentricity = document.getElementById('label-eccentricity') as HTMLLabelElement;

const cornerUse = document.getElementById('corner-use') as HTMLSelectElement;
const ensureSymmetry = document.getElementById('ensure-symmetry') as HTMLInputElement;
const exportHollow = document.getElementById('export-hollow') as HTMLInputElement;

const exportNBT = document.getElementById("export-button") as HTMLButtonElement;

var blocks: Array<[BlockShape, Coords3d]> = []
var radius: number = 13
var cut: number = 7
var eccentricity: number = 0
var isometric_canvas: IsometricCanvas = new IsometricCanvas(
    ctx, [0,0,0],[],["#933DF0", "#5F0EB5", "#C392F7"]
)

// utility functions

function computeCut(radius: number, eccentricity: number): number {
    const e = Math.max(-0.999, Math.min(0.999, eccentricity / 100));

    let polarRadius: number;

    if (e === 0) {
        polarRadius = radius;
    } 
    else if (e < 0) {
        // oblate
        const absE = Math.abs(e);
        polarRadius = radius * Math.sqrt(1 - absE * absE);
    } 
    else {
        // prolate
        polarRadius = radius / Math.sqrt(1 - e * e);
    }

    return Math.floor(polarRadius / 2);
}

function computePolarRadius(radius: number, eccentricity: number): number {
    const e = Math.max(-0.999, Math.min(0.999, eccentricity / 100));

    if (e === 0) return radius;

    if (e < 0) {
        const absE = Math.abs(e);
        return radius * Math.sqrt(1 - absE * absE);
    }

    return radius / Math.sqrt(1 - e * e);
}

type BlockState = {
    Name: string;
    Properties?: Record<string, string>;
};

const BLOCK_STATES_BY_INDEX: Record<number, BlockState> = {
    0: { Name: "minecraft:stone_bricks" },
    1: { Name: "minecraft:stone_brick_slab", Properties: { type: "bottom", waterlogged: "false" } },
    2: { Name: "minecraft:stone_brick_slab", Properties: { type: "top", waterlogged: "false" } },
    3: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "bottom", shape: "straight", waterlogged: "false" } },
    4: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "bottom", shape: "straight", waterlogged: "false" } },
    5: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "bottom", shape: "straight", waterlogged: "false" } },
    6: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "bottom", shape: "straight", waterlogged: "false" } },
    7: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "top", shape: "straight", waterlogged: "false" } },
    8: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "top", shape: "straight", waterlogged: "false" } },
    9: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "top", shape: "straight", waterlogged: "false" } },
    10: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "top", shape: "straight", waterlogged: "false" } },
    11: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "bottom", shape: "outer_left", waterlogged: "false" } },
    12: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "bottom", shape: "outer_left", waterlogged: "false" } },
    13: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "bottom", shape: "outer_left", waterlogged: "false" } },
    14: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "bottom", shape: "outer_left", waterlogged: "false" } },
    15: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "top", shape: "outer_left", waterlogged: "false" } },
    16: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "top", shape: "outer_left", waterlogged: "false" } },
    17: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "top", shape: "outer_left", waterlogged: "false" } },
    18: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "top", shape: "outer_left", waterlogged: "false" } },
    19: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "bottom", shape: "inner_left", waterlogged: "false" } },
    20: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "bottom", shape: "inner_left", waterlogged: "false" } },
    21: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "bottom", shape: "inner_left", waterlogged: "false" } },
    22: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "bottom", shape: "inner_left", waterlogged: "false" } },
    23: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "north", half: "top", shape: "inner_left", waterlogged: "false" } },
    24: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "east", half: "top", shape: "inner_left", waterlogged: "false" } },
    25: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "west", half: "top", shape: "inner_left", waterlogged: "false" } },
    26: { Name: "minecraft:stone_brick_stairs", Properties: { facing: "south", half: "top", shape: "inner_left", waterlogged: "false" } },
};

const HALF_UNIT_DIRECTIONS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
] as const;

const blockIndexByShape = new Map<BlockShape, number>(
    minecraftBlocks.map((shape, idx) => [shape, idx] as [BlockShape, number])
);

function toInt(value: number): nbt.Int32 {
    return new nbt.Int32(Math.trunc(value));
}

function getBlockStateKey(state: BlockState): string {
    if (!state.Properties) {
        return state.Name;
    }
    const keys = Object.keys(state.Properties).sort();
    const props = keys.map((key) => `${key}=${state.Properties![key]}`).join(",");
    return `${state.Name}|${props}`;
}

function getBlockStateForShape(shape: BlockShape): BlockState {
    const index = blockIndexByShape.get(shape) ?? 0;
    return BLOCK_STATES_BY_INDEX[index] ?? BLOCK_STATES_BY_INDEX[0];
}

function getHalfVoxelCoordsForBlock(shape: BlockShape, coords: Coords3d): Array<[number, number, number]> {
    const [x, y, z] = coords;
    const occupied: Array<[number, number, number]> = [];
    for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
            for (let iz = 0; iz < 2; iz++) {
                if (!shape[ix][iy][iz]) {
                    continue;
                }
                occupied.push([(x * 2) + ix, (y * 2) + iy, (z * 2) + iz]);
            }
        }
    }
    return occupied;
}

function makeHollow(sourceBlocks: Array<[BlockShape, Coords3d]>): Array<[BlockShape, Coords3d]> {
    const occupancy = new Set<string>();
    const halfVoxelsPerBlock: Array<Array<[number, number, number]>> = [];

    for (const [shape, coords] of sourceBlocks) {
        const halfVoxels = getHalfVoxelCoordsForBlock(shape, coords);
        halfVoxelsPerBlock.push(halfVoxels);
        for (const [vx, vy, vz] of halfVoxels) {
            occupancy.add(`${vx},${vy},${vz}`);
        }
    }

    const hollowBlocks: Array<[BlockShape, Coords3d]> = [];
    for (let blockIndex = 0; blockIndex < sourceBlocks.length; blockIndex++) {
        const halfVoxels = halfVoxelsPerBlock[blockIndex];
        let exposed = false;

        for (const [vx, vy, vz] of halfVoxels) {
            for (const [dx, dy, dz] of HALF_UNIT_DIRECTIONS) {
                const neighborKey = `${vx + dx},${vy + dy},${vz + dz}`;
                if (!occupancy.has(neighborKey)) {
                    exposed = true;
                    break;
                }
            }
            if (exposed) {
                break;
            }
        }

        if (exposed) {
            hollowBlocks.push(sourceBlocks[blockIndex]);
        }
    }

    return hollowBlocks;
}

async function exportStructureAsNBT(sourceBlocks: Array<[BlockShape, Coords3d]>, shouldExportHollow: boolean): Promise<void> {
    const exportBlocks = shouldExportHollow ? makeHollow(sourceBlocks) : sourceBlocks;
    if (exportBlocks.length === 0) {
        throw new Error("No blocks available to export.");
    }
    const palette: Array<BlockState> = [];
    const paletteIndexByKey = new Map<string, number>();
    const nbtBlocks: Array<{ pos: [nbt.Int32, nbt.Int32, nbt.Int32], state: nbt.Int32 }> = [];

    let maxX = 0;
    let maxY = 0;
    let maxZ = 0;

    for (const [shape, coords] of exportBlocks) {
        const state = getBlockStateForShape(shape);
        const stateKey = getBlockStateKey(state);
        let paletteIndex = paletteIndexByKey.get(stateKey);
        if (paletteIndex === undefined) {
            paletteIndex = palette.length;
            palette.push(state);
            paletteIndexByKey.set(stateKey, paletteIndex);
        }

        // Generator coords are [x, z, y] where y is vertical in Minecraft.
        const [x, z, y] = coords;
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);

        nbtBlocks.push({
            pos: [toInt(x), toInt(y), toInt(z)],
            state: toInt(paletteIndex),
        });
    }

    const entities: Array<Record<string, never>> & { [nbt.TAG_TYPE]?: nbt.TAG } = [];
    entities[nbt.TAG_TYPE] = nbt.TAG.COMPOUND;

    const structure = {
        DataVersion: toInt(3955),
        size: [toInt(maxX + 1), toInt(maxY + 1), toInt(maxZ + 1)],
        palette: palette.map((entry) => entry.Properties
            ? { Name: entry.Name, Properties: entry.Properties }
            : { Name: entry.Name }),
        blocks: nbtBlocks,
        entities,
    };

    const data = await nbt.write(structure, { compression: "gzip" });
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const solidity = shouldExportHollow ? "hollow" : "solid";
    anchor.href = url;
    anchor.download = `dome-${radius}-${solidity}.nbt`;
    anchor.click();
    URL.revokeObjectURL(url);
}



function read_slider_and_render(){
    if (!canvas) {
        throw new Error("Canvas element not found");
    }
    if (!ctx) {
        throw new Error("Cannot build context");
    }
    const polar = computePolarRadius(radius, eccentricity);
    isometric_canvas = new IsometricCanvas(
        ctx,
        [radius * 2, radius * 2, Math.ceil(polar)],
        blocks,
        ["#933DF0", "#5F0EB5", "#C392F7"]
    )
    // If the spheroid is taller than the base radius (prolate), shift the
    // viewport up by half the additional height so the top becomes visible.
    const extra = Math.max(0, polar - radius);
    if (extra > 0) {
        // world units -> pixels: one z-unit maps to ~`ratio` pixels vertically
        isometric_canvas.origin[1] += (extra / 3.14) * isometric_canvas.ratio;
    }
    isometric_canvas.render(cut=cut);
}


slider_radius.addEventListener('input', () => {
    radius = Number(slider_radius.value);

    cut = computeCut(radius, eccentricity);

    slider_cut.max = String(cut);
    slider_cut.value = String(cut);

    label_cut.textContent = `Cut: ${cut}`;
    label_radius.textContent = `Diameter: ${radius}`;

    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked)
    read_slider_and_render();
});

// user-adjustable cut
slider_cut.addEventListener('input', () => {
    cut = Number(slider_cut.value);
    label_cut.textContent = `Cut: ${cut}`;
    isometric_canvas.render(cut=cut);
});

// eccentricity control
slider_eccentricity.addEventListener('input', () => {
    eccentricity = Number(slider_eccentricity.value);
    label_eccentricity.textContent = `Eccentricity: ${(eccentricity/100).toFixed(2)}`;
    // recompute cut limits based on new eccentricity
    cut = computeCut(radius, eccentricity);
    slider_cut.max = String(cut);
    slider_cut.value = String(cut);
    label_cut.textContent = `Cut: ${cut}`;
    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked);
    read_slider_and_render();
});

resetEccentricity.addEventListener('click', () => {
    eccentricity = 0; // default value

    slider_eccentricity.value = "0";
    label_eccentricity.textContent = `Eccentricity: 0.00`;

    cut = computeCut(radius, eccentricity);
    slider_cut.max = String(cut);
    slider_cut.value = String(cut);
    label_cut.textContent = `Cut: ${cut}`;

    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked);
    read_slider_and_render();
});

cornerUse.addEventListener('change', () => {
    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked)
    read_slider_and_render()
})

ensureSymmetry?.addEventListener('change', () => {
    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry.checked)
    read_slider_and_render()
})

exportNBT.addEventListener("click", async () => {
    exportNBT.disabled = true;
    try {
        await exportStructureAsNBT(blocks, exportHollow?.checked ?? true);
    }
    catch (error) {
        console.error("Failed to export NBT", error);
        alert("Failed to export NBT. Please check the console for details.");
    }
    finally {
        exportNBT.disabled = false;
    }
});

function resizeAndRender() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 100;
    read_slider_and_render();
}

window.addEventListener('resize', resizeAndRender);

blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked)
resizeAndRender()
