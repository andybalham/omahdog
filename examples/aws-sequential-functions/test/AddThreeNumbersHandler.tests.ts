import { expect } from 'chai';
import { FlowContext } from '../src/omahdog/FlowContext';
import { SumNumbersRequest, SumNumbersResponse } from '../src/exchanges/SumNumbersExchange';
import { SumNumbersHandler } from '../src/handlers/SumNumbersHandler';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from '../src/exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from '../src/handlers/AddThreeNumbersHandler';
import { StoreTotalRequest, StoreTotalResponse } from '../src/exchanges/StoreTotalExchange';

describe('AddThreeNumbersHandler tests', () => {

    it('returns the total of the inputs', async () => {

        const flowContext = FlowContext.newContext();
        flowContext.requestRouter
            .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler);
        flowContext.handlerFactory
            .register(SumNumbersHandler, () => new SumNumbersHandler());
        flowContext.mocks
            .add('Store_total', (req: StoreTotalRequest) => { 
                console.log(`Store_total: ${JSON.stringify(req)}`); 
                const response: StoreTotalResponse = { id: 'totalId' };
                return response;
            });

        const request = new AddThreeNumbersRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        console.log(JSON.stringify(request));

        // TODO 25Apr20: There's no way to force us to inject the dependencies into the handler
        const response = await new AddThreeNumbersHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect((response as AddThreeNumbersResponse).total).to.be.equal(616);
    });

    it.only('throws an exception on 666', async () => {

        const flowContext = FlowContext.newContext();
        flowContext.requestRouter
            .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler);
        flowContext.handlerFactory
            .register(SumNumbersHandler, () => new SumNumbersHandler());
        flowContext.mocks
            .add('Store_total', (req: StoreTotalRequest) => { 
                console.log(`Store_total: ${JSON.stringify(req)}`); 
                const response: StoreTotalResponse = { id: 'totalId' };
                return response;
            });

        const request = new AddThreeNumbersRequest();
        request.a = 666;
        request.b = 210;
        request.c = 206;

        console.log(JSON.stringify(request));

        try {
            await new AddThreeNumbersHandler().handle(flowContext, request);
            expect(false).to.be.true;
        } catch (error) {
            expect((error as Error).message).to.contain('bandy');
        }
    });
});