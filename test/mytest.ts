import { Genetic, Select } from '../src/genetic';
const solution = 'Insanity is doing the same thing over and over again and expecting different results';

function randomString(len: number) {
    let text = '';
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < len; i++) text += charset.charAt(Math.floor(Math.random() * charset.length));

    return text;
}

function replaceAt(str, index, character) {
    return str.substr(0, index) + character + str.substr(index + character.length);
}

function randomFunction() {
    // create random strings that are equal in length to solution
    return randomString(solution.length);
}

function mutationFunction(entity: string) {
    // chromosomal drift
    const i = Math.floor(Math.random() * entity.length);
    return replaceAt(entity, i, String.fromCharCode(entity.charCodeAt(i) + (Math.floor(Math.random() * 2) ? 1 : -1)));
}

function crossoverFunction(mother: string, father: string) {
    // two-point crossover
    const len = mother.length;
    let ca = Math.floor(Math.random() * len);
    let cb = Math.floor(Math.random() * len);
    if (ca > cb) {
        const tmp = cb;
        cb = ca;
        ca = tmp;
    }

    const son = father.substr(0, ca) + mother.substr(ca, cb - ca) + father.substr(cb);
    const daughter = mother.substr(0, ca) + father.substr(ca, cb - ca) + mother.substr(cb);

    return [son, daughter];
}

async function fitnessFunction(entity: string) {
    let fitness = 0;

    let i;
    for (i = 0; i < entity.length; ++i) {
        // increase fitness for each character that matches
        if (entity[i] == solution[i]) fitness += 1;

        // award fractions of a point as we get warmer
        fitness += (127 - Math.abs(entity.charCodeAt(i) - solution.charCodeAt(i))) / 50;
    }

    return fitness;
}

const lookup = new Set();
const deduplicate = (str: string) => {
    if (lookup.has(str)) {
        return false;
    } else {
        lookup.add(str);
        return true;
    }
};

const GENERATIONS = 3000;
const POPULATION = 2000;

const population = [];

for (let i = 0; i < POPULATION; i++) {
    population.push(randomFunction());
}

const genetic = new Genetic<string>({
    mutationFunction,
    crossoverFunction,
    fitnessFunction,
    randomFunction,
    populationSize: POPULATION,
    fittestNSurvives: 1,
    select1: Select.Tournament2,
    select2: Select.Tournament2,
    deduplicate,
});

async function solve() {
    genetic.seed();

    for (let i = 0; i <= GENERATIONS; i++) {
        console.count('gen');
        await genetic.estimate();
        genetic.breed();

        if (genetic.best()[0] === solution) {
            break;
        }
    }
    console.log(genetic.best(100));
}

solve();
