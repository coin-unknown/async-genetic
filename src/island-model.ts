import { Genetic, GeneticOptions, Phenotype } from './genetic';

export const MigrateSelec = {
    Fittest,
    FittestLinear,
    FittestRandom,
    Random,
    RandomLinearRank,
    Sequential,
};

export interface IslandGeneticModelOptions<T> {
    islandCount: number;
    islandMutationProbability: number;
    islandCrossoverProbability: number;
    migrationProbability: number;
    migrationFunction: (pop: Array<Phenotype<T>>) => number;
}

/**
 * Genetical island evolution model implementation
 * @see https://www.researchgate.net/figure/Parallel-genetic-algorithm-with-island-model_fig3_332715538
 * @see https://www.researchgate.net/figure/Plot-of-multi-island-genetic-algorithm_fig1_318073651
 */
export class IslandGeneticModel<T> {
    protected internalGenState = {}; /* Used for random linear */

    private populationOnContinent: boolean = false;
    private islands: Array<Genetic<T>> = [];
    private continent: Genetic<T>;
    private options: IslandGeneticModelOptions<T>;
    private geneticOptions: GeneticOptions<T>;

    /**
     * Population getter for full compatibility with classic genetic interface
     */
    get population() {
        // If population on continent get from last one
        if (this.continent.population.length) {
            return this.continent.population;
        }

        const totalPopulation: Array<Phenotype<T>> = [];

        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];

            // Copy and reset population on island
            totalPopulation.push(...island.population);
        }

        return totalPopulation;
    }

    /**
     * Stats compatibility method, aggregate stats from all islands
     */
    get stats() {
        // If population on continent get from last one
        if (this.continent.population.length) {
            console.log('stats from continent');
            return this.continent.stats;
        }

        console.log('stats from island');

        let stats = {};

        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];
            const islandStats = island.stats;

            if (i === 0) {
                stats = { ...islandStats };
            } else {
                for (const key in islandStats) {
                    stats[key] += islandStats[key];
                }
            }
        }

        for (const key in stats) {
            stats[key] /= this.options.islandCount;
        }

        return stats;
    }

    constructor(options: Partial<IslandGeneticModelOptions<T>>, geneticOptions: GeneticOptions<T>) {
        const defaultOptions: IslandGeneticModelOptions<T> = {
            islandCount: 6,
            islandMutationProbability: 0.5,
            islandCrossoverProbability: 0.8,
            migrationProbability: 0.05,
            migrationFunction: MigrateSelec.Random,
        };

        this.options = { ...defaultOptions, ...options };
        this.geneticOptions = {
            optimize: (phenotypeA: Phenotype<T>, phenotypeB: Phenotype<T>) => {
                return phenotypeA.fitness >= phenotypeB.fitness;
            },
            ...geneticOptions,
            // Should be more than continent, because environment are special
            mutateProbablity: options.islandMutationProbability,
            // Should be more than continent, because area is small
            crossoverProbablity: options.islandCrossoverProbability,
            // Reduce population size for each island (sum of all phenotypes should be equal to total population count)
            populationSize: Math.round(geneticOptions.populationSize / this.options.islandCount),
        };

        this.createIslands();
        this.continent = new Genetic<T>(geneticOptions);
    }

    /**
     * Get best results from eash islands (one by one)
     * count should be more than islands count
     */
    public best(count = 5): Array<Phenotype<T>> {
        // If population on continent get from last one
        if (this.continent.population.length) {
            return this.continent.best(count);
        }

        count = Math.max(this.options.islandCount, count);

        const results: Array<Phenotype<T>> = [];
        const idxMap = {};
        let activeIsland = 0;

        while (results.length < count) {
            const island = this.islands[activeIsland];
            results.push(island.population[idxMap[activeIsland] || 0]);
            idxMap[activeIsland] = (idxMap[activeIsland] || 0) + 1;
            activeIsland++;

            // Circullar reset index
            if (activeIsland >= this.islands.length) {
                activeIsland = 0;
            }
        }

        return results.sort((a, b) => (this.geneticOptions.optimize(a, b) ? -1 : 1));
    }

    /**
     * Seed populations
     */
    public async seed(entities?: T[]) {
        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];
            await island.seed(entities);
        }
    }
    /**
     * Breed each island
     */
    public async breed() {
        if (this.populationOnContinent) {
            return this.continent.breed();
        }

        this.migration();

        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];

            await island.breed();
        }
    }

    /**
     * Estimate each island
     */
    public async estimate() {
        if (this.populationOnContinent) {
            return this.continent.estimate();
        }

        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];
            await island.estimate();
        }
    }

    /**
     * island migrations alorithm
     */
    private migration() {
        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];

            for (let j = 0; j < island.population.length; j++) {
                if (Math.random() <= this.options.migrationProbability) {
                    const selectedIndex = this.selectOne(island);
                    const migratedPhonotype = this.peekPhenotye(island, selectedIndex);
                    const newIsland = this.getRandomIsland(i);

                    // Move phenotype from old to new island
                    this.insertPhenotype(newIsland, migratedPhonotype);
                }
            }
        }

        this.reorderIslands();
    }

    /**
     * Move all population to one continent
     */
    public moveAllToContinent() {
        // Population already on continent
        if (this.populationOnContinent) {
            return;
        }

        const totalPopulation: Array<Phenotype<T>> = [];

        for (let i = 0; i < this.options.islandCount; i++) {
            const island = this.islands[i];

            // Copy and reset population on island
            totalPopulation.push(...island.population);
            island.population = [];
        }

        this.continent.population = totalPopulation;
        this.populationOnContinent = true;
    }

    /**
     * Move continent population to islands
     */
    public migrateToIslands() {
        let activeIsland = 0;

        while (this.continent.population.length) {
            const phenotype = this.continent.population.pop();
            const island = this.islands[activeIsland];

            island.population.push(phenotype);
            activeIsland++;

            if (activeIsland >= this.options.islandCount) {
                activeIsland = 0;
            }
        }

        this.populationOnContinent = false;
    }

    /**
     * Create a lot of islands to use in evolution progress
     */
    private createIslands() {
        for (let i = 0; i < this.options.islandCount; i++) {
            this.islands.push(new Genetic<T>(this.geneticOptions));
        }
    }

    /**
     * Apply ordering to island populations (use after all migrations)
     */
    private reorderIslands() {
        for (let i = 0; i < this.options.islandCount; i++) {
            this.islands[i].reorderPopulation();
        }
    }

    /**
     * Select one phenotype from population
     */
    private selectOne(island: Genetic<T>): number {
        const { migrationFunction } = this.options;

        return migrationFunction.call(this, island.population);
    }

    /**
     * Returns a random picked island
     * TODO: Improve island selection by selection function
     */
    private getRandomIsland(exclude: number) {
        const targetIdx = Math.floor(Math.random() * this.options.islandCount);

        if (targetIdx !== exclude) {
            return this.islands[targetIdx];
        }

        return this.getRandomIsland(exclude);
    }

    /**
     * Peek phenotype from island
     */
    private peekPhenotye(island: Genetic<T>, idx: number): Phenotype<T> {
        return island.population.splice(idx, 1).pop();
    }

    /**
     * Insert phenotype to island with custom index
     */
    private insertPhenotype(island: Genetic<T>, phenotype: Phenotype<T>): void {
        island.population.push(phenotype);
    }
}

function Fittest<T>(this: IslandGeneticModel<T>): number {
    return 0;
}

function FittestLinear<T>(this: IslandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['flr'] = this.internalGenState['flr'] >= pop.length ? 0 : this.internalGenState['flr'] || 0;

    return this.internalGenState['flr']++;
}

function FittestRandom<T>(this: IslandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    return Math.floor(Math.random() * pop.length * 0.2);
}

function Random<T>(this: IslandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    return Math.floor(Math.random() * pop.length);
}

function RandomLinearRank<T>(this: IslandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['rlr'] = this.internalGenState['rlr'] >= pop.length ? 0 : this.internalGenState['rlr'] || 0;

    return Math.floor(Math.random() * Math.min(pop.length, this.internalGenState['rlr']++));
}

function Sequential<T>(this: IslandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['seq'] = this.internalGenState['seq'] >= pop.length ? 0 : this.internalGenState['seq'] || 0;

    return this.internalGenState['seq']++ % pop.length;
}
