import YAML from 'yaml';
import { addNumbersApplication } from '../src/lambdaApplication';
import { getRequiredPolicies } from '../src/omahdog-aws/samTemplateFunctions';

describe('Lambda application tests', () => {

    it.only('can be validated', () => {
        
        // Arrange

        // Act

        const errors = addNumbersApplication.validate();

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);
    });

    it('can return policies', () => {
        
        // Arrange

        // Act

        const policies = addNumbersApplication.getPropertiesByResource(getRequiredPolicies);

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