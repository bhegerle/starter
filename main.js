import { textMode, charMode, pixelMode, graphicsMode, keyCodes, getResourceMap, AnimationClock } from './starter.js';

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

function cyclicColor(v) {
    return {
        r: 256 * (Math.sin(v / 11) + 1),
        g: 256 * (Math.sin(v / 17) + 1),
        b: 256 * (Math.sin(v / 23) + 1),
    };
}

async function animationDemo() {
    const pxl = pixelMode(30, 30);

    const clock = new AnimationClock(60);

    let t = 0;
    while (true) {
        t += await clock.tick();

        for (let x = 0; x < 30; x++) {
            for (let y = 0; y < 30; y++) {
                const c = cyclicColor(t / 1000 + x + y);
                pxl.writePixel(c, x, y);
            }
        }
    }
}

function mand(x, y, maxIter) {
    let zx = 0, zy = 0;
    let cx = x, cy = y;

    for (let n = 0; n < maxIter; n++) {
        if (zx * zx + zy * zy > 4)
            return n;

        const nx = zx * zx - zy * zy + cx;
        const ny = 2 * zx * zy + cy;

        zx = nx;
        zy = ny;
    }

    return maxIter;
}

async function fractalDemo() {
    const gfx = graphicsMode(16 / 9);

    let w = -1, h = -1;

    let img = null;
    const clock = new AnimationClock(2);
    while (true) {
        await clock.tick();

        if (!(gfx.width === w && gfx.height === h)) {
            w = gfx.width;
            h = gfx.height;

            img = new ImageData(w, h);
            for (let py = 0; py < h; py++) {
                for (let px = 0; px < w; px++) {
                    const n = mand(px / w * 4 - 2, py / h * 4 - 2, 100);
                    const c = cyclicColor(n);
                    const i = 4 * (py * w + px);
                    img.data[i] = c.r;
                    img.data[i + 1] = c.g;
                    img.data[i + 2] = c.b;
                    img.data[i + 3] = 255;
                }
            }

        }

        gfx.ctx.putImageData(img, 0, 0);
    }
}

const navMap = {
    '#pxl': pxlDemo,
    '#txt': txtDemo,
    '#char': charDemo,
    '#img': imageDemo,
    '#anim': animationDemo,
    '#fract': fractalDemo
};

function showMenu() {
    document.body.innerHTML = `
        <div style="font-family: sans-serif;">
            <p><a href="#txt">text echo</a></p>
            <p><a href="#char">char paint</a></p>
            <p><a href="#pxl">pixel paint</a></p>
            <p><a href="#img">image demo</a></p>
            <p><a href="#anim">animation demo</a></p>
            <p><a href="#fract">fractal demo</a></p>
            <!--p><a href="#gfx">2D graphics</a></p-->
        </div>`;
}

function nav() {
    const mode = navMap[document.location.hash] || showMenu;
    mode();
}

window.onhashchange = nav;
nav();