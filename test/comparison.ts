import { classicGenetic } from './genetic';
import { ilandGenetic } from './iland';

const resultsClassic: number[] = [];
const resultsIland: number[] = [];

async function main() {
    for (let i = 0; i < 5000; i++) {
        resultsClassic.push(await ilandGenetic(false));
        resultsIland.push(await classicGenetic(false));
    }

    console.log('---- Scores ----\n');
    console.log('Classic:', average(resultsClassic));
    console.log('Iland:', average(resultsIland));
}

main();

function average(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
