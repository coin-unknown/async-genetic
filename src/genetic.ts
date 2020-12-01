import { clone } from './utils';

export const Select = { Tournament2, Tournament3, Fittest, Random, RandomLinearRank, Sequential };
export interface GeneticOptions<T> {
    mutationFunction: (phenotype: T) => T;
    crossoverFunction: (a: T, b: T) => Array<T>;
    fitnessFunction: (phenotype: T) => Promise<number>;
    randomFunction: () => T;
    populationSize: number;
    mutateProbablity?: number;
    crossoverProbablity?: number;
    fittestNSurvives?: number;
    select1?: (pop) => T;
    select2?: (pop) => T;
    deduplicate?: (phenotype: T) => boolean;
}

export interface Phenotype<T> {
    fitness: number;
    entity: T;
}

export class Genetic<T> {
    public stats = {};
    public options: GeneticOptions<T>;
    protected internalGenState = {}; /* Used for random linear */
    private population: Array<Phenotype<T>> = [];

    constructor(options: GeneticOptions<T>) {
        const defaultOptions: Partial<GeneticOptions<T>> = {
            populationSize: 250,
            mutateProbablity: 0.2,
            crossoverProbablity: 0.9,
            fittestNSurvives: 1,
            select1: Select.Fittest,
            select2: Select.Tournament2,
        };

        this.options = { ...defaultOptions, ...options };
    }

    /**
     * Startup population, if not passed than will be random generated by randomFunction()
     */
    public seed(entities: Array<T> = []) {
        this.population = entities.map((entity) => ({ fitness: null, entity }));

        // seed the population
        for (let i = 0; i < this.options.populationSize; ++i) {
            this.population.push({ fitness: null, entity: this.options.randomFunction() });
        }
    }

    public best(count = 1) {
        return this.population
            .filter((ph) => this.options.deduplicate(ph.entity))
            .slice(0, count)
            .map((ph) => ph.entity);
    }

    /**
     * Breed population with optional breed settings
     */
    public breed() {
        // crossover and mutate
        const newPop: Array<Phenotype<T>> = [];

        // lets the best solution fall through
        if (this.options.fittestNSurvives) {
            newPop.push(...this.getPurePopulation(this.options.fittestNSurvives));
        }

        // Lenght may be change dynamically, because fittest and some pairs from crossover
        while (newPop.length < this.options.populationSize) {
            newPop.push(...this.tryCrossover().map((entity) => ({ fitness: null, entity })));
        }

        if (this.options.deduplicate) {
            this.population = this.population.filter((ph) => this.options.deduplicate(ph.entity));
            this.seed();
        }

        this.population = newPop;
    }

    /**
     * Estimate population before breeding
     */
    public async estimate() {
        const { fitnessFunction } = this.options;
        // reset for each generation
        this.internalGenState = {};
        const tasks = await Promise.all(this.population.map(({ entity }) => fitnessFunction(entity)));

        for (let i = 0; i < this.population.length; i++) {
            this.population[i].fitness = tasks[i];
        }

        this.population = this.population.sort((a, b) => (this.optimize(a.fitness, b.fitness) ? -1 : 1));

        const popLen = this.population.length;
        const mean = this.getMean();

        this.stats = {
            maximum: this.population[0].fitness,
            minimum: this.population[popLen - 1].fitness,
            mean,
            stdev: this.getStdev(mean),
        };
    }

    /**
     * Sort algorythm
     */
    protected optimize = (a: number, b: number) => {
        return a >= b;
    };

    /**
     * Try cross a pair or one selected phenotypes
     */
    private tryCrossover = () => {
        const { crossoverProbablity, crossoverFunction } = this.options;
        let selected = crossoverFunction && Math.random() <= crossoverProbablity ? this.selectPair() : this.selectOne();

        if (selected.length === 2) {
            selected = crossoverFunction(selected[0], selected[1]);
        }

        return selected.map(this.tryMutate);
    };

    /**
     * Try mutate entity with optional probabilty
     */
    private tryMutate = (entity: T) => {
        // applies mutation based on mutation probability
        if (this.options.mutationFunction && Math.random() <= this.options.mutateProbablity) {
            return this.options.mutationFunction(entity);
        }

        return entity;
    };

    /**
     * Mean deviation
     */
    private getMean() {
        return this.population.reduce((a, b) => a + b.fitness, 0) / this.population.length;
    }

    /**
     * Standart deviation
     */
    private getStdev(mean: number) {
        const { population: pop } = this;
        const l = pop.length;

        return Math.sqrt(pop.map(({ fitness }) => (fitness - mean) * (fitness - mean)).reduce((a, b) => a + b, 0) / l);
    }

    /**
     * Select one phenotype from population
     */
    private selectOne() {
        const { select1 } = this.options;

        return [clone(select1.call(this, this.population))];
    }

    /**
     * Select two phenotypes from population for crossover
     */
    private selectPair() {
        const { select2 } = this.options;

        return [clone(select2.call(this, this.population)), clone(select2.call(this, this.population))];
    }

    /**
     * Return population without an estimate (fitness)
     */
    private getPurePopulation(count: number) {
        return this.population.slice(0, count).map((ph) => ({ fitness: null, entity: ph.entity }));
    }
}

/** Utility */

function Tournament2<T>(this: Genetic<T>, pop) {
    const n = pop.length;
    const a = pop[Math.floor(Math.random() * n)];
    const b = pop[Math.floor(Math.random() * n)];

    return this.optimize(a.fitness, b.fitness) ? a.entity : b.entity;
}

function Tournament3<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    const n = pop.length;
    const a = pop[Math.floor(Math.random() * n)];
    const b = pop[Math.floor(Math.random() * n)];
    const c = pop[Math.floor(Math.random() * n)];
    let best = this.optimize(a.fitness, b.fitness) ? a : b;
    best = this.optimize(best.fitness, c.fitness) ? best : c;

    return best.entity;
}

function Fittest<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    return pop[0].entity;
}

function Random<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    return pop[Math.floor(Math.random() * pop.length)].entity;
}

function RandomLinearRank<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    this.internalGenState['rlr'] = this.internalGenState['rlr'] || 0;
    return pop[Math.floor(Math.random() * Math.min(pop.length, this.internalGenState['rlr']++))].entity;
}

function Sequential<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    this.internalGenState['seq'] = this.internalGenState['seq'] || 0;
    return pop[this.internalGenState['seq']++ % pop.length].entity;
}
