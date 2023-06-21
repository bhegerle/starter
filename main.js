import { textMode } from './starter.js';

const txt = textMode(8, 25);
txt.writeLine('#########');
txt.writeLine('😀😀😀😀');
txt.writeLine('#😀😀😀😀');


while (true) {
    const s = await txt.readLine();
    txt.writeLine(s);
}