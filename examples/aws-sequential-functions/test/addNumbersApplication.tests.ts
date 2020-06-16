import { addNumbersApplication } from '../src/lambdaApplication';

describe('Lambda application tests', () => {

    it('can be validated', () => {
        
        // Arrange

        // Act

        const errors = addNumbersApplication.validate();

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);
    });

    it.only('can return policies', () => {
        
        // Arrange

        // Act

        const policies = addNumbersApplication.getPolicies();

        // Assert

        policies.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });
    
});