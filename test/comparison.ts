import { classicGenetic } from './genetic';
import { ilandGenetic } from './iland';

const resultsClassic: number[] = [];
const resultsIland: number[] = [];

async function main() {
    for (let i = 0; i < 50; i++) {
        const ilandGens = await ilandGenetic(false);
        const classicGens = await classicGenetic(false);

        resultsIland.push(ilandGens);
        resultsClassic.push(classicGens);

        console.log('In progress...', i, ilandGens, classicGens);
    }

    console.log('---- Average generation count needed to solve task ----\n');
    console.log('Classic:', average(resultsClassic));
    console.log('Iland:', average(resultsIland));
}

main();

function average(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
