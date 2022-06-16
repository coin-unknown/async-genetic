import { classicGenetic } from './genetic';
import { islandGenetic } from './island';

const resultsClassic: number[] = [];
const resultsIsland: number[] = [];

async function main() {
    for (let i = 0; i < 50; i++) {
        const islandGens = await islandGenetic(false);
        const classicGens = await classicGenetic(false);

        resultsIsland.push(islandGens);
        resultsClassic.push(classicGens);

        console.log('In progress...', i, islandGens, classicGens);
    }

    const avgClassic = average(resultsClassic);
    const avgIsland = average(resultsIsland);
    console.log('---- Average generation count needed to solve task ----\n');
    console.log('Classic:', avgClassic);
    console.log('Island:', avgIsland);
    console.log('Percent diff is:', isWhatPercentOf(avgIsland, avgClassic));
}

main();

function average(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function isWhatPercentOf(numA: number, numB: number) {
    return (1 - numA / numB) * 100;
}
