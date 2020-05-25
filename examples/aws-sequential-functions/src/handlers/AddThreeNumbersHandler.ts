import { FlowRequestHandler } from '../omahdog/FlowRequestHandler';
import { FlowBuilder } from '../omahdog/FlowBuilder';
import { FlowDefinition } from '../omahdog/FlowDefinition';
import { AddThreeNumbersRequest, AddThreeNumbersResponse } from '../exchanges/AddThreeNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from '../exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class AddThreeNumbersHandler extends FlowRequestHandler<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState> {
    
    totalDescription = 'Total';

    constructor() {        
        super(AddThreeNumbersHandler, AddThreeNumbersResponse, AddThreeNumbersState);
    }

    buildFlow(flowBuilder: FlowBuilder<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState>): 
            FlowDefinition<AddThreeNumbersRequest, AddThreeNumbersResponse, AddThreeNumbersState> {

        return flowBuilder
            .initialise(
                (req, state) => {
                    state.request = req;
                    state.startTime = new Date();
                    state.total = 0;
                })

            .perform('Sum_a_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.request.a]; },
                (res, state) => { state.total = res.total; })

            .perform('Sum_b_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.request.b]; },
                (res, state) => { state.total = res.total; })

            .perform('Sum_c_and_total', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.total, state.request.c]; },
                (res, state) => { state.total = res.total; })

            .perform('Store_total', StoreTotalRequest, StoreTotalResponse,
                (req, state) => { 
                    req.description = this.totalDescription; 
                    req.total = state.total;
                    req.startTime = state.startTime;
                    req.endTime = new Date();
                })

            .finalise((res, state) => {
                res.total = state.total;
            });
    }
}

class AddThreeNumbersState {
    startTime: Date;
    request: AddThreeNumbersRequest;
    total: number;
}
