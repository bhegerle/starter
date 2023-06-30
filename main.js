import { textMode, charMode, pixelMode, keyCodes } from './starter.js';

async function post(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

async function getContents(directory) {
    async function asyncGet(path) {
        if (path.endsWith('.png')) {
            return new Promise(resolve => {
                const img = new Image();
                img.src = path;
                img.onload = () => resolve(img);
            });
        } else {
            const response = await fetch(path);
            if (response.headers.get('Content-Type') === 'application/json')
                return await response.json();
            else
                return response.body;
        }
    }

    const paths = await post('/find', directory);
    const tasks = paths.map(asyncGet);

    const map = {};
    for (let i = 0; i < paths.length; i++)
        map[paths[i]] = await tasks[i];

    return map;
}

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
    '#char': charDemo
};

function showMenu() {
    document.body.innerHTML = `
        <div style="font-family: sans-serif;">
            <p><a href="#txt">text echo</a></p>
            <p><a href="#char">char paint</a></p>
            <p><a href="#pxl">pixel paint</a></p>
            <p><a href="#gfx">2D graphics</a></p>
        </div>`;
}

function nav() {
    const mode = navMap[document.location.hash] || showMenu;
    mode();
}

window.onhashchange = nav;
nav();