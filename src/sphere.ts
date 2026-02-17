import { type BlockShape, type Coords3d, minecraftBlocks} from './counter.ts'

type BlockTopView = {
    values: number[][]; // 2x2 matrix
    name: string;
    id: number;
};

const blocks: BlockTopView[] = [
    {
        values: [[1, 1], [1, 1]],
        name: "Full",
        id: 0,
    },
    {
        values: [[0, 0], [0, 0]],
        name: "Empty",
        id: -1,
    },
    {
        values: [[0.5, 0.5], [0.5, 0.5]],
        name: "Slab",
        id: 1,
    },
    {
        values: [[0.5, 0.5], [1, 1]],
        name: "Stair1",
        id: 6,
    },
    {
        values: [[0.5, 1], [0.5, 1]],
        name: "Stair2",
        id: 5,
    },
    {
        values: [[1, 1], [0.5, 0.5]],
        name: "Stair3",
        id: 4,
    },
    {
        values: [[1, 0.5], [1, 0.5]],
        name: "Stair4",
        id: 3,
    },
    {
        values: [[0.5, 0.5], [0.5, 1]],
        name: "OuterCornerStair1",
        id: 13,
    },
    {
        values: [[0.5, 0.5], [1, 0.5]],
        name: "OuterCornerStair2",
        id: 14,
    },
    {
        values: [[1, 0.5], [0.5, 0.5]],
        name: "OuterCornerStair3",
        id: 11,
    },
    {
        values: [[0.5, 1], [0.5, 0.5]],
        name: "OuterCornerStair4",
        id: 12,
    },
    {
        values: [[0.5, 1], [1, 1]],
        name: "InnerCornerStair1",
        id: 19,
    },
    {
        values: [[1, 1], [0.5, 1]],
        name: "InnerCornerStair2",
        id: 20,
    },
    {
        values: [[1, 1], [1, 0.5]],
        name: "InnerCornerStair3",
        id: 22, //down
    },
    {
        values: [[1, 0.5], [1, 1]],
        name: "InnerCornerStair4",
        id: 21, // left
    },
];
const blocks_no_corner: BlockTopView[] = blocks.slice(0, 7);


function assignBlock(vals: number[][], use_corner: boolean):  {lift: number, selectedId: number}{
    // Flatten the 2x2 input matrix
    const flatVals = vals.flat().map(v => v / 2);

    // Compute lift
    const lift = Math.floor(Math.min(...flatVals));

    if (flatVals.filter(x => x === 0).length >= 2){
        return {
            lift: 0,
            selectedId: -1
        }
    }

    // Adjust values by subtracting lift
    const adjustedVals = flatVals.map(v => v - lift);

    let minError = Infinity;
    let selectedId = -1;
    const blocks_to_use = use_corner ? blocks : blocks_no_corner;
    for (const block of blocks_to_use) {
        const blockVals = block.values.flat(); // Flatten block's 2x2 matrix
        let error = 0;

        for (let i = 0; i < 4; i++) {
            const diff = blockVals[i] - adjustedVals[i];
            error += diff * diff;
        }

        if (error < minError) {
            minError = error;
            selectedId = block.id;
        }
    }

    return {
        lift: lift,
        selectedId: selectedId,
    };
}


function get2x2Submatrix(data: number[][], i: number, j: number): number[][] {
    const rowStart = 2 * i;
    const colStart = 2 * j;

    return [
        [data[rowStart][colStart],     data[rowStart][colStart + 1]],
        [data[rowStart + 1][colStart], data[rowStart + 1][colStart + 1]]
    ];
}


export function get_sphere(
    radius: number,
    use_corner: string | boolean,
    eccentricity: number = 0,
    ensureSymmetry: boolean = false
    ): Array<[BlockShape, Coords3d]> {

    const size = 2 * radius;
    const data: number[][] = [];
    
    const eRaw = eccentricity / 100;
    const e = Math.max(-0.999, Math.min(0.999, eRaw));

    let zScale = 1;

    if (e < 0) {
        // oblate
        const absE = Math.abs(e);
        zScale = Math.sqrt(1 - absE * absE);
    }
    else if (e > 0) {
        // prolate
        zScale = 1 / Math.sqrt(1 - e * e);
    }


    
    // Generate height data
    for (let i = 0; i < size; i++) {
        const row: number[] = [];
        for (let j = 0; j < size; j++) {
            const x = i + 0.5 - radius;
            const y = j + 0.5 - radius;
            const value = Math.sqrt(Math.max(radius * radius - x * x - y * y, 0)) * zScale;
            row.push(value);
        }
        data.push(row);
    }
    // Normalize mode: 'none' | 'legal' | 'all'
    const mode = (typeof use_corner === 'string') ? use_corner : (use_corner ? 'all' : 'none');

    // First pass: compute lift and selectedId for each 2x2 cell
    const cellResults: {lift: number, selectedId: number}[][] = [];
    for (let i = 0; i < radius; i++) {
        const row: {lift: number, selectedId: number}[] = [];
        for (let j = 0; j < radius; j++) {
            // allow corners on first pass for both 'all' and 'legal'
            const allowCorner = mode === 'all' || mode === 'legal';
            const {lift, selectedId} = assignBlock(get2x2Submatrix(data, i, j), allowCorner)
            row.push({lift, selectedId});
        }
        cellResults.push(row);
    }

    // If legal mode, run a second pass to validate corner stairs
    if (mode === 'legal') {
        // IDs that correspond to corner stairs
        const cornerIds = new Set([11,12,13,14,19,20,21,22]);
        // IDs that correspond to any stair (normal or corner)
        const stairIds = new Set([3,4,5,6,11,12,13,14,19,20,21,22]);

        // Build occupancy map for quick lookup: key = "i,j,k" -> id
        const occupancy = new Map<string, number>();
        for (let i = 0; i < radius; i++) {
            for (let j = 0; j < radius; j++) {
                const {lift, selectedId} = cellResults[i][j];
                for (let k = 0; k < lift; k++) {
                    occupancy.set(`${i},${j},${k}`, 0); // full cube id = 0
                }
                if (selectedId >= 0) {
                    occupancy.set(`${i},${j},${lift}`, selectedId);
                }
            }
        }

        // Validate each corner stair
        for (let i = 0; i < radius; i++) {
            for (let j = 0; j < radius; j++) {
                const cell = cellResults[i][j];
                if (!cornerIds.has(cell.selectedId)) continue;

                const lift = cell.lift;
                // check 4 cardinal neighbors for a stair at same lift
                const neighbors: Array<[number,number]> = [[i-1,j],[i+1,j],[i,j-1],[i,j+1]];
                let hasAdjacentStair = false;
                for (const [ni,nj] of neighbors) {
                    if (ni < 0 || nj < 0 || ni >= radius || nj >= radius) continue;
                    const key = `${ni},${nj},${lift}`;
                    const neighborId = occupancy.get(key);
                    if (neighborId !== undefined && stairIds.has(neighborId)) {
                        hasAdjacentStair = true;
                        break;
                    }
                }

                if (!hasAdjacentStair) {
                    // Replace with best fitting normal stair (no corners)
                    const replacement = assignBlock(get2x2Submatrix(data, i, j), false);
                    cellResults[i][j] = {lift: cell.lift, selectedId: replacement.selectedId};
                    // update occupancy at this position
                    if (replacement.selectedId >= 0) {
                        occupancy.set(`${i},${j},${lift}`, replacement.selectedId);
                    } else {
                        occupancy.delete(`${i},${j},${lift}`);
                    }
                }
            }
        }
    }

    // Optional symmetry pass: convert normal stairs on the two diagonals
    if (ensureSymmetry) {
        const normalStairIds = new Set([3,4,5,6]);
        const fullBlock = blocks.find(b => b.id === 0)!;
        const slabBlock = blocks.find(b => b.id === 1)!;

        const positions: Array<[number, number]> = [];
        for (let t = 0; t < radius; t++) {
            positions.push([t, t]);
            positions.push([t, radius - 1 - t]);
        }
        const seen = new Set<string>();
        for (const [i, j] of positions) {
            const key = `${i},${j}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (i < 0 || j < 0 || i >= radius || j >= radius) continue;
            const cell = cellResults[i][j];
            if (!normalStairIds.has(cell.selectedId)) continue;

            const vals = get2x2Submatrix(data, i, j);
            const flatVals = vals.flat().map(v => v / 2);
            const lift = Math.floor(Math.min(...flatVals));
            const adjustedVals = flatVals.map(v => v - lift);

            const blockValsFull = fullBlock.values.flat();
            const blockValsSlab = slabBlock.values.flat();

            let errFull = 0;
            let errSlab = 0;
            for (let m = 0; m < 4; m++) {
                const df = blockValsFull[m] - adjustedVals[m];
                const ds = blockValsSlab[m] - adjustedVals[m];
                errFull += df * df;
                errSlab += ds * ds;
            }

            const chosenId = errFull <= errSlab ? 0 : 1;
            cellResults[i][j].selectedId = chosenId;
        }
    }

    // Build final block output from cellResults
    const blocks_output: Array<[BlockShape, Coords3d]> = [];
    for (let i = 0; i < radius; i++) {
        for (let j = 0; j < radius; j++) {
            const {lift, selectedId} = cellResults[i][j];
            for (let k = 0; k < lift; k++) {
                blocks_output.push([minecraftBlocks[0], [i, j, k]]);
            }
            if (selectedId >= 0) {
                blocks_output.push([minecraftBlocks[selectedId], [i, j, lift]]);
            }
        }
    }
    return blocks_output;
}