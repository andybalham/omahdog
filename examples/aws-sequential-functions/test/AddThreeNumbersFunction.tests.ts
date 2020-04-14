import { expect } from 'chai';
import { handler } from '../src/AddThreeNumbersFunction';
import { AddThreeNumbersRequest } from '../src/exchanges/AddThreeNumbersExchange';

describe('Adder tests', () => {

    it('adds up numbers', async () => {

        const event: AddThreeNumbersRequest = {
            a: 202, b: 202, c: 212
        };
        
        const response = await handler(event);

        expect(response?.total).to.equal(616);
    });
});
