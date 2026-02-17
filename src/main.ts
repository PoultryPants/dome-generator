/* import './style.css' */
import { IsometricCanvas } from './render.ts';
import { get_sphere } from './sphere.ts';
import { type BlockShape, type Coords3d} from './counter.ts'
let canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) {
    throw new Error("Canvas element not found");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
    throw new Error("Cannot build context");
}

const slider_radius = document.getElementById('slider-radius') as HTMLInputElement;
const label_radius = document.getElementById('label-radius') as HTMLLabelElement;

const slider_cut = document.getElementById('slider-cut') as HTMLInputElement;
const label_cut = document.getElementById('label-cut') as HTMLLabelElement;

const slider_eccentricity = document.getElementById('slider-eccentricity') as HTMLInputElement;
const label_eccentricity = document.getElementById('label-eccentricity') as HTMLLabelElement;

const cornerUse = document.getElementById('corner-use') as HTMLSelectElement;
const ensureSymmetry = document.getElementById('ensure-symmetry') as HTMLInputElement;
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

cornerUse.addEventListener('change', () => {
    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked)
    read_slider_and_render()
})

ensureSymmetry?.addEventListener('change', () => {
    blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry.checked)
    read_slider_and_render()
})

window.addEventListener('load', () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 100;
    // set initial visibility for eccentricity control
    read_slider_and_render()
});
window.addEventListener('resize', () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 100;
    read_slider_and_render()
});

blocks = get_sphere(radius, cornerUse.value, eccentricity, ensureSymmetry?.checked)
read_slider_and_render()