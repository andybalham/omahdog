import YAML from 'yaml';
import { addNumbersApplication } from '../src/lambdaApplication';
import { getRequiredPolicies, getEnvironmentVariables } from '../src/omahdog-aws/samTemplateFunctions';
import { expect } from 'chai';

describe('Lambda application tests', () => {

    it('can be validated', () => {
        
        // Arrange

        // Act

        const errors = addNumbersApplication.validate();

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);

        expect(errors).to.be.empty;
    });

    it('can return policies', () => {
        
        // Arrange

        // Act

        const policies = addNumbersApplication.getFunctionProperties(getRequiredPolicies);

        // Assert

        policies.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it('can return environment variables', () => {
        
        // Arrange

        // Act

        const environmentVariables = addNumbersApplication.getFunctionProperties(getEnvironmentVariables);

        // Assert

        environmentVariables.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it.only('can return events', () => {
        
        // Arrange

        // Act

        const events = addNumbersApplication.getFunctionEvents();

        // Assert

        events.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it('can return function definitions', () => {
        
        // Arrange

        // Act

        const functionDefinitions = addNumbersApplication.getFunctionDefinitions();

        // Assert

        console.log(YAML.stringify(functionDefinitions));
    });    
});