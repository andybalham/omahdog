import { addNumbersApplication } from '../src/lambdaApplication';

describe('Lambda application tests', () => {

    it('can be validated', () => {
        
        // Arrange

        // Act

        const errors = addNumbersApplication.validate();

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);
    });
    
});