import { Genetic, GeneticOptions } from '../src/index';
const PhenotypeSize = 10;

function mutationFunction(phenotype) {
    var gene = Math.floor( Math.random() * phenotype.numbers.length );
    phenotype.numbers[gene] += Math.random() * 20 - 10;
    return phenotype;
}

function crossoverFunction(a, b) {
    function cloneJSON( item ) {
        return JSON.parse ( JSON.stringify ( item ) )
    }

    var x = cloneJSON(a), cross = false;

    for (var i in a.numbers) {
        if ( Math.random() * a.numbers.length <= 1 ) { cross = !cross }
        if (cross) {
            x.numbers[i] = b.numbers[i];
        }
    }
    return x;
}

async function fitnessFunction(phenotype) {
    var sumOfPowers = 0;
    for (var i in phenotype.numbers) {
        // assume perfect solution is '50.0' for all numbers
        sumOfPowers += Math.pow( 50 - phenotype.numbers[i], 2);
    }

    return 1 / Math.sqrt(sumOfPowers);
}

function createEmptyPhenotype() {
    var data = [];
    for (var i = 0; i < PhenotypeSize; i += 1) {
        data[i] = 0
    }
    return [{ numbers : data }]
}

var ga = new Genetic({
    mutationFunction: mutationFunction,
    crossoverFunction: crossoverFunction,
    fitnessFunction: fitnessFunction,
    populationSize: PhenotypeSize * 10
}, createEmptyPhenotype());

const start = Date.now();
async function evolve() {
  for( var i = 0 ; i < 20 * PhenotypeSize ; i++ ) {
    await ga.evolve();
  }

  console.log("Duration: ", (Date.now() - start) / 1000);
  console.log(ga.scoredPopulation(1)[0].phenotype.numbers);
}

evolve();
