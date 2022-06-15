import { Genetic, GeneticOptions, Phenotype } from './genetic';

export const MigrateSelec = {
    Fittest,
    FittestLinear,
    FittestRandom,
    Random,
    RandomLinearRank,
    Sequential,
};

export interface IlandGeneticModelOptions<T> {
    ilandCount: number;
    ilandMutationProbability: number;
    ilandCrossoverProbability: number;
    migrationProbability: number;
    continentCrossGeneration: number;
    continentGenerations: number;
    migrationFunction: (pop: Array<Phenotype<T>>) => number;
}

/**
 * Genetical iland evolution model implementation
 * @see https://www.researchgate.net/figure/Parallel-genetic-algorithm-with-island-model_fig3_332715538
 * @see https://www.researchgate.net/figure/Plot-of-multi-island-genetic-algorithm_fig1_318073651
 */
export class IlandGeneticModel<T> {
    protected internalGenState = {}; /* Used for random linear */

    private ilands: Array<Genetic<T>> = [];
    private continent: Genetic<T>;
    private options: IlandGeneticModelOptions<T>;
    private geneticOptions: GeneticOptions<T>;
    private generations = 0;

    constructor(options: Partial<IlandGeneticModelOptions<T>>, geneticOptions: GeneticOptions<T>) {
        const defaultOptions: IlandGeneticModelOptions<T> = {
            ilandCount: 6,
            ilandMutationProbability: 0.5,
            ilandCrossoverProbability: 0.8,
            migrationProbability: 0.05,
            continentCrossGeneration: 10,
            continentGenerations: 5,
            migrationFunction: MigrateSelec.Random,
        };

        this.options = { ...defaultOptions, ...options };
        this.geneticOptions = {
            optimize: (phenotypeA: Phenotype<T>, phenotypeB: Phenotype<T>) => {
                return phenotypeA.fitness >= phenotypeB.fitness;
            },
            ...geneticOptions,
            // Should be more than continent, because environment are special
            mutateProbablity: options.ilandMutationProbability,
            // Should be more than continent, because area is small
            crossoverProbablity: options.ilandCrossoverProbability,
            // Reduce population size for each iland (sum of all phenotypes should be equal to total population count)
            populationSize: Math.round(geneticOptions.populationSize / this.options.ilandCount),
        };

        this.createIlands();
        this.continent = new Genetic<T>(geneticOptions);
    }

    /**
     * Get best results from eash ilands (one by one)
     * count should be more than ilands count
     */
    public best(count = 5): Array<Phenotype<T>> {
        count = Math.max(this.options.ilandCount, count);

        const results: Array<Phenotype<T>> = [];
        const idxMap = {};
        let activeIland = 0;

        while (results.length < count) {
            const iland = this.ilands[activeIland];
            results.push(iland.population[idxMap[activeIland] || 0]);
            idxMap[activeIland] = (idxMap[activeIland] || 0) + 1;
            activeIland++;

            // Circullar reset index
            if (activeIland >= this.ilands.length) {
                activeIland = 0;
            }
        }

        return results.sort((a, b) => (this.geneticOptions.optimize(a, b) ? -1 : 1));
    }

    /**
     * Seed populations
     */
    public async seed(entities?: T[]) {
        for (let i = 0; i < this.options.ilandCount; i++) {
            const iland = this.ilands[i];
            await iland.seed(entities);
        }
    }
    /**
     * Breed each iland
     */
    public async breed() {
        this.migration();
        this.generations++;

        if (this.options.continentCrossGeneration && this.generations % this.options.continentCrossGeneration === 0) {
            await this.continentalBreed();
        } else {
            for (let i = 0; i < this.options.ilandCount; i++) {
                const iland = this.ilands[i];

                await iland.breed();
            }
        }
    }

    /**
     * Estimate each iland
     */
    public async estimate() {
        for (let i = 0; i < this.options.ilandCount; i++) {
            const iland = this.ilands[i];
            await iland.estimate();
        }
    }

    /**
     * Iland migrations alorithm
     */
    private migration() {
        for (let i = 0; i < this.options.ilandCount; i++) {
            const iland = this.ilands[i];

            for (let j = 0; j < iland.population.length; j++) {
                if (Math.random() <= this.options.migrationProbability) {
                    const selectedIndex = this.selectOne(iland);
                    const migratedPhonotype = this.peekPhenotye(iland, selectedIndex);
                    const newIland = this.getRandomIland(i);

                    // Move phenotype from old to new iland
                    this.insertPhenotype(newIland, migratedPhonotype);
                }
            }
        }

        this.reorderIlands();
    }

    /**
     * Continental orgasmic breed
     */
    private async continentalBreed() {
        const totalPopulation: Array<Phenotype<T>> = [];

        for (let i = 0; i < this.options.ilandCount; i++) {
            const iland = this.ilands[i];

            // Copy and reset population on iland
            totalPopulation.push(...iland.population);
            iland.population = [];
        }

        this.continent.population = totalPopulation;

        await this.continent.breed();

        for (let i = 0; i < this.options.continentGenerations; i++) {
            await this.continent.estimate();
            await this.continent.breed();
        }

        let activeIland = 0;

        while (this.continent.population.length) {
            const phenotype = this.continent.population.pop();
            const iland = this.ilands[activeIland];

            iland.population.push(phenotype);
            activeIland++;

            if (activeIland >= this.options.ilandCount) {
                activeIland = 0;
            }
        }
    }

    /**
     * Create a lot of ilands to use in evolution progress
     */
    private createIlands() {
        for (let i = 0; i < this.options.ilandCount; i++) {
            this.ilands.push(new Genetic<T>(this.geneticOptions));
        }
    }

    /**
     * Apply ordering to iland populations (use after all migrations)
     */
    private reorderIlands() {
        for (let i = 0; i < this.options.ilandCount; i++) {
            this.ilands[i].reorderPopulation();
        }
    }

    /**
     * Select one phenotype from population
     */
    private selectOne(iland: Genetic<T>): number {
        const { migrationFunction } = this.options;

        return migrationFunction.call(this, iland.population);
    }

    /**
     * Returns a random picked iland
     * TODO: Improve iland selection by selection function
     */
    private getRandomIland(exclude: number) {
        const targetIdx = Math.floor(Math.random() * this.options.ilandCount);

        if (targetIdx !== exclude) {
            return this.ilands[targetIdx];
        }

        return this.getRandomIland(exclude);
    }

    /**
     * Peek phenotype from iland
     */
    private peekPhenotye(iland: Genetic<T>, idx: number): Phenotype<T> {
        return iland.population.splice(idx, 1).pop();
    }

    /**
     * Insert phenotype to iland with custom index
     */
    private insertPhenotype(iland: Genetic<T>, phenotype: Phenotype<T>): void {
        iland.population.push(phenotype);
    }
}

function Fittest<T>(this: IlandGeneticModel<T>): number {
    return 0;
}

function FittestLinear<T>(this: IlandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['flr'] = this.internalGenState['flr'] >= pop.length ? 0 : this.internalGenState['flr'] || 0;

    return this.internalGenState['flr']++;
}

function FittestRandom<T>(this: IlandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    return Math.floor(Math.random() * pop.length * 0.2);
}

function Random<T>(this: IlandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    return Math.floor(Math.random() * pop.length);
}

function RandomLinearRank<T>(this: IlandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['rlr'] = this.internalGenState['rlr'] >= pop.length ? 0 : this.internalGenState['rlr'] || 0;

    return Math.floor(Math.random() * Math.min(pop.length, this.internalGenState['rlr']++));
}

function Sequential<T>(this: IlandGeneticModel<T>, pop: Array<Phenotype<T>>): number {
    this.internalGenState['seq'] = this.internalGenState['seq'] >= pop.length ? 0 : this.internalGenState['seq'] || 0;

    return this.internalGenState['seq']++ % pop.length;
}
