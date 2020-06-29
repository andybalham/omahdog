import { FlowRequestHandler } from '../omahdog/FlowRequestHandler';
import { FlowBuilder } from '../omahdog/FlowBuilder';
import { FlowDefinition } from '../omahdog/FlowDefinition';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from '../exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from '../exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class AddTwoNumbersHandler extends FlowRequestHandler<AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersState> {
    
    totalDescription = 'Total';

    constructor() {        
        super(AddTwoNumbersHandler, AddTwoNumbersResponse, AddTwoNumbersState);
    }

    buildFlow(flowBuilder: FlowBuilder<AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersState>): 
            FlowDefinition<AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersState> {

        return flowBuilder
            .initialise(
                (req, state) => {
                    state.startTime = new Date();
                    state.x = req.x;
                    state.y = req.y;
                    state.total = 0;
                })

            .perform('Sum_x_and_y', SumNumbersRequest, SumNumbersResponse,
                (req, state) => { req.values = [state.x, state.y]; },
                (res, state) => { state.total = res.total; })

            .finalise((res, state) => {
                res.total = state.total;
            });
    }
}

class AddTwoNumbersState {
    startTime: Date;
    x: number;
    y: number;
    total: number;
}
