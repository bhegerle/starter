import { textMode, pixelMode, keyCodes } from './starter.js';

async function txtDemo() {
    const txt = textMode(80, 25);

    txt.writeLine('Hello!');

    while (true) {
        const s = await txt.readLine();
        txt.writeLine(s);
    }
}

async function pxlDemo() {
    const pxl = pixelMode(30, 30);

    while (true) {
        const ptr = await pxl.readPtr();
        if (ptr.in)
            pxl.writePixel({ r: 240, g: 213, b: 100 }, ptr.x, ptr.y);
    }
}

const navMap = {
    '#pxl': pxlDemo,
    '#txt': txtDemo
};

function showMenu() {
    document.body.innerHTML = `
        <div style="font-family: sans-serif;">
            <p><a href="#txt">text-mode</a></p>
            <p><a href="#pxl">pixel-graphics</a></p>
        </div>`;
}

function nav() {
    const mode = navMap[document.location.hash] || showMenu;
    mode();
}

window.onhashchange = nav;
nav();