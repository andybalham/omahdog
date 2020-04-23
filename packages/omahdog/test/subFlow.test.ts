import uuid = require('uuid');
import { FlowRequestHandler } from '../src/FlowRequestHandler';
import { FlowBuilder } from '../src/FlowBuilder';
import { FlowDefinition } from '../src/FlowDefinition';
import { FlowHandlers, IActivityRequestHandler, AsyncResponse } from '../src/FlowHandlers';
import { FlowContext, FlowInstance } from '../src/FlowContext';
import { expect } from 'chai';

describe('Handlers', () => {

    it('returns the total of the inputs when activity invoked synchronously', async () => {

        const flowContext = FlowContext.newContext();
        flowContext.handlers = new FlowHandlers()
            .register(SumActivityRequest, SumActivityResponse, new SyncSumActivityHandler())
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response = await new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.correlationId).to.be.not.undefined;
        expect((response as ParentFlowResponse).total).to.be.equal(666);
    });

    it('returns the total of the inputs when activity invoked asynchronously', async () => {

        const asyncActivityHandler = new AsyncActivityHandler();

        const asyncHandlers = new FlowHandlers()
            .register(SumActivityRequest, SumActivityResponse, asyncActivityHandler)
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        let flowContext = FlowContext.newContext();
        flowContext.handlers = asyncHandlers;

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        let flowInstance: FlowInstance;
        
        const asyncResponse01 = await new ParentFlowHandler().handle(flowContext, request);

        expect('AsyncResponse' in asyncResponse01).to.be.true;
        flowInstance = (asyncResponse01 as AsyncResponse).getFlowInstance();

        // Feed in response01

        const response01 =
            await new SyncSumActivityHandler().handle(FlowContext.newContext(), JSON.parse(asyncActivityHandler.requestJson));
        
        flowContext = FlowContext.newResumeContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, response01);
        flowContext.handlers = asyncHandlers;
        
        const asyncResponse02 = await new ParentFlowHandler().handle(flowContext);

        expect('AsyncResponse' in asyncResponse02).to.be.true;
        flowInstance = (asyncResponse02 as AsyncResponse).getFlowInstance();

        // Feed in response02

        const response02 =
            await new SyncSumActivityHandler().handle(FlowContext.newContext(), JSON.parse(asyncActivityHandler.requestJson));
        
        flowContext = FlowContext.newResumeContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, response02);
        flowContext.handlers = asyncHandlers;
        
        const asyncResponse03 = await new ParentFlowHandler().handle(flowContext);

        expect('AsyncResponse' in asyncResponse03).to.be.true;
        flowInstance = (asyncResponse03 as AsyncResponse).getFlowInstance();

        // Feed in response03

        const response03 =
            await new SyncSumActivityHandler().handle(FlowContext.newContext(), JSON.parse(asyncActivityHandler.requestJson));
        
        flowContext = FlowContext.newResumeContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, response03);
        flowContext.handlers = asyncHandlers;
        
        const response04 = await new ParentFlowHandler().handle(flowContext);

        expect((response04 as ParentFlowResponse).total).to.equal(666);
    });
});

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SyncSumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    async handle(_flowContext: FlowContext, request: SumActivityRequest): Promise<SumActivityResponse> {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class AsyncActivityHandler implements IActivityRequestHandler<any, any> {
    requestJson: string;
    async handle(flowContext: FlowContext, request: any): Promise<any> {
        const requestId = uuid.v4();
        this.requestJson = JSON.stringify(request);
        return flowContext.getAsyncResponse(requestId);
    }
}

class ChildFlowRequest {
    value1: number; value2: number;
}
class ChildFlowResponse {
    total: number;
}
class ChildFlowState {
    total: number;
    value1: number; value2: number;
}

class ChildFlowHandler extends FlowRequestHandler<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {

    constructor() {
        super(ChildFlowHandler, ChildFlowResponse, ChildFlowState);
    }

    buildFlow(flowBuilder: FlowBuilder<ChildFlowRequest, ChildFlowResponse, ChildFlowState>): FlowDefinition<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.value1 = req.value1; state.value2 = req.value2;
            })
            .perform('Sum value 1 and 2', SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.value1, state.value2]; },
                (res, state) => { state.total = res.total; })
            .finalise((res, state) => {
                res.total = state.total;
            });
    }
}

class ParentFlowRequest {
    a: number; b: number; c: number; d: number;
}
class ParentFlowResponse {
    total: number;
}
class ParentFlowState {
    a: number; b: number; c: number; d: number;
    total: number;
}

class ParentFlowHandler extends FlowRequestHandler<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {

    constructor() {
        super(ParentFlowHandler, ParentFlowResponse, ParentFlowState);
    }

    protected debugPreActivityRequest(_stepName: string, _request: any, _state: any): void { }
    protected debugPostActivityResponse(_stepName: string, _response: any, _state: any): void { }

    buildFlow(flowBuilder: FlowBuilder<ParentFlowRequest, ParentFlowResponse, ParentFlowState>): FlowDefinition<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.a = req.a; state.b = req.b; state.c = req.c; state.d = req.d;
            })
            .perform('Add a and b', ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.a; req.value2 = state.b; },
                (res, state) => { state.total = res.total; })
            .perform('Add c and total', ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.c; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .perform('Add d and total', ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.d; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .finalise((res, state) => {
                res.total = state.total;
            });
    }
}
