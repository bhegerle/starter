import { charMode, textMode, keyCodes } from './starter.js';

const txt = textMode(80, 25);
txt.writeLine('################################################################################');

const char = charMode(80, 25);

const keyCharacters = {};
for (let k in keyCodes)
    keyCharacters[keyCodes[k]] = k;

let x = 0, y = 0;
while (true) {
    const k = await char.readKey();
    if (k.down) {
        if (k.keyCode == keyCodes.up) y--;
        if (k.keyCode == keyCodes.down) y++;
        if (k.keyCode == keyCodes.left) x--;
        if (k.keyCode == keyCodes.right) x++;
        char.writeChar('x', x, y);
    }
}