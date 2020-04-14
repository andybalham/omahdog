import { expect } from 'chai';
import { FlowContext } from '../src/omahdog/FlowContext';
import { FlowHandlers } from '../src/omahdog/FlowHandlers';
import { SumNumbersRequest, SumNumbersResponse } from '../src/exchanges/SumNumbersExchange';
import { SumNumbersHandler } from '../src/handlers/SumNumbersHandler';
import { AddThreeNumbersRequest } from '../src/exchanges/AddThreeNumbersExchange';
import { AddThreeNumbersHandler } from '../src/handlers/AddThreeNumbersHandler';

describe('AddThreeNumbersActivity tests', () => {

    it('returns the total of the inputs', () => {

        const flowContext = new FlowContext();
        flowContext.handlers = new FlowHandlers()
            .register(SumNumbersRequest, SumNumbersResponse, new SumNumbersHandler());

        const request = new AddThreeNumbersRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const response = new AddThreeNumbersHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(616);
    });
});