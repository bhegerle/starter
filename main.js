import { textMode, charMode, pixelMode, keyCodes, getResourceMap } from './starter.js';

async function txtDemo() {
    const txt = textMode(80, 25);

    txt.writeLine('Hello!');

    while (true) {
        const s = await txt.readLine();
        txt.writeLine(s);
    }
}

async function charDemo() {
    const keyCharacters = {};
    for (let k in keyCodes)
        if (k.length === 1)
            keyCharacters[keyCodes[k]] = k;

    const char = charMode(80, 25);

    let c = '#';

    async function readKeys() {
        while (true) {
            const k = await char.readKey();
            if (k.down && k.keyCode in keyCharacters)
                c = keyCharacters[k.keyCode];
        }
    }

    async function readPtr() {
        while (true) {
            const ptr = await char.readPtr();
            if (ptr.down && ptr.in)
                char.writeChar(c, ptr.col, ptr.row);
            console.log(ptr);
        }
    }

    readKeys();
    readPtr();
}

async function imageDemo() {
    const pxl = pixelMode(128, 128);
    const res = await getResourceMap('content/');

    const img = res['img.png'];
    const color = res['msg.json'].borderColor;

    pxl.writeImage(img, 10, 10);

    for (let x = 9; x < img.width + 11; x++) {
        pxl.writePixel(color, x, 9);
        pxl.writePixel(color, x, img.height + 10);
    }

    for (let y = 10; y < img.height + 10; y++) {
        pxl.writePixel(color, 9, y);
        pxl.writePixel(color, img.width + 10, y);
    }
}

async function pxlDemo() {
    const pxl = pixelMode(30, 30);

    while (true) {
        const ptr = await pxl.readPtr();
        if (ptr.down && ptr.in)
            pxl.writePixel({ r: 240, g: 213, b: 100 }, ptr.x, ptr.y);
    }
}

const navMap = {
    '#pxl': pxlDemo,
    '#txt': txtDemo,
    '#char': charDemo,
    '#img': imageDemo
};

function showMenu() {
    document.body.innerHTML = `
        <div style="font-family: sans-serif;">
            <p><a href="#txt">text echo</a></p>
            <p><a href="#char">char paint</a></p>
            <p><a href="#pxl">pixel paint</a></p>
            <p><a href="#img">image demo</a></p>
            <p><a href="#gfx">2D graphics</a></p>
        </div>`;
}

function nav() {
    const mode = navMap[document.location.hash] || showMenu;
    mode();
}

window.onhashchange = nav;
nav();