import { get, merge } from 'object-path-immutable';

export interface GeneticOptions<T> {
    mutationFunction: (phenotype: T) => T;
    crossoverFunction: (a: T, b: T) => T;
    fitnessFunction: (phenotype: T) => Promise<number>;
    doesABeatBFunction?: (a: T, b: T) => Promise<boolean>;
    randomFunction?: () => T;
    populationSize: number;
    mutateProbablity?: number;
}

export class Genetic<T> {
    protected options: GeneticOptions<T>;
    protected scoreMap: Map<T, number> = new Map();
    protected defaults: GeneticOptions<T> = {
        mutationFunction: (phenotype: T): T => phenotype,
        crossoverFunction: (a: T, b: T): T => (Math.random() > 0.5 ? a : b),
        fitnessFunction: async (phenotype: T): Promise<number> => 0,
        randomFunction: (): T =>
            this.mutate((get(this.population, `${Math.floor(Math.random() * this.population.length)}`) as any) as T),
        populationSize: 100,
        mutateProbablity: 0.5,
    };

    constructor(options: GeneticOptions<T>, protected population: Array<T> = []) {
        this.options = { ...this.defaults, ...options };
        this.population = population;
    }

    public async evolve() {
        this.scoreMap.clear();

        this.populate();
        this.shufflePopulation();
        this.compete();
        return this;
    }

    public scoredPopulation(n = 0) {
        return this.population
            .map((phenotype) => ({ phenotype, score: this.scoreMap.get(phenotype) }))
            .filter((a) => a.score)
            .sort((a, b) => (a.score > b.score ? 1 : -1))
            .slice(-n);
    }

    protected populate() {
        while (this.population.length < this.options.populationSize) {
            this.population.push(this.options.randomFunction());
        }
    }

    protected mutate(phenotype: T): T {
        return this.options.mutationFunction(merge({}, null, phenotype) as T);
    }

    protected async fitness(phenotype: T) {
        const score = await this.options.fitnessFunction(phenotype);
        this.scoreMap.set(phenotype, score);
        return score;
    }

    protected crossover(phenotype: T) {
        phenotype = merge({}, null, phenotype) as T;
        const mate = get(this.population, `${Math.floor(Math.random() * this.population.length)}`);
        return this.options.crossoverFunction(phenotype, (mate as any) as T);
    }

    protected doesABeatB(a: T, b: T): Promise<boolean> {
        if (this.options.doesABeatBFunction) {
            return this.options.doesABeatBFunction(a, b);
        } else {
            return Promise.all([this.fitness(a), this.fitness(b)]).then(([scoreA, scoreB]) => {
                return scoreA >= scoreB;
            });
        }
    }

    protected async compete() {
        const tasks: Array<Promise<T>> = [];

        for (let idx = 0; idx < this.population.length - 1; idx += 2) {
            tasks.push(this.task(idx));
        }

        this.population = await Promise.all(tasks);
    }

    protected async task(idx: number) {
        const phenotype = this.population[idx];
        const competitor = this.population[idx + 1];

        const res = await this.doesABeatB(phenotype, competitor);
        if (res) {
            if (Math.random() < this.options.mutateProbablity) {
                return this.mutate(phenotype);
            }
            else {
                return this.crossover(phenotype);
            }
        }
        else {
            return competitor;
        }
    }

    protected shufflePopulation() {
        this.population = this.population.sort(() => Math.random() - 0.5);
    }
}
