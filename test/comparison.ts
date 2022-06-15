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

    const avgClassic = average(resultsClassic);
    const avgIland = average(resultsIland);
    console.log('---- Average generation count needed to solve task ----\n');
    console.log('Classic:', avgClassic);
    console.log('Iland:', avgIland);
    console.log('Percent diff is:', isWhatPercentOf(avgIland, avgClassic));
}

main();

function average(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function isWhatPercentOf(numA: number, numB: number) {
    return (1 - numA / numB) * 100;
}
