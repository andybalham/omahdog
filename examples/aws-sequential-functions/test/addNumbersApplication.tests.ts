import YAML from 'yaml';
import { addNumbersApplication } from '../src/lambdaApplication';

describe('Lambda application tests', () => {

    it('can be validated', () => {
        
        // Arrange

        // Act

        const errors = addNumbersApplication.validate();

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);
    });

    it('can return policies', () => {
        
        // Arrange

        // Act

        const policies = addNumbersApplication.getPolicies();

        // Assert

        policies.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it.only('can return function definitions', () => {
        
        // Arrange

        // Act

        const functionDefinitions = addNumbersApplication.getFunctionDefinitions();

        // Assert

        console.log(YAML.stringify(functionDefinitions));
    });    
});