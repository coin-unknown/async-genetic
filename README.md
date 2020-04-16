# Blazing fast Genetic Parameters Optimizer

Genetic is a [node.js](http://nodejs.org) implementation of genetic optimization algorithms. It's pretty asyncronous, so you can use it in your web applications without risking of blocking your application.

# Abstract

Genetic Algorithm (GA) is one of the most well-regarded evolutionary algorithms in the history. This algorithm mimics Darwinian theory of survival of the fittest in nature. This chapter presents the most fundamental concepts, operators, and mathematical models of this algorithm. The most popular improvements in the main component of this algorithm (selection, crossover, and mutation) are given too. The chapter also investigates the application of this technique in the field of image processing. In fact, the GA algorithm is employed to reconstruct a binary image from a completely random image.

## Download

Releases are available under Node Package Manager (npm):

    npm install async-genetic

## How to use

### GeneticAlgorithm constructor
```js
import { Genetic } from 'async-genetic';

const config = {...};
const population = [...];
const genetic = new Genetic(config, population);

```
The minimal configuration for constructing an GeneticAlgorithm calculator is like so:

```js
const config = {
    mutationFunction: aMutationFunctionYouSupply,
    crossoverFunction: yourCrossoverFunction,
    crossoverFunction: yourCrossoverFunction,
    randomFunction: yourRandomFunction,
    fitnessFunction: yourFitnessFunction, // async
    populationSize: aDecimalNumberGreaterThanZero 	// defaults to 100
}

const settings = {...};
const population = [...];
const genetic = new Genetic(config);
```

That creates one instance of an GeneticAlgorithm calculator which uses the initial configuration you supply.  All configuration options are optional except *population*.  If you don't specify a crossover function then GeneticAlgorithm will only do mutations and similarly if you don't specify the mutation function it will only do crossovers.  If you don't specify either then no evolution will happen, go figure.

### genetic.evolve( )
Do one generation of evolution like so
```js
geneticalgorithm.evolve( )
```
The *.evolve()* moves the calculator ahead by one generation. It is async function Depending on the population size and the speed of the functions you provide in the configuration this coupld be quick or take some time.
*.evolve()* changes the geneticalgorithm and also returns it.  This is for simplicity so that you could do chain calls like so
```js
await genetic.evolve() // evolve does async
await genetic.evolve()
genetic.scoredPopulation(2)
```
to do two evolutions and then get the best N phenoTypes with scores (see *.scoredPopulation(N)* below).

### geneticalgorithm.scoredPopulation(N)
Retrieve the Phenotype with the highest fitness score like so. You can get directly N best scored items
```js
const best = geneticalgorithm.scoredPopulation(1)
// best = { score: number, phenotype: any }
```

# Functions
This is the specification of the configuration functions you pass to GeneticAlgorithm

### mutationFunction(phenotype)
> Must return a phenotype

The mutation function that you provide.  It is a synchronous function that mutates the phenotype that you provide like so:
```js
function mutationFunction (oldPhenotype) {
	var resultPhenotype = {}
	// use oldPhenotype and some random
	// function to make a change to your
	// phenotype
	return resultPhenotype
}
```

### crossoverFunction (phenoTypeA, phenoTypeB)
> Must return an array [] with 2 phenotypes

The crossover function that you provide.  It is a synchronous function that swaps random sections between two phenotypes.  Construct it like so:
```js
function crossoverFunction(phenoTypeA, phenoTypeB) {
	var result = {}
	//  result should me created by merge phenoTypeA and phenoTypeB in custom rules
	return result;
}
```

###  fitnessFunction (phenotype) [async]
> Must return a promise with number

```js
async function fitnessFunction(phenotype) {
	var fitness = 0
	// use phenotype and possibly some other information
	// to determine the fitness number.  Higher is better, lower is worse.
	return fitness;
}
```

### doesABeatBFunction (phenoTypeA, phenoTypeB) [async]
> Must return Promise with truthy or falsy

This function, if specified, overrides using simply the fitness function to compare two phenotypes.  There are situations where you will want to preserve a certain amount of genetic diversity and so your doesABeatBFunction can return false if the two phenotypes are too different.  When GeneticAlgorithm is comparing two phenoTypes it *only* tests if A can beat B and if so then B dies and is replaced with a mutant or crossover child of A.  If A cannot beat B then nothing happens.  This is an important note to consider.  Suppose A and B are very genetically different and you want to preserve diversity then in your *doesABeatBFunction* you would check how diverse A and B are and simply return falsy if it crosses your threshold.

The default implementation if you don't supply one is:
```js
async function doesABeatBFunction(phenoTypeA, phenoTypeB) {
	return fitnessFunction(phenoTypeA) >= fitnessFunction(phenoTypeB)
}
```

### Configuring
> Next T - is your custom phenotype

| Parameter  | Type | Description |
| ------------- | ------------- | ------------- |
| mutationFunction | (phenotype: T) => T  | Mutate you phenotype as you describe  |
| crossoverFunction | (a: T, b: T) => T | Cross two different phenotypes in to once (merge)  |
| fitnessFunction | (phenotype: T) => Promise<number> | Train you phenotype to get result (scores more - better) |
| doesABeatBFunction | (a: T, b: T) => Promise<boolean> | Check the a better than b, (Optional), default scoreA > scoreB |
| randomFunction | () => T | Function generate random phenotype to complete the generation |
| populationSize | number | Number phenotypes in population |
| mutateProbablity | number [0...1] | Each crossover may be changed to mutation with this chance |
| deduplicate | boolean | Remove duplicates from phenotypes |