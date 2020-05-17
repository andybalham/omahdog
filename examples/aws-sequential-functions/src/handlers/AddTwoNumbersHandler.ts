import { FlowRequestHandler } from '../omahdog/FlowRequestHandler';
import { FlowBuilder } from '../omahdog/FlowBuilder';
import { FlowDefinition } from '../omahdog/FlowDefinition';
import { AddTwoNumbersRequest, AddTwoNumbersResponse } from '../exchanges/AddTwoNumbersExchange';
import { SumNumbersRequest, SumNumbersResponse } from '../exchanges/SumNumbersExchange';
import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class AddTwoNumbersHandler extends FlowRequestHandler<AddTwoNumbersRequest, AddTwoNumbersResponse, AddTwoNumbersState> {
    
    private readonly _totalDescription: string;

    constructor(totalDescription?: string) {
        
        super(AddTwoNumbersHandler, AddTwoNumbersResponse, AddTwoNumbersState);

        this._totalDescription = totalDescription ?? 'Total';
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

        // .perform('Store_total', StoreTotalRequest, StoreTotalResponse,
        //     (req, state) => { 
        //         req.description = this._totalDescription; 
        //         req.total = state.total;
        //         req.startTime = state.startTime;
        //         req.endTime = new Date();
        //     })

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
