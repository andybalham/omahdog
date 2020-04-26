import { expect } from 'chai';
import { FlowContext } from '../src/omahdog/FlowContext';
import { SumNumbersRequest, SumNumbersResponse } from '../src/exchanges/SumNumbersExchange';
import { SumNumbersHandler } from '../src/handlers/SumNumbersHandler';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from '../src/exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from '../src/handlers/AddThreeNumbersHandler';

describe('AddThreeNumbersActivity tests', () => {

    it('returns the total of the inputs', async () => {

        const flowContext = FlowContext.newContext();
        flowContext.requestRouter
            .register(SumNumbersRequest, SumNumbersResponse, SumNumbersHandler);
        flowContext.handlerFactory
            .register(SumNumbersHandler, () => new SumNumbersHandler());
        // flowContext.mocks
        //     .add('Store_total', (req: StoreTotalRequest) => { 
        //         console.log(`Store_total: ${JSON.stringify(req)}`); 
        //         return new StoreTotalResponse();
        //     });

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
});