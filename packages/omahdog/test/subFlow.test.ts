import { FlowRequestHandler } from '../src/FlowRequestHandler';
import { FlowBuilder } from '../src/FlowBuilder';
import { FlowDefinition } from '../src/FlowDefinition';
import { FlowHandlers, IActivityRequestHandler } from '../src/FlowHandlers';
import { FlowContext, FlowInstanceStackFrame } from '../src/FlowContext';
import { expect } from 'chai';
import { IFlowInstanceRepository } from '../src/FlowInstanceRepository';
import uuid = require('uuid');

describe('Handlers', () => {

    it('returns the total of the inputs when activity invoked synchronously', () => {

        const flowContext = new FlowContext();
        flowContext.handlers = new FlowHandlers()
            .register(SumActivityRequest, SumActivityResponse, new SyncSumActivityHandler())
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(666);
    });

    it('returns the total of the inputs when activity invoked asynchronously', () => {

        const flowInstanceRepository = new InMemoryFlowInstanceRepository();
        const asyncActivityHandler = new AsyncActivityHandler();

        const asyncHandlers = new FlowHandlers()
            .register(SumActivityRequest, SumActivityResponse, asyncActivityHandler)
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        let flowContext = new FlowContext(flowInstanceRepository);
        flowContext.handlers = asyncHandlers;

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response01 = new ParentFlowHandler().handle(flowContext, request);

        expect(response01).to.be.undefined;
        expect(flowInstanceRepository.retrieve(flowContext.instanceId)).to.not.be.undefined;
        expect(flowContext.asyncRequestId).to.not.be.undefined;

        const instanceId = flowContext.instanceId;

        // Send back asynchronous response 01

        const asyncResponse01 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncActivityHandler.requestJson));

        flowContext = new FlowContext(flowInstanceRepository, instanceId, asyncResponse01);
        flowContext.handlers = asyncHandlers;

        const response02 = new ParentFlowHandler().handle(flowContext);

        expect(response02).to.be.undefined;
        expect(flowInstanceRepository.retrieve(instanceId)).to.not.be.undefined;
        expect(flowContext.asyncRequestId).to.not.be.undefined;

        // Send back asynchronous response 02

        const asyncResponse02 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncActivityHandler.requestJson));

        flowContext = new FlowContext(flowInstanceRepository, instanceId, asyncResponse02);
        flowContext.handlers = asyncHandlers;

        const response03 = new ParentFlowHandler().handle(flowContext);

        expect(response03).to.be.undefined;
        expect(flowInstanceRepository.retrieve(instanceId)).to.not.be.undefined;
        expect(flowContext.asyncRequestId).to.not.be.undefined;

        // Send back asynchronous response 03

        const asyncResponse03 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncActivityHandler.requestJson));

        flowContext = new FlowContext(flowInstanceRepository, instanceId, asyncResponse03);
        flowContext.handlers = asyncHandlers;

        const response04 = new ParentFlowHandler().handle(flowContext);

        expect(response04?.total).to.be.equal(666);
        expect(flowInstanceRepository.retrieve(instanceId)).to.be.undefined;
        expect(flowContext.asyncRequestId).to.be.undefined;
    });
});

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SyncSumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class AsyncActivityHandler implements IActivityRequestHandler<any, any> {
    requestJson: string;
    public handle(flowContext: FlowContext, request: any): any {
        flowContext.asyncRequestId = uuid.v4();
        this.requestJson = JSON.stringify(request);
        return undefined;
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

class InMemoryFlowInstanceRepository implements IFlowInstanceRepository {

    private readonly _flowInstances = new Map<string, string>();

    upsert(instanceId: string, stackFrames: FlowInstanceStackFrame[]): void {
        this._flowInstances.set(instanceId, JSON.stringify(stackFrames));
    }

    retrieve(instanceId: string): FlowInstanceStackFrame[] {
        const flowInstanceJson = this._flowInstances.get(instanceId);
        return (flowInstanceJson !== undefined) ? JSON.parse(flowInstanceJson) : undefined;
    }

    delete(instanceId: string): void {
        this._flowInstances.delete(instanceId);
    }
}

class ChildFlowHandler extends FlowRequestHandler<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {

    flowName = ChildFlowHandler.name;

    constructor() {
        super(ChildFlowResponse, ChildFlowState);
    }

    buildFlow(flowBuilder: FlowBuilder<ChildFlowRequest, ChildFlowResponse, ChildFlowState>): FlowDefinition<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.value1 = req.value1; state.value2 = req.value2;
            })
            .perform('Sum value 1 and 2', SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.value1, state.value2]; },
                (res, state) => { state.total = res.total; })
            .finalise(ChildFlowResponse, (res, state) => {
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

    flowName = ParentFlowHandler.name;

    constructor() {
        super(ParentFlowResponse, ParentFlowState);
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
            .finalise(ParentFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}
