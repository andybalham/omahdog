import { expect } from 'chai';
import { FlowContext, RequestRouter, HandlerFactory, AsyncResponse } from '../src/omahdog/FlowContext';
import { SumNumbersRequest, SumNumbersResponse } from '../src/exchanges/SumNumbersExchange';
import { SumNumbersHandler } from '../src/handlers/SumNumbersHandler';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from '../src/exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from '../src/handlers/AddThreeNumbersHandler';
import { StoreTotalRequest, StoreTotalResponse } from '../src/exchanges/StoreTotalExchange';
import { ConstantValue } from '../src/omahdog-aws/ConfigurationValues';

describe('AddThreeNumbersHandler tests', () => {

    it('returns the total of the inputs', async () => {

        const requestRouter = new RequestRouter()
            .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler);

        const handlerFactory = new HandlerFactory()
            .setInitialiser(AddThreeNumbersHandler, handler => {
                handler.parameters.totalDescription = 
                    new ConstantValue('The answer to life, the universe, and everything');
            });

        const flowContext = FlowContext.newContext(requestRouter, handlerFactory);

        flowContext.mocks
            .add('Store_total', (req: StoreTotalRequest) => { 
                console.log(`Store_total: ${JSON.stringify(req)}`); 
                const response: StoreTotalResponse = { id: 'totalId' };
                return response;
            });

        const request: AddThreeNumbersRequest = { a: 12, b: 14, c: 16 };

        console.log(JSON.stringify(request));

        const response = await flowContext.handleRequest(AddThreeNumbersHandler, request) as AddThreeNumbersResponse;

        expect(response.total).to.be.equal(42);
    });

    it('throws an exception on 666', async () => {

        const requestRouter = new RequestRouter()
            .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler);

        const flowContext = FlowContext.newContext(requestRouter);

        flowContext.mocks
            .add('Store_total', (req: StoreTotalRequest) => { 
                console.log(`Store_total: ${JSON.stringify(req)}`); 
                const response: StoreTotalResponse = { id: 'totalId' };
                return response;
            });

        const request: AddThreeNumbersRequest = { a: 666, b: 210, c: 206 };

        try {
            await flowContext.handleRequest(AddThreeNumbersHandler, request);
            expect(false).to.be.true;
        } catch (error) {
            expect((error as Error).message).to.contain('bandy');
        }
    });
});