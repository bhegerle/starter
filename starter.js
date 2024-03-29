function removeAll(selector) {
    for (let e of document.querySelectorAll(selector))
        e.remove();
}

function appendElement(tag, parent, innerHTML) {
    const e = document.createElement(tag);
    if (innerHTML != null)
        e.innerHTML = innerHTML;
    parent.appendChild(e);
    return e;
}

function insertElementBefore(tag, sibling, innerHTML) {
    const e = document.createElement(tag);
    if (innerHTML != null)
        e.innerHTML = innerHTML;
    sibling.parentElement.insertBefore(e, sibling);
    return e;
}

class AsyncQueue {
    constructor() {
        this.queued = [];
        this.promised = [];
    }

    async dequeue() {
        if (this.queued.length > 0) {
            return this.queued.shift();
        } else {
            const p = new Promise(r => this.promised.push(r));
            return await p;
        }
    }

    enqueue(x) {
        if (this.promised.length > 0) {
            const r = this.promised.shift();
            r(x);
        } else {
            this.queued.push(x);
        }
    }
}

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

function extractImageData(element) {
    const canvas = document.createElement('canvas');
    canvas.width = element.width;
    canvas.height = element.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(element, 0, 0);

    const imgData = ctx.getImageData(0, 0, element.width, element.height);
    canvas.remove();

    return imgData;
}

const isImage = /\.(png|jpeg)$/;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class AnimationClock {
    constructor(rate) {
        this.duration = 1 / rate;
        this.lastTick = performance.now();
    }

    async tick() {
        const now = performance.now();
        const ticks = parseInt((now - this.lastTick) / this.duration) + 1;
        const nextTick = this.lastTick + ticks * this.duration;
        await timeout(nextTick - now);
        this.lastTick = nextTick;
        return ticks;
    }
}

/**
 * Load all of the resources in a directory and its subdirectories, and 
 * convert JSON files to objects and image files (.png, .jpeg) to ImageData
 * @param {string} directory The virtual parent directory
 * @returns A map from virtual path to either the object, string or ImageData
 */
async function getResourceMap(directory) {
    async function getResource(path) {
        if (isImage.test(path)) {
            const img = new Promise(resolve => {
                const img = new Image();
                img.src = path;
                img.onload = () => resolve(img);
            });
            return extractImageData(await img);
        } else {
            const response = await fetch(path);
            if (response.headers.get('Content-Type') === 'application/json')
                return await response.json();
            else
                return response.body;
        }
    }

    const paths = await post('/find', directory);
    const tasks = paths.map(getResource);

    const map = {};
    for (let i = 0; i < paths.length; i++) {
        let p = paths[i];
        if (p.startsWith(directory))
            p = p.substring(directory.length);
        map[p] = await tasks[i];
    }

    return map;
}

function setStyle() {
    const s = `
    html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    canvas {
        image-rendering: pixelated;
    }
    
    .fill-viewport {
        height: 100vh;
        width: 100vw;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .fill-viewport > * {
        transform: scale(1);
    }
    
    .text-mode {
        flex-direction: column;
    }

    .text-mode *, .char-mode * {
        font-family: monospace;
        color: black;
        background-color: transparent;
        font-size: 12px;
        height: 14px;
        padding: 0;
    }

    .text-mode > :last-child {
        display: flex;
    }

    .text-mode input {
        border: none;
        outline: none;
    }

    .char-mode {
        display: grid;
        cursor: default;
    }
    `;

    removeAll('style');
    appendElement('style', document.head, s);
}

function getZoom(element) {
    const t = window.getComputedStyle(element).transform;
    const m = /^matrix\(([.0-9]+), 0, 0, \1, 0, 0\)$/.exec(t);
    return m ? parseFloat(m[1]) : null;
}

function autoZoom(child) {
    const parent = child.parentElement;
    parent.setAttribute('class', 'fill-viewport');

    function zoom() {
        const pr = parent.getBoundingClientRect();
        const cr = child.getBoundingClientRect();

        let z = getZoom(child);
        if (!z)
            return;

        if (cr.width / cr.height < pr.width / pr.height)
            z *= pr.height / cr.height;
        else
            z *= pr.width / cr.width;

        child.style.transform = `scale(${z})`;
    }

    const ro = new ResizeObserver(zoom);
    ro.observe(parent);
    ro.observe(child);

    zoom();
}

function autoSize(child, aspectRatio) {
    const parent = child.parentElement;
    parent.setAttribute('class', 'fill-viewport');

    function zoom() {
        const pr = parent.getBoundingClientRect();

        if (pr.width / pr.height < aspectRatio) {
            child.width = pr.width;
            child.height = pr.width / aspectRatio;
        } else {
            child.width = pr.height * aspectRatio;
            child.height = pr.height;
        }
    }

    new ResizeObserver(zoom).observe(parent);

    zoom();
}

function isLeadingSurrogate(c) {
    return 0xd800 <= c && c <= 0xdfff;
}

function* breakText(s, n) {
    for (let r of s.split('\n')) {
        while (r.length > n) {
            const x = isLeadingSurrogate(r.charCodeAt(n - 1)) ? n - 1 : n;
            yield r.substring(0, x);
            r = r.substring(x);
        }

        yield r;
    }
}

const docEvts = {
    registered: [],

    add(type, listener) {
        document.addEventListener(type, listener);
        this.registered.push({ type, listener });
    },

    removeAll() {
        while (this.registered.length > 0) {
            const { type, listener } = this.registered.shift();
            document.removeEventListener(type, listener);
        }
    }
};

class TextModeInterface {
    constructor(parent, cols, rows) {
        if (cols < 2 || rows < 1)
            throw Error('bad dimensions');

        this.parent = parent;
        this.cols = cols;
        this.rows = rows;
        this.inputQueue = new AsyncQueue();

        parent.setAttribute('class', 'text-mode');

        for (let i = 0; i < rows; i++)
            appendElement('div', parent);

        const idiv = appendElement('div', parent);
        const prompt = appendElement('input', idiv);
        this.input = appendElement('input', idiv);

        prompt.disabled = true;
        prompt.value = '>';
        prompt.size = 1;

        this.input.size = cols;
        this.input.focus();

        this.input.addEventListener('focus', () => {
            this.input.selectionStart = this.input.value.length;
        });

        docEvts.add('keydown', evt => {
            if (evt.target === this.input) {
                if (evt.code === 'Enter') {
                    this.inputQueue.enqueue(this.input.value);
                    this.input.value = '';
                } else if (evt.code === 'Escape') {
                    this.input.value = '';
                }
            } else if (!evt.ctrlKey) {
                this.input.focus();
                this.input.dispatchEvent(new KeyboardEvent(evt.type, evt));
            }
        });
    }

    /**
     * Write text at the bottom, breaking the line if it is too long
     * @param {string} s Text to write at the bottom of the interface
     */
    writeLine(s) {
        s = s.replace(/ /g, '\u00a0');
        for (let m of breakText(s, this.cols)) {
            this.parent.children[0].remove();
            const line = insertElementBefore('div', this.input.parentElement);
            line.innerText = m;
        }
    }

    /**
     * Reads a line of text from the interface
     * @returns string Input entered before pressing return
     */
    async readLine() {
        return await this.inputQueue.dequeue();
    }
}

/**
 * A map to the keyCode values returned by readKey methods for common
 * keyboard layouts
 */
const keyCodes = {
    backspace: 8, tab: 9, enter: 13, shift: 16, control: 17, alt: 18, capsLock: 20, escape: 27, ' ': 32,
    pageUp: 33, pageDown: 34, end: 35, home: 36, left: 37, up: 38, right: 39, down: 40,
    insert: 45, delete: 46,
    0: 48, 1: 49, 2: 50, 3: 51, 4: 52, 5: 53, 6: 54, 7: 55, 8: 56, 9: 57,
    a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72, i: 73,
    j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80, q: 81, r: 82,
    s: 83, t: 84, u: 85, v: 86, w: 87, x: 88, y: 89, z: 90,
    f1: 112, f2: 113, f3: 114, f4: 115, f5: 116, f6: 117, f7: 118, f8: 119, f9: 120, f10: 121, f11: 122, f12: 123,
    ';': 186, '=': 187, ',': 188, '-': 189, '.': 190,
    '/': 191, '`': 192, '[': 219, '/': 220, ']': 221, '\'': 222
};

function createKeyEventQueue() {
    const keyQueue = new AsyncQueue();

    docEvts.add('keydown', evt => {
        if (evt.keyCode !== 116)
            evt.preventDefault();

        if (!evt.repeat)
            keyQueue.enqueue({
                keyCode: evt.keyCode,
                down: true
            });
    });

    docEvts.add('keyup', evt => {
        keyQueue.enqueue({
            keyCode: evt.keyCode,
            down: false
        });
    });

    return keyQueue;
}

function createPointerEventQueue(element, logicalWidth, logicalHeight) {
    const ptrQueue = new AsyncQueue();

    let down = false;

    function enqueuePtrEvt(evt, click, release) {
        const r = element.getBoundingClientRect();
        const x = (evt.clientX - r.left + 0.5) * logicalWidth / r.width;
        const y = (evt.clientY - r.top + 0.5) * logicalHeight / r.height;

        down = click ? true : release ? false : down;

        ptrQueue.enqueue({
            y, x, down, click, release,
            in: 0 < x && x < logicalWidth && 0 < y && y < logicalHeight
        });
    }

    element.addEventListener('pointerdown', evt => {
        element.setPointerCapture(evt.pointerId);
        evt.preventDefault();
        enqueuePtrEvt(evt, true, false);
    });

    element.addEventListener('pointermove', evt => enqueuePtrEvt(evt, false, false));
    element.addEventListener('pointerup', evt => enqueuePtrEvt(evt, false, true));

    return ptrQueue;
}

const printableRegEx = /\p{L}|\p{N}|\p{S}|\p{P}/u;
const charStyles = ['fontStyle', 'fontWeight', 'textDecoration', 'color', 'backgroundColor'];

class CharacterModeInterface {
    constructor(parent, cols, rows) {
        if (cols < 1 || rows < 1)
            throw Error('bad dimensions');

        this.parent = parent;
        this.cols = cols;
        this.rows = rows;

        parent.setAttribute('class', 'char-mode');
        parent.setAttribute('style', `grid-template-columns: repeat(${cols}, auto); grid-template-rows: repeat(${rows}, auto);`);
        for (let i = 0; i < rows * cols; i++)
            appendElement('div', parent, '\u00a0');

        this.keyQueue = createKeyEventQueue();
        this.ptrQueue = createPointerEventQueue(parent, cols, rows);
    }

    /**
     * Read the next key press or release event
     * @returns Object with keyCode and down flag
     */
    async readKey() {
        return await this.keyQueue.dequeue();
    }

    /**
     * Read the next mouse event (which could be out of bounds if dragging)
     * @returns Object with row, col, and flags (down, click, release, in)
     */
    async readPtr() {
        const evt = await this.ptrQueue.dequeue();
        return {
            row: parseInt(evt.y),
            col: parseInt(evt.x),
            down: evt.down,
            click: evt.click,
            release: evt.release,
            in: evt.in
        };
    }

    getElement(col, row) {
        if (0 <= col && col < this.cols && 0 <= row && row < this.rows)
            return this.parent.children[row * this.cols + col];
        else
            return null;
    }

    /**
     * Write a single character to the screen
     * @param {string} c Character to write
     * @param {number} col Horizontal location
     * @param {number} row Vertical location
     */
    writeChar(c, col, row) {
        const e = this.getElement(col, row);
        if (e != null) {
            const m = printableRegEx.exec(c.charAt(0));
            c = m != null ? m[0] : '\u00a0';
            e.innerText = c;
        }
    }

    /**
     * Read a single character from the string
     * @param {number} col Horizontal location
     * @param {number} row Vertical location
     * @returns Chararacter
     */
    readChar(col, row) {
        const e = this.getElement(col, row);
        return e != null ? e.innerText : null;
    }

    /**
     * Change the fontStyle, fontWeight, textDecoration, color, or backgroundColor of a character
     * @param {object} style Map of styles to change
     * @param {number} col Horizontal location
     * @param {number} row Vertical location
     */
    setCharStyle(style, col, row) {
        const e = this.getElement(col, row);
        if (e != null)
            for (let p of charStyles)
                if (style[p])
                    e.style[p] = style[p];
    }

    /**
     * Get the styles which have been at of a character
     * @param {number} col Horizontal location
     * @param {number} row Vertical location
     * @returns Map of setCharStyle change
     */
    getCharStyle(col, row) {
        const e = this.getElement(col, row);
        if (e != null && e.style != null) {
            const style = {};
            for (let p of charStyles)
                style[p] = e.style[p];
            return style;
        } else {
            return null;
        }
    }
}

class PixelModeInterface {
    constructor(element, width, height) {
        this.width = width;
        this.height = height;
        this.ctx = element.getContext("2d");

        this.keyQueue = createKeyEventQueue();
        this.ptrQueue = createPointerEventQueue(element, width, height);
    }

    /**
     * Read the next key press or release event
     * @returns Object with keyCode and down flag
     */
    async readKey() {
        return await this.keyQueue.dequeue();
    }

    /**
     * Read the next mouse event (which could be out of bounds if dragging)
     * @returns Object with x, y, and flags (down, click, release, in)
     */
    async readPtr() {
        const evt = await this.ptrQueue.dequeue();
        evt.x = parseInt(evt.x);
        evt.y = parseInt(evt.y);
        return evt;
    }

    /**
     * Write a single pixel to the screen
     * @param {color} pxl Object with r, g, b and (optional) a
     * @param {number} x Horizontal location
     * @param {number} y Vertical location
     */
    writePixel(pxl, x, y) {
        const b = new Uint8ClampedArray(4);
        b[0] = pxl.r;
        b[1] = pxl.g;
        b[2] = pxl.b;
        b[3] = pxl.a != null ? pxl.a : 255;

        this.writeImageRect(new ImageData(b, 1), x, y, 0, 0, 1, 1);
    }

    /**
     * Read a single pixel from the screen
     * @param {number} x Horizontal location
     * @param {number} y Vertical location
     * @returns Object with r, g, b and (optional) a
     */
    readPixel(x, y) {
        const img = this.readImage(x, y, 1, 1);
        return {
            r: img.data[0],
            g: img.data[1],
            b: img.data[2],
            a: img.data[3],
        };
    }

    /**
     * Write an entire image to the screen
     * @param {ImageData} img RGBA image data
     * @param {number} x Horizontal location of top-left of the destination
     * @param {number} y Vertical location of top-left of the destination
     */
    writeImage(img, x, y) {
        this.writeImageRect(img, x, y, 0, 0, img.width, img.height);
    }

    /**
     * Read a portion the screen as an image image from the source rectangle on the screen
     * @param {ImageData} img RGBA image data
     * @param {number} x Horizontal location of top-left of the source
     * @param {number} y Vertical location of top-left of the source
     * @param {number} width Horizontal size of the source
     * @param {number} height Vertical size of the source
     * @returns RGBA image data
     */
    readImage(x, y, width, height) {
        return this.ctx.getImageData(x, y, width, height);
    }

    /**
     * Write a portion of the image to the screen
     * @param {ImageData} img RGBA image data
     * @param {number} x Horizontal location of top-left of the destination
     * @param {number} y Vertical location of top-left of the destination
     * @param {number} ix Horizontal location of top-left of the source 
     * @param {number} iy Vertical location of top-left of the source 
     * @param {number} iwidth Horizontal size of the source 
     * @param {number} iheight Vertical size of top-left in the source 
     */
    writeImageRect(img, x, y, ix, iy, iwidth, iheight) {
        this.ctx.putImageData(img, x, y, ix, iy, iwidth, iheight);
    }
}

class GraphicsModeInterface {
    constructor(element) {
        this.ctx = element.getContext("2d");

        this.keyQueue = createKeyEventQueue();
        // this.ptrQueue = createPointerEventQueue(element, width, height);
    }

    get width() { return this.ctx.canvas.width; }
    get height() { return this.ctx.canvas.height; }
}

function modeSwitch() {
    document.body.innerHTML = '';
    docEvts.removeAll();
    setStyle();
}

/**
 * Enter text mode for line-by-line output with an input line 
 * to capture typing as it happens
 * @param {number} cols The length of each line
 * @param {number} rows The number of lines
 * @returns a TextModeInterface object
 */
function textMode(cols, rows) {
    modeSwitch();
    const div = appendElement('div', appendElement('div', document.body));
    autoZoom(div);
    return new TextModeInterface(div, cols, rows);
}

/**
 * Enter character mode for direct character access with keystroke and mouse input
 * @param {number} cols Horizontal characters
 * @param {number} rows Vertical characters
 * @returns a CharacterModeInterface object
 */
function charMode(cols, rows) {
    modeSwitch();
    const div = appendElement('div', appendElement('div', document.body));
    autoZoom(div);
    return new CharacterModeInterface(div, cols, rows);
}

/**
 * Enter graphics with direct pixel access with keystroke and mouse input
 * @param {number} width Horizontal pixels
 * @param {number} height Vertical pixels 
 * @returns a PixelModeInterface object
 */
function pixelMode(width, height) {
    modeSwitch();
    const canvas = appendElement('canvas', appendElement('div', document.body));
    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    autoZoom(canvas);
    return new PixelModeInterface(canvas, width, height);
}

function graphicsMode(aspectRatio) {
    modeSwitch();
    const canvas = appendElement('canvas', appendElement('div', document.body));
    autoSize(canvas, aspectRatio);
    return new GraphicsModeInterface(canvas);
}

export { textMode, charMode, pixelMode, graphicsMode, keyCodes, getResourceMap, AnimationClock };
