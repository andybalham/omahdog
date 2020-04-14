import { expect } from 'chai';
import { FlowRequestHandler } from '../src/FlowRequestHandler';
import { IActivityRequestHandler, FlowHandlers } from '../src/FlowHandlers';
import { FlowBuilder } from '../src/FlowBuilder';
import { FlowContext } from '../src/FlowContext';
import { FlowDefinition } from '../src/FlowDefinition';

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class SumFlowRequest {
    a: number;
    b: number;
    c: number;
}

class SumFlowResponse {
    total: number;
}

class SumFlowState {
    a: number;
    b: number;
    c: number;
    total: number;
}

export class SumFlowHandler extends FlowRequestHandler<SumFlowRequest, SumFlowResponse, SumFlowState> {

    flowName = SumFlowHandler.name;

    constructor() {
        super(SumFlowResponse, SumFlowState);
    }

    buildFlow(flowBuilder: FlowBuilder<SumFlowRequest, SumFlowResponse, SumFlowState>): FlowDefinition<SumFlowRequest, SumFlowResponse, SumFlowState> {
        return flowBuilder
            .initialise(
                (req, state) => {
                    state.a = req.a;
                    state.b = req.b;
                    state.c = req.c;
                    state.total = 0;
                })

            .goto('Sum_a_and_b')

            .perform('Sum_total_and_c', SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.total, state.c]; },
                (res, state) => { state.total = res.total; })

            .end()

            .perform('Sum_a_and_b', SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.a, state.b]; },
                (res, state) => { state.total = res.total; })

            .label('This is a label')
            
            .goto('Sum_total_and_c')

            .finalise(SumFlowResponse,
                (res, state) => {
                    res.total = state.total;
                });
    }
}

describe('Handlers', () => {

    it('returns the total of the inputs', () => {

        const flowContext = new FlowContext();
        flowContext.handlers = new FlowHandlers()
            .register(SumActivityRequest, SumActivityResponse, new SumActivityHandler());

        const request = new SumFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const response = new SumFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(616);
    });
});