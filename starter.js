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

function getZoom(element) {
    const t = window.getComputedStyle(element).transform;
    const m = /^matrix\(([.0-9]+)/.exec(t);
    return parseFloat(m[1]);
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

function setStyle() {
    const s = `
    html, body {
        margin: 0;
        padding: 0;
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
        display: flex;
        flex-direction: column;
    }

    .text-mode * {
        font-family: monospace;
        color: black;
        background-color: transparent;
        font-size: 12px;
        height: 14px;
        padding: 0;
    }

    .text-mode :last-child {
        display: flex;
    }

    .text-mode input {
        border: none;
        outline: none;
    }
    `;

    removeAll('style');
    appendElement('style', document.head, s);
}

function autoZoomChild(parent) {
    parent.setAttribute('class', 'fill-viewport');
    const child = parent.querySelector('*');
    const ro = new ResizeObserver(_ => {
        const pr = parent.getBoundingClientRect();
        const cr = child.getBoundingClientRect();

        let z = getZoom(child);
        if (cr.width / cr.height < pr.width / pr.height)
            z *= pr.height / cr.height;
        else
            z *= pr.width / cr.width;

        child.style.transform = `scale(${z})`;
    });
    ro.observe(parent);
    ro.observe(child);
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

    writeLine(s) {
        for (let m of breakText(s, this.cols)) {
            this.parent.children[0].remove();
            const line = insertElementBefore('div', this.input.parentElement);
            line.innerText = m;
        }
    }

    async readLine() {
        return await this.inputQueue.dequeue();
    }
}

function cleanup() {
    document.body.innerHTML = '';
    docEvts.removeAll();
}

function textMode(cols, rows) {
    cleanup();
    setStyle();
    const parent = appendElement('div', document.body);
    const tmiDiv = appendElement('div', parent);
    autoZoomChild(parent);
    return new TextModeInterface(tmiDiv, cols, rows);
}

export { textMode };
