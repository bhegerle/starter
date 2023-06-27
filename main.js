import { charMode, textMode, keyCodes } from './starter.js';

const txt = textMode(80, 25);
txt.writeLine('################################################################################');

const char = charMode(80, 25);

const keyCharacters = {};
for (let k in keyCodes)
    keyCharacters[keyCodes[k]] = k;

for (let i = 0; i < 80; i++)
    for (let j = 0; j < 25; j++)
        char.writeChar('*', i, j);

async function readPtrs() {
    while (true) {
        const p = await char.readPtr();
        if (p.in)
            char.writeChar('#', p.col, p.row);
    }
}

readPtrs();

let x = 0, y = 0;
while (true) {
    const k = await char.readKey();
    if (k.down) {
        if (k.keyCode == keyCodes.up) y--;
        if (k.keyCode == keyCodes.down) y++;
        if (k.keyCode == keyCodes.left) x--;
        if (k.keyCode == keyCodes.right) x++;
        console.log(char.readChar(x, y));
        console.log(char.getCharStyle(x, y));
        char.writeChar('x', x, y);
        char.setCharStyle({ color: 'gray' }, x, y)
    }
}

