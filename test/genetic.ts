// benchmarked vs https://subprotocol.com/system/genetic-hello-world.html
// local genetic is x2 faster

import { Genetic, Select } from '../src/genetic';

const GENERATIONS = 4000;
const POPULATION = 4000;
const solution = 'Insanity is doing the same thing over and over again and expecting different results';

export async function classicGenetic(log?: boolean) {
    function randomString(len: number) {
        let text = '';
        const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < len; i++) text += charset.charAt(Math.floor(Math.random() * charset.length));

        return text;
    }

    function replaceAt(str, index, character) {
        return str.substr(0, index) + character + str.substr(index + character.length);
    }

    async function randomFunction() {
        // create random strings that are equal in length to solution
        return randomString(solution.length);
    }

    async function mutationFunction(entity: string) {
        // chromosomal drift
        const i = Math.floor(Math.random() * entity.length);
        return replaceAt(
            entity,
            i,
            String.fromCharCode(entity.charCodeAt(i) + (Math.floor(Math.random() * 2) ? 1 : -1)),
        );
    }

    async function crossoverFunction(mother: string, father: string) {
        // two-point crossover
        const len = mother.length;
        let ca = Math.floor(Math.random() * len);
        let cb = Math.floor(Math.random() * len);
        if (ca > cb) {
            const tmp = cb;
            cb = ca;
            ca = tmp;
        }

        const son = mother.slice(0, ca) + father.slice(ca, cb) + mother.slice(cb);
        const daughter = father.slice(0, ca) + mother.slice(ca, cb) + father.slice(cb);

        return [son, daughter];
    }

    async function fitnessFunction(entity: string) {
        let fitness = 0;

        for (let i = 0; i < entity.length; ++i) {
            // increase fitness for each character that matches
            if (entity[i] == solution[i]) fitness += 1;

            // award fractions of a point as we get warmer
            fitness += (127 - Math.abs(entity.charCodeAt(i) - solution.charCodeAt(i))) / 50;
        }

        return { fitness };
    }

    const population: Promise<string>[] = [];

    for (let i = 0; i < POPULATION; i++) {
        population.push(randomFunction());
    }

    const genetic = new Genetic<string>({
        mutationFunction,
        crossoverFunction,
        fitnessFunction,
        randomFunction,
        populationSize: POPULATION,
        fittestNSurvives: Math.floor(POPULATION * 0.05),
        select1: Select.FittestLinear,
        select2: Select.Tournament3,
        mutateProbablity: 0.6,
        crossoverProbablity: 0.8,
    });

    async function solve() {
        await genetic.seed();

        for (let i = 0; i <= GENERATIONS; i++) {
            if (log) {
                console.count('gen');
            }

            await genetic.estimate();
            const bestOne = genetic.best()[0];

            if (log) {
                console.log(`${bestOne.entity} - ${bestOne.fitness}`);
            }

            await genetic.breed();

            if (bestOne.entity === solution) {
                return i;
            }
        }
    }

    return solve();
}
