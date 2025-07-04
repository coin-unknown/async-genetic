export const Select = {
    Fittest,
    FittestLinear,
    FittestRandom,
    Random,
    RandomLinearRank,
    TrueLinearRank,
    Sequential,
    Tournament2,
    Tournament3,
};
export interface GeneticOptions<T> {
    mutationFunction: (phenotype: T) => Promise<T>;
    crossoverFunction: (a: T, b: T) => Promise<Array<T>>;
    fitnessFunction: (phenotype: T, isLast?: boolean) => Promise<{ fitness: number; state?: Record<string, unknown> }>;
    randomFunction: () => Promise<T>;
    populationSize: number;
    mutateProbablity?: number;
    crossoverProbablity?: number;
    fittestNSurvives?: number;
    select1?: (pop: Array<Phenotype<T>>) => T;
    select2?: (pop: Array<Phenotype<T>>) => T;
    deduplicate?: (phenotype: T) => boolean;
    optimize?: (a: Phenotype<T>, b: Phenotype<T>) => boolean;
}

export interface Phenotype<T> {
    fitness: number;
    entity: T;
    state: Record<string, unknown>;
}

export class Genetic<T> {
    public stats = {};
    public options: GeneticOptions<T>;
    public population: Array<Phenotype<T>> = [];
    protected internalGenState = {}; /* Used for random linear */

    constructor(options: GeneticOptions<T>) {
        const defaultOptions: Partial<GeneticOptions<T>> = {
            populationSize: 250,
            mutateProbablity: 0.2,
            crossoverProbablity: 0.9,
            fittestNSurvives: 1,
            select1: Select.Fittest,
            select2: Select.Tournament2,
            optimize: (phenotypeA: Phenotype<T>, phenotypeB: Phenotype<T>) => {
                return phenotypeA.fitness >= phenotypeB.fitness;
            },
        };

        this.options = { ...defaultOptions, ...options };
    }

    /**
     * Startup population, if not passed than will be random generated by randomFunction()
     */
    public async seed(entities: Array<T> = []) {
        this.population = entities.map((entity) => ({ fitness: null, entity, state: {} }));

        // seed the population
        await this.fill(this.population);
    }

    public best(count = 1) {
        return this.population.slice(0, count);
    }

    /**
     * Breed population with optional breed settings
     */
    public async breed() {
        // Сохраняем элиту отдельно
        const elitePhenotypes: Array<Phenotype<T>> = [];

        // lets the best solution fall through
        if (this.options.fittestNSurvives) {
            const cutted = this.cutPopulation(this.options.fittestNSurvives);
            for (const item of cutted) {
                elitePhenotypes.push({ ...item, fitness: null, state: {} });
            }
        }

        let newPop: Array<Phenotype<T>> = [];
        const maxAttempts = this.options.populationSize * 10;
        let attempts = 0;

        while (newPop.length < this.options.populationSize && attempts < maxAttempts) {
            const crossed = await this.tryCrossover();
            if (crossed.length === 0) {
                attempts++;
                continue;
            }
            newPop.push(...crossed.map((entity) => ({ fitness: null, entity, state: {} })));
            attempts++;
        }

        if (this.options.deduplicate) {
            newPop = newPop.filter((ph) => this.options.deduplicate(ph.entity));
        }

        newPop = [...elitePhenotypes, ...newPop];

        if (newPop.length > this.options.populationSize) {
            newPop = newPop.slice(0, this.options.populationSize);
        }

        await this.fill(newPop);
        this.population = newPop;
    }

    /**
     * Estimate population before breeding
     */
    public async estimate() {
        const { fitnessFunction } = this.options;
        // reset for each generation
        this.internalGenState = {};

        const tasks = await Promise.all(
            this.population.map(({ entity }, idx) => {
                const isLast = idx === this.population.length - 1;

                return fitnessFunction(entity, isLast);
            }),
        );

        for (let i = 0; i < this.population.length; i++) {
            const target = this.population[i];

            target.fitness = tasks[i].fitness;
            target.state = tasks[i].state;
        }

        this.reorderPopulation();

        // Вычисляем основные метрики популяции
        const popLen = this.population.length;
        const maximumFitness = Number(this.population[0].fitness.toFixed(4));
        const averageFitness = Number(this.getMean().toFixed(4));
        const fitnessStdDev = Number(this.getStdev(averageFitness).toFixed(4));

        // Формируем объект статистики с понятными именами
        this.stats = {
            fitnessPopulation: this.population.length,
            maximumFitness, // максимальный fitness в популяции
            minimumFitness: this.population[popLen - 1].fitness,
            averageFitness, // средний fitness
            fitnessStdDev, // стандартное отклонение fitness
        };
    }

    /**
     * Appli population sorting
     */
    public reorderPopulation() {
        // Фильтруем особей без fitness
        this.population = this.population.filter((p) => typeof p.fitness === 'number');

        if (!this.population.length) {
            return;
        }

        this.population = this.population.sort((a, b) => (this.options.optimize(a, b) ? -1 : 1));
    }

    /** Fill population if is not full */
    private async fill(arr: Phenotype<T>[]) {
        const maxAttempts = this.options.populationSize * 10;
        let attempts = 0;
        while (arr.length < this.options.populationSize && attempts < maxAttempts) {
            const entity = await this.options.randomFunction();
            if (this.options.deduplicate && !this.options.deduplicate(entity)) {
                attempts++;
                continue;
            }
            arr.push({ entity, fitness: null, state: {} });
            attempts++;
        }
        if (arr.length < this.options.populationSize) {
            throw new Error('Could not fill population to required size. Check randomFunction or deduplicate.');
        }
    }

    /**
     * Try cross a pair or one selected phenotypes
     */
    private tryCrossover = async () => {
        const { crossoverProbablity, crossoverFunction } = this.options;
        let selected = crossoverFunction && Math.random() <= crossoverProbablity ? this.selectPair() : this.selectOne();

        if (selected.length > 1 && crossoverFunction) {
            selected = await crossoverFunction(clone(selected[0]), clone(selected[1]));
        }

        for (let i = 0; i < selected.length; i++) {
            selected[i] = await this.tryMutate(clone(selected[i]));
        }

        return selected;
    };

    /**
     * Try mutate entity with optional probabilty
     */
    private tryMutate = async (entity: T) => {
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
        if (!this.population.length) {
            return 0;
        }

        const valid = this.population.filter((p) => typeof p.fitness === 'number');

        if (!valid.length) {
            return 0;
        }

        return valid.reduce((a, b) => a + b.fitness, 0) / valid.length;
    }

    /**
     * Standart deviation
     */
    private getStdev(mean: number) {
        if (!this.population.length) return 0;
        const valid = this.population.filter((p) => typeof p.fitness === 'number');
        if (!valid.length) return 0;
        const l = valid.length;
        return Math.sqrt(
            valid.map(({ fitness }) => (fitness - mean) * (fitness - mean)).reduce((a, b) => a + b, 0) / l,
        );
    }

    /**
     * Select one phenotype from population
     */
    private selectOne(): T[] {
        const { select1 } = this.options;

        return [select1.call(this, this.population)];
    }

    /**
     * Select two phenotypes from population for crossover
     */
    private selectPair(): T[] {
        const { select2 } = this.options;
        if (this.population.length < 2) {
            // fallback: два раза один и тот же
            const one = select2.call(this, this.population);
            return [one, one];
        }
        const first = select2.call(this, this.population);
        let second = select2.call(this, this.population);
        let attempts = 0;
        while (first === second && attempts < 10) {
            second = select2.call(this, this.population);
            attempts++;
        }
        return [first, second];
    }

    /**
     * Return population without an estimate (fitness)
     */
    private cutPopulation(count: number) {
        return this.population.slice(0, count).map((ph) => ({ fitness: null, entity: ph.entity }));
    }
}

/** Utility */

function Tournament2<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    const n = pop.length;
    const a = pop[Math.floor(Math.random() * n)];
    const b = pop[Math.floor(Math.random() * n)];

    return this.options.optimize(a, b) ? a.entity : b.entity;
}

function Tournament3<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    const n = pop.length;
    const a = pop[Math.floor(Math.random() * n)];
    const b = pop[Math.floor(Math.random() * n)];
    const c = pop[Math.floor(Math.random() * n)];
    let best = this.options.optimize(a, b) ? a : b;
    best = this.options.optimize(best, c) ? best : c;

    return best.entity;
}

function Fittest<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    return pop[0].entity;
}

function FittestLinear<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    this.internalGenState['flr'] = this.internalGenState['flr'] >= pop.length ? 0 : this.internalGenState['flr'] || 0;

    return pop[this.internalGenState['flr']++].entity;
}

function FittestRandom<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    return pop[Math.floor(Math.random() * pop.length * 0.2)].entity;
}

function Random<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    return pop[Math.floor(Math.random() * pop.length)].entity;
}

function RandomLinearRank<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    this.internalGenState['rlr'] = this.internalGenState['rlr'] >= pop.length ? 0 : this.internalGenState['rlr'] || 0;

    return pop[Math.floor(Math.random() * Math.min(pop.length, this.internalGenState['rlr']++))].entity;
}

function Sequential<T>(this: Genetic<T>, pop: Array<Phenotype<T>>) {
    this.internalGenState['seq'] = this.internalGenState['seq'] >= pop.length ? 0 : this.internalGenState['seq'] || 0;

    return pop[this.internalGenState['seq']++ % pop.length].entity;
}

function TrueLinearRank<T>(this: Genetic<T>, pop: Array<Phenotype<T>>): T {
    // сумма рангов: N + (N-1) + ... + 1 = N*(N+1)/2
    const n = pop.length;
    const totalRank = (n * (n + 1)) / 2;

    let r = Math.random() * totalRank;
    for (let i = 0; i < n; i++) {
        const rank = n - i; // лучший = n, худший = 1
        r -= rank;
        if (r <= 0) {
            return pop[i].entity;
        }
    }

    return pop[n - 1].entity; // fallback (почти не случается)
}

/**
 * Create object clones
 * @param val
 * @returns
 */
function clone<T>(val: T): T {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
        return { ...val };
    }
    return val;
}
